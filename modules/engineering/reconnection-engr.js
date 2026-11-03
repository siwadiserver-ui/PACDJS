// modules/engineering/reconnection-engr.js
const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 📋 1. Fetch Reconnection Pool para sa Engineering
router.get('/list', async (req, res) => {
  try {
    const status = (req.query.status || 'ALL').toUpperCase().trim();
    
    // 💡 Inalis ang FIRST 300 para makuha LAHAT ng records
    let sql = `
      SELECT 
        r.ID,
        r.REFERENCE_NUMBER,
        r.ACCOUNT_NUMBER,
        r.ACCOUNT_NAME,
        r.ADDRESS,
        r.METER_NUMBER,
        r.READING,
        r.OR_NUMBER,
        r.PAID_BY,
        r.RECON_FEE,
        r.CD_FEE,
        r.MATERIALS_FEE,
        r.OTHERS_FEE,
        r.METER_STATUS,
        r.RECEIVED_BY,
        r.REQUEST_DATE,
        r.REQUEST_TIME,
        r.RECONNECTED_BY,
        r.DATE_RECONNECTED,
        r.NEW_METER_NUMBER,
        r.PLUMBER_REMARKS,
        r.UPDATED_BY,
        r.STATUS,
        r.CREATED_DATE
      FROM RECONNECTION_REQUESTS r
      WHERE 1=1
    `;
    const params = [];

    // 💡 Saluhin ang lahat ng pending variations mula Commercial
    if (status === 'PENDING') {
      sql += ` AND (
        UPPER(r.STATUS) = 'PENDING' 
        OR UPPER(r.STATUS) = 'SENT TO ENGINEERING' 
        OR UPPER(r.STATUS) = 'SENT TO ENGR'
        OR UPPER(r.STATUS) = 'PAID'
        OR UPPER(r.STATUS) = 'OPEN'
        OR r.STATUS IS NULL
      )`;
    } else if (status !== 'ALL') {
      sql += ` AND UPPER(r.STATUS) = ?`;
      params.push(status);
    }

    sql += ` ORDER BY r.ID DESC`;

    const rows = await db.query(sql, params);

    // 💡 I-map ang Commercial status variations patungong 'PENDING' para pare-pareho ang display sa Engineering
    const cleanRows = (rows || []).map(row => {
      const st = (row.STATUS || 'PENDING').toUpperCase();
      if (
        st === 'SENT TO ENGINEERING' || 
        st === 'SENT TO ENGR' || 
        st === 'PAID' || 
        st === 'OPEN'
      ) {
        return { ...row, STATUS: 'PENDING' };
      }
      return row;
    });

    res.json({ success: true, data: cleanRows });
  } catch (err) {
    console.error('❌ Error in /api/engr/reconnections/list:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/update-action', async (req, res) => {
  try {
    const {
      id,
      reconnectedBy,
      dateReconnected,
      meterStatus,
      newMeterNumber,
      plumberRemarks,
      updatedBy, // 👈 Kunin ang encoder
      status
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Record ID is required.' });
    }

    const updateSql = `
      UPDATE RECONNECTION_REQUESTS SET
        RECONNECTED_BY = ?,
        DATE_RECONNECTED = ?,
        METER_STATUS = ?,
        NEW_METER_NUMBER = ?,
        PLUMBER_REMARKS = ?,
        UPDATED_BY = ?,
        STATUS = ?
      WHERE ID = ?
    `;

    const params = [
      (reconnectedBy || '').trim().toUpperCase(),
      (dateReconnected || '').trim(),
      (meterStatus || 'MAGNETIC').trim().toUpperCase(),
      (newMeterNumber || '').trim().toUpperCase(),
      (plumberRemarks || '').trim(),
      (updatedBy || 'STAFF').trim().toUpperCase(), // 👈 Ligtas na ilagay ang encoder
      (status || 'RECONNECTED').trim().toUpperCase(),
      id
    ];

    await db.query(updateSql, params);
    res.json({ success: true, message: 'Reconnection record updated successfully!' });
  } catch (err) {
    console.error('❌ Error updating engr reconnection:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;