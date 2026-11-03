const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

function getConcessionaireRecords(req) {
  // 1. Server memory
  if (req.app.locals.excelConcessionaireData) {
    const d = req.app.locals.excelConcessionaireData;
    return Array.isArray(d) ? d : (d.records || d.data || []);
  }

  // 2. Cache files (kung may sinave ang excel-modal upload)
  const possiblePaths = [
    path.join(__dirname, '../../data/concessionaires-cache.json'),
    path.join(__dirname, '../../public/data/concessionaires.json'),
    path.join(__dirname, '../../uploads/concessionaires.json')
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : (parsed.records || parsed.data || []);
      } catch (e) {
        console.error('Error reading cache path:', p, e);
      }
    }
  }

  return [];
}

router.get('/search-pattern', (req, res) => {
  try {
    const { part1, part3 } = req.query;

    if (!part1 || !part3) {
      return res.status(400).json({ success: false, message: 'Kailangan ang part1 at part3.' });
    }

    const sPart1 = parseInt(part1.trim(), 10);
    const sPart3 = parseInt(part3.trim(), 10);
    const records = getConcessionaireRecords(req);

    if (!records || records.length === 0) {
      return res.json({ 
        success: false, 
        message: 'Walang uploaded Excel Concessionaire data sa cache.' 
      });
    }

    for (const record of records) {
      const accNo = record['Account No.'] || record['ACCOUNT_NUMBER'] || record['Account Number'] || record['account_no'] || '';
      const name = record['Name'] || record['NAME'] || record['Account Name'] || record['name'] || '';
      const address = record['Address'] || record['ADDRESS'] || record['address'] || '';

      if (accNo && accNo.includes('-')) {
        const parts = accNo.split('-');
        if (parts.length >= 3) {
          const dbPart1 = parseInt(parts[0].trim(), 10);
          const dbPart3 = parseInt(parts[2].trim(), 10);

          if (dbPart1 === sPart1 && dbPart3 === sPart3) {
            return res.json({
              success: true,
              data: {
                name: name,
                address: address,
                full_account_number: accNo
              }
            });
          }
        }
      }
    }

    return res.json({ success: false, message: 'Account not found sa Excel list.' });

  } catch (err) {
    console.error('❌ Error in raffle search-pattern:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;