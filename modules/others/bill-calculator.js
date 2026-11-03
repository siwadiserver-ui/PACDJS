const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 📊 1. Sentralisadong Tariff Rates Data
const TARIFF_DATA = {
  "RESIDENTIAL(101)": {
    '1/2"': { min_charge: 200.00, rates: { "11-20": 21.13, "21-30": 23.25, "31-40": 26.00, "41-50": 30.00, "51-Up": 34.40 } }
  },
  "COMMERCIAL(301)": {
    '1/2"': { min_charge: 400.00, rates: { "11-20": 42.26, "21-30": 46.50, "31-40": 52.00, "41-50": 60.00, "51-Up": 68.80 } },
    '3/4"': { min_charge: 640.00, rates: { "11-20": 42.26, "21-30": 46.50, "31-40": 52.00, "41-50": 60.00, "51-Up": 68.80 } },
    '1"':   { min_charge: 1280.00, rates: { "11-20": 42.26, "21-30": 46.50, "31-40": 52.00, "41-50": 60.00, "51-Up": 68.80 } }
  },
  "SEMI-COM'L. A": {
    '1/2"': { min_charge: 350.00, rates: { "11-20": 36.98, "21-30": 40.69, "31-40": 45.50, "41-50": 52.50, "51-Up": 60.20 } }
  },
  "SEMI-COM'L. B": {
    '1/2"': { min_charge: 300.00, rates: { "11-20": 31.70, "21-30": 34.88, "31-40": 39.00, "41-50": 45.00, "51-Up": 51.60 } }
  },
  "SEMI-COM'L. C": {
    '1/2"': { min_charge: 250.00, rates: { "11-20": 26.41, "21-30": 29.06, "31-40": 32.50, "41-50": 37.50, "51-Up": 43.00 } }
  },
  "BULK/WHOLESALE": {
    '1/2"': { min_charge: 600.00, rates: { "11-20": 63.39, "21-30": 69.75, "31-40": 78.00, "41-50": 90.00, "51-Up": 103.20 } }
  }
};

// 📌 Kunin ang Tariff Rates
router.get('/tariff-rates', (req, res) => {
  res.json({ success: true, data: TARIFF_DATA });
});

// 📌 Server-side Calculation Engine
router.post('/compute-water', (req, res) => {
  try {
    const { classification, meterSize, consumption } = req.body;

    if (!classification || !meterSize || consumption === undefined || consumption < 0) {
      return res.status(400).json({ success: false, message: 'Kulang o invalid ang inputs.' });
    }

    const cons = parseInt(consumption, 10);
    const tariff = TARIFF_DATA[classification]?.[meterSize];

    if (!tariff) {
      return res.status(400).json({ success: false, message: 'Hindi nahanap ang tariff para sa classification/meter size na ito.' });
    }

    const minCharge = tariff.min_charge;
    const rates = tariff.rates;
    let totalBill = 0;
    const steps = [];

    if (cons <= 10) {
      totalBill = minCharge;
      steps.push(`1. First ${cons} cu.m. @ Minimum Charge = Php ${minCharge.toFixed(2)}`);
    } else {
      steps.push(`1. First 10 cu.m. @ Minimum Charge = Php ${minCharge.toFixed(2)}`);
      totalBill = minCharge;

      let remaining = cons - 10;
      let tierNum = 2;

      const tiers = [
        { range: "11-20", rate: rates["11-20"], limit: 10 },
        { range: "21-30", rate: rates["21-30"], limit: 10 },
        { range: "31-40", rate: rates["31-40"], limit: 10 },
        { range: "41-50", rate: rates["41-50"], limit: 10 },
        { range: "51-Up", rate: rates["51-Up"], limit: null }
      ];

      for (const t of tiers) {
        if (remaining <= 0) break;
        const qty = t.limit ? Math.min(remaining, t.limit) : remaining;
        const cost = qty * t.rate;

        steps.push(`${tierNum}. Next ${qty} cu.m. (${t.range}) = ${qty} × Php ${t.rate.toFixed(2)} = Php ${cost.toFixed(2)}`);
        totalBill += cost;
        remaining -= qty;
        tierNum++;
      }
    }

    res.json({
      success: true,
      data: {
        classification,
        meterSize,
        consumption: cons,
        minCharge,
        rates,
        detailed_steps: steps,
        total: totalBill
      }
    });

  } catch (err) {
    console.error('Computation error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;