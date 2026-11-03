const express = require('express');
const router = express.Router();
const db = require('../../config/db'); 

// 🔍 Search Concessionaires (Strict 1st and 3rd Segment Matching)
router.get('/search-concessionaire', async (req, res) => {
  try {
    const p1 = (req.query.p1 || req.query.part1 || '').trim();
    const p3 = (req.query.p3 || req.query.part3 || '').trim();

    if (!p1 || !p3) {
      return res.json({ success: true, found: false, customer: null });
    }

    // Tanggalin ang leading zeros (hal. "072" -> "72", "006" -> "6")
    const cleanP1 = p1.replace(/^0+/, '') || '0';
    const cleanP3 = p3.replace(/^0+/, '') || '0';

    // Lahat ng posibleng formats sa DB para sa 1st part (Book)
    const p1Formats = [
      cleanP1,
      cleanP1.padStart(2, '0'),
      cleanP1.padStart(3, '0')
    ];

    // Lahat ng posibleng formats sa DB para sa 3rd part (Sequence)
    const p3Formats = [
      cleanP3,
      cleanP3.padStart(2, '0'),
      cleanP3.padStart(3, '0'),
      cleanP3.padStart(4, '0'),
      cleanP3.padStart(5, '0')
    ];

    const uniqueP1 = [...new Set(p1Formats)];
    const uniqueP3 = [...new Set(p3Formats)];

    // STRICT FORMAT: [Part 1] - [HINDI GITLING] - [Part 3]
    // Sa ganitong pattern, siguradong 2 gitling lang ang dadaanan at Part 3 ang dulo
    let conditions = [];
    let params = [];

    uniqueP1.forEach(v1 => {
      uniqueP3.forEach(v3 => {
        // [v1]-[kahit anong characters na walang hyphen]-[v3]
        conditions.push(`ACCOUNT_NUMBER LIKE ?`);
        params.push(`${v1}-%-${v3}`);
      });
    });

    const sql = `
      SELECT FIRST 10 
        ACCOUNT_NUMBER, 
        ACCOUNT_NAME, 
        ADDRESS, 
        METER_NUMBER 
      FROM CUSTOMER_DATABASE 
      WHERE ${conditions.join(' OR ')}
    `;

    const rows = await db.query(sql, params);

    if (rows && rows.length > 0) {
      // 🎯 JS FILTER: Siguraduhing tumutugma talaga ang 1st at 3rd elements kapag ini-split sa '-'
      const exactMatch = rows.find(r => {
        if (!r.ACCOUNT_NUMBER || !r.ACCOUNT_NUMBER.includes('-')) return false;
        const parts = r.ACCOUNT_NUMBER.split('-');
        if (parts.length < 3) return false;

        const dbP1 = parts[0].trim().replace(/^0+/, '');
        const dbP3 = parts[parts.length - 1].trim().replace(/^0+/, '');

        return dbP1 === cleanP1 && dbP3 === cleanP3;
      });

      const matchedRecord = exactMatch || rows[0];

      return res.json({
        success: true,
        found: true,
        customer: matchedRecord
      });
    }

    res.json({ success: true, found: false, customer: null });
  } catch (err) {
    console.error('❌ Error search-concessionaire:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📋 Fetch Disconnection Records
router.get('/list', async (req, res) => {
  try {
    const sql = `
      SELECT FIRST 150 
        ID, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, METER_NUMBER,
        READING, METER_STATUS, REMARKS, DISCONNECTION_DATE,
        DISCONNECTION_TIME, DISCONNECTED_BY, DATE_DISCONNECTED,
        PLUMBER_REMARKS, STATUS, CREATED_DATE
      FROM DISCONNECTION_REQUESTS
      ORDER BY ID DESC
    `;
    const rows = await db.query(sql);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 💾 Create Record
router.post('/create', async (req, res) => {
  try {
    const {
      account_number,
      account_name,
      address,
      meter_number,
      reading,
      meter_status,
      remarks,
      disconnection_date,
      disconnection_time,
      disconnected_by,
      plumber_remarks
    } = req.body;

    // Gamitin ang GEN_ID para sa bagong ID
    const insertSql = `
      INSERT INTO DISCONNECTION_REQUESTS (
        ID,
        ACCOUNT_NUMBER, 
        ACCOUNT_NAME, 
        ADDRESS, 
        METER_NUMBER,
        READING, 
        METER_STATUS, 
        REMARKS, 
        DISCONNECTION_DATE,
        DISCONNECTION_TIME, 
        DISCONNECTED_BY, 
        DATE_DISCONNECTED,
        PLUMBER_REMARKS, 
        STATUS, 
        CREATED_DATE
      ) VALUES (
        GEN_ID(GEN_DISCONNECTION_REQUESTS_ID, 1),
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, 'DISCONNECTED', CURRENT_TIMESTAMP
      )
    `;

    const cleanDate = disconnection_date && disconnection_date.trim() !== '' ? disconnection_date : null;

    const params = [
      (account_number || '').trim(),
      (account_name || '').trim().toUpperCase(),
      (address || '').trim().toUpperCase(),
      (meter_number || '').trim(),
      parseFloat(reading) || 0,
      (meter_status || 'KALAS').trim().toUpperCase(),
      (remarks || '').trim(),
      cleanDate,
      (disconnection_time || '').trim(),
      (disconnected_by || '').trim().toUpperCase(),
      cleanDate,
      (plumber_remarks || '').trim()
    ];

    await db.query(insertSql, params);
    res.json({ success: true, message: 'Disconnection record saved!' });
  } catch (err) {
    console.error('❌ Error in /api/disconnection/create:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔄 Update Record
router.post('/update', async (req, res) => {
  try {
    const {
      id,
      account_number,
      account_name,
      address,
      meter_number,
      reading,
      meter_status,
      remarks,
      disconnection_date,
      disconnection_time,
      disconnected_by,
      plumber_remarks
    } = req.body;

    const updateSql = `
      UPDATE DISCONNECTION_REQUESTS SET
        ACCOUNT_NUMBER = ?,
        ACCOUNT_NAME = ?,
        ADDRESS = ?,
        METER_NUMBER = ?,
        READING = ?,
        METER_STATUS = ?,
        REMARKS = ?,
        DISCONNECTION_DATE = ?,
        DISCONNECTION_TIME = ?,
        DISCONNECTED_BY = ?,
        DATE_DISCONNECTED = ?,
        PLUMBER_REMARKS = ?,
        UPDATED_DATE = CURRENT_TIMESTAMP
      WHERE ID = ?
    `;

    const params = [
      (account_number || '').trim(),
      (account_name || '').trim().toUpperCase(),
      (address || '').trim().toUpperCase(),
      (meter_number || '').trim(),
      parseFloat(reading) || 0,
      (meter_status || 'KALAS').trim().toUpperCase(),
      (remarks || '').trim(),
      disconnection_date || null,
      (disconnection_time || '').trim(),
      (disconnected_by || '').trim().toUpperCase(),
      disconnection_date || null,
      (plumber_remarks || '').trim(),
      id
    ];

    await db.query(updateSql, params);
    res.json({ success: true, message: 'Record updated successfully!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/delete', async (req, res) => {
  try {
    const { id, password } = req.body;

    // Optional Security password check sa backend kung ginagamit sa frontend
    if (password && password.toUpperCase() !== 'KUMAKALABUKAB') {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid password' });
    }

    // 🎯 TAMA: DISCONNECTION_REQUESTS ang eksaktong pangalan ng table sa Firebird
    await db.query(`DELETE FROM DISCONNECTION_REQUESTS WHERE ID = ?`, [id]); 
    res.json({ success: true });
  } catch (err) {
    console.error('❌ Delete Disconnection Error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;