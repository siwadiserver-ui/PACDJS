const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 🔍 1. Search Concessionaire / Account para sa FROM auto-fill
router.get('/search-account', async (req, res) => {
  try {
    const q = (req.query.q || '').trim().toUpperCase();
    const p1 = (req.query.p1 || '').trim();
    const p3 = (req.query.p3 || '').trim();

    let sql = `
      SELECT FIRST 10 
        ACCOUNT_NUMBER, 
        ACCOUNT_NAME, 
        ADDRESS, 
        METER_NUMBER 
      FROM CUSTOMER_DATABASE 
      WHERE 1=1
    `;
    let params = [];

    if (p1 && p3) {
      sql += ` AND (
        UPPER(ACCOUNT_NUMBER) LIKE ? 
        OR UPPER(ACCOUNT_NUMBER) LIKE ?
      )`;
      params.push(`%${p1}%${p3}%`, `${p1}-%-${p3}`);
    } else if (q) {
      sql += ` AND (
        UPPER(ACCOUNT_NUMBER) LIKE ? 
        OR UPPER(ACCOUNT_NAME) LIKE ?
      )`;
      params.push(`%${q}%`, `%${q}%`);
    } else {
      return res.json([]);
    }

    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error in /search-account:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📋 2. Fetch List ng Transfer Requests
router.get('/list', async (req, res) => {
  try {
    const sql = `
      SELECT FIRST 200 
        r.ID, 
        r.ACCOUNT_NUMBER, 
        r.ACCOUNT_NAME, 
        r.FROM_ADDRESS,
        r.FROM_METER_NUMBER, 
        r.TO_ADDRESS, 
        r.TO_CONTACT_NUMBER, 
        r.TO_METER_NUMBER,
        r.APPLICATION_DATE, 
        r.REQUIREMENT, 
        r.REMARKS, 
        r.STATUS, 
        r.CREATED_DATE,
        r.UPDATED_DATE
      FROM TRANSFER_REQUESTS r
      ORDER BY r.ID DESC
    `;
    const rows = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error in /api/transfer/list:', err);
    res.status(500).json({ error: err.message });
  }
});

// 💾 3. Create Transfer Request
router.post('/create', async (req, res) => {
  try {
    const {
      account_number,
      account_name,
      from_address,
      from_meter_number,
      to_address,
      to_contact_number,
      to_meter_number,
      application_date,
      requirement,
      remarks,
      status
    } = req.body;

    if (!account_number || !account_name || !to_address) {
      return res.status(400).json({ error: 'Account Number, Name, at New Address ay kailangan!' });
    }

    const insertSql = `
      INSERT INTO TRANSFER_REQUESTS (
        ID,
        ACCOUNT_NUMBER, 
        ACCOUNT_NAME, 
        FROM_ADDRESS,
        FROM_METER_NUMBER, 
        TO_ADDRESS, 
        TO_CONTACT_NUMBER, 
        TO_METER_NUMBER,
        APPLICATION_DATE, 
        REQUIREMENT, 
        REMARKS, 
        STATUS, 
        CREATED_DATE,
        UPDATED_DATE
      ) VALUES (
        GEN_ID(GEN_TRANSFER_REQUESTS_ID, 1),
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;

    const params = [
      (account_number || '').trim(),
      (account_name || '').trim().toUpperCase(),
      (from_address || '').trim().toUpperCase(),
      (from_meter_number || '').trim(),
      (to_address || '').trim().toUpperCase(),
      (to_contact_number || '').trim(),
      (to_meter_number || '').trim(),
      application_date || new Date().toISOString().split('T')[0],
      (requirement || 'Proof of Ownership/Brgy. Permit').trim(),
      (remarks || '').trim(),
      (status || 'PENDING').trim().toUpperCase()
    ];

    await db.query(insertSql, params);
    res.json({ success: true, message: 'Transfer request submitted successfully!' });
  } catch (err) {
    console.error('❌ Error in /api/transfer/create:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔄 4. Update Transfer Request
router.post('/update', async (req, res) => {
  try {
    const {
      id,
      account_number,
      account_name,
      from_address,
      from_meter_number,
      to_address,
      to_contact_number,
      to_meter_number,
      application_date,
      requirement,
      remarks,
      status
    } = req.body;

    if (!id) return res.status(400).json({ error: 'Missing record ID.' });

    const updateSql = `
      UPDATE TRANSFER_REQUESTS SET
        ACCOUNT_NUMBER = ?,
        ACCOUNT_NAME = ?,
        FROM_ADDRESS = ?,
        FROM_METER_NUMBER = ?,
        TO_ADDRESS = ?,
        TO_CONTACT_NUMBER = ?,
        TO_METER_NUMBER = ?,
        APPLICATION_DATE = ?,
        REQUIREMENT = ?,
        REMARKS = ?,
        STATUS = ?,
        UPDATED_DATE = CURRENT_TIMESTAMP
      WHERE ID = ?
    `;

    const params = [
      (account_number || '').trim(),
      (account_name || '').trim().toUpperCase(),
      (from_address || '').trim().toUpperCase(),
      (from_meter_number || '').trim(),
      (to_address || '').trim().toUpperCase(),
      (to_contact_number || '').trim(),
      (to_meter_number || '').trim(),
      application_date,
      (requirement || '').trim(),
      (remarks || '').trim(),
      (status || 'PENDING').trim().toUpperCase(),
      id
    ];

    await db.query(updateSql, params);
    res.json({ success: true, message: 'Transfer request updated successfully!' });
  } catch (err) {
    console.error('❌ Error in /api/transfer/update:', err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ 5. Mark as Completed
router.post('/mark-completed', async (req, res) => {
  try {
    const { id } = req.body;
    await db.query(
      `UPDATE TRANSFER_REQUESTS SET STATUS = 'COMPLETED', UPDATED_DATE = CURRENT_TIMESTAMP WHERE ID = ?`,
      [id]
    );
    res.json({ success: true, message: 'Transfer request marked as COMPLETED!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ 6. Delete Record
router.post('/delete', async (req, res) => {
  try {
    const { id, password } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Kailangan ang Record ID.' });
    }

    // 🔒 Server-Side Security Password Verification
    if (password !== 'KUMAKALABUKAB' && password !== 'kumakalabukab') {
      return res.status(403).json({ error: 'Unauthorized: Mali ang security password!' });
    }

    await db.query('DELETE FROM TRANSFER_REQUESTS WHERE ID = ?', [id]);
    res.json({ success: true, message: 'Transfer request deleted successfully!' });
  } catch (err) {
    console.error('❌ Error in /api/transfer/delete:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;