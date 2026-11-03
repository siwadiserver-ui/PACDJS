const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 📋 1. Fetch Service Requests Pool para sa Engineering
router.get('/list', async (req, res) => {
  try {
    const status = (req.query.status || 'ALL').toUpperCase().trim();
    
    // 💡 Inalis ang FIRST 300 para mahatak LAHAT ng records
    let sql = `
      SELECT 
        r.ID, 
        r.REFERENCE_NUMBER, 
        r.ACCOUNT_NUMBER, 
        r.ACCOUNT_NAME, 
        r.ADDRESS,
        r.METER_NUMBER, 
        r.RECEIVED_BY, 
        r.REQUESTED_BY, 
        r.CONTACT_NUMBER,
        r.WATER_METER_READING, 
        r.REQUEST_DATE, 
        r.REQUEST_TIME, 
        r.REQUEST_DETAILS,
        r.OTHER_DETAILS, 
        r.COMPLAINT, 
        r.ACTION_TAKEN, 
        r.WM_ACTION, 
        r.MATERIALS,
        r.CONCESSIONAIRE_SIGNATURE, 
        r."COMMENT", 
        r.COMPLETED_BY, 
        r.COMPLETION_DATE,
        r.PLUMBER_REMARKS, 
        r.UPDATED_BY,
        r.STATUS, 
        r.CREATED_DATE, 
        r.UPDATED_DATE
      FROM SERVICE_REQUESTS r
      WHERE 1=1
    `;
    const params = [];

    // 💡 Mas matalinong Status Filtering:
    // Kapag 'PENDING' ang pinili, kukunin din ang 'SENT TO ENGINEERING' at 'OPEN'
    if (status === 'PENDING') {
      sql += ` AND (
        UPPER(r.STATUS) = 'PENDING' 
        OR UPPER(r.STATUS) = 'SENT TO ENGINEERING' 
        OR UPPER(r.STATUS) = 'SENT TO ENGR'
        OR UPPER(r.STATUS) = 'OPEN'
        OR r.STATUS IS NULL
      )`;
    } else if (status !== 'ALL') {
      sql += ` AND UPPER(r.STATUS) = ?`;
      params.push(status);
    }

    sql += ` ORDER BY r.ID DESC`;

    const rows = await db.query(sql, params);

    // 💡 I-map ang STATUS para maging malinis na 'PENDING' sa mata ng Engineering
    const cleanRows = (rows || []).map(row => {
      const st = (row.STATUS || 'PENDING').toUpperCase();
      if (st === 'SENT TO ENGINEERING' || st === 'SENT TO ENGR' || st === 'OPEN') {
        return { ...row, STATUS: 'PENDING' };
      }
      return row;
    });

    res.json({ success: true, data: cleanRows });
  } catch (err) {
    console.error('❌ Error in /api/engr/service-requests/list:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/update-action', async (req, res) => {
  try {
    const {
      id,
      completedBy,
      completionDate,
      complaint,
      actionTaken,
      wmAction,
      materials,
      signature,
      comment,
      updatedBy, // 👈 Kunin ang user mula sa request
      status
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Record ID is required.' });
    }

    const updateSql = `
      UPDATE SERVICE_REQUESTS SET
        COMPLETED_BY = ?,
        COMPLETION_DATE = ?,
        COMPLAINT = ?,
        ACTION_TAKEN = ?,
        WM_ACTION = ?,
        MATERIALS = ?,
        CONCESSIONAIRE_SIGNATURE = ?,
        "COMMENT" = ?,
        PLUMBER_REMARKS = ?,
        UPDATED_BY = ?,
        STATUS = ?,
        UPDATED_DATE = CURRENT_TIMESTAMP
      WHERE ID = ?
    `;

    const params = [
      (completedBy || '').trim().toUpperCase(),
      (completionDate || '').trim(),
      (complaint || '').trim().toUpperCase(),
      (actionTaken || '').trim().toUpperCase(),
      (wmAction || '').trim().toUpperCase(),
      (materials || '').trim().toUpperCase(),
      (signature || '').trim().toUpperCase(),
      (comment || '').trim(),
      (comment || '').trim(),
      (updatedBy || 'STAFF').trim().toUpperCase(), // 👈 Ligtas na ilagay ang updatedBy
      (status || 'COMPLETED').trim().toUpperCase(),
      id
    ];

    await db.query(updateSql, params);
    res.json({ success: true, message: 'Service Request accomplishment updated successfully!' });
  } catch (err) {
    console.error('❌ Error updating engr service request:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;