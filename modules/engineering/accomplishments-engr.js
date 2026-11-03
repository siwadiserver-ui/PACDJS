// modules/engineering/accomplishments-engr.js
const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 📋 1. Service Requests Accomplishments (COMPLETED ONLY)
router.get('/service-requests', async (req, res) => {
  try {
    const sql = `
      SELECT FIRST 200
        ID, REFERENCE_NUMBER, ACCOUNT_NAME, ADDRESS, REQUEST_DATE, REQUEST_TIME,
        REQUEST_DETAILS, ACTION_TAKEN, WATER_METER_READING, MATERIALS, 
        COMPLETION_DATE, COMPLETED_BY, STATUS
      FROM SERVICE_REQUESTS
      WHERE UPPER(STATUS) = 'COMPLETED'
      ORDER BY ID DESC
    `;
    const rows = await db.query(sql);
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error('Error fetching SR accomplishments:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📋 2. Reconnection Accomplishments (RECONNECTED ONLY)
router.get('/reconnections', async (req, res) => {
  try {
    const sql = `
      SELECT FIRST 200
        ID, REFERENCE_NUMBER, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, 
        METER_NUMBER, NEW_METER_NUMBER, READING, OR_NUMBER, DATE_RECONNECTED, 
        PAID_BY, METER_STATUS, RECEIVED_BY, RECONNECTED_BY, STATUS, 
        PLUMBER_REMARKS, REQUEST_DATE, REQUEST_TIME
      FROM RECONNECTION_REQUESTS
      WHERE UPPER(STATUS) IN ('RECONNECTED', 'COMPLETED')
      ORDER BY ID DESC
    `;
    const rows = await db.query(sql);
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error('Error fetching Recon accomplishments:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 📋 3. New Connections Accomplishments (INSTALLED/COMPLETED ONLY)
router.get('/new-connections', async (req, res) => {
  try {
    const sql = `
      SELECT FIRST 200
        ID, APPLICATION_NUMBER, APPLICANT_NAME, ADDRESS, CONTACT_NUMBER,
        GOVERNMENT_ID, ACCOUNT_REFERENCE, REQUIREMENTS_PASSED, OR_NUMBER,
        DEPOSIT, TRANSFER_DATE, TRANSFER_TIME, ASSIGNED_PLUMBERS,
        INSTALLATION_DATE, INSTALLED_MATERIALS, PLUMBER_REMARKS, STATUS
      FROM NEW_SERVICE_CONNECTIONS
      WHERE UPPER(STATUS) IN ('INSTALLED', 'COMPLETED')
      ORDER BY ID DESC
    `;
    const rows = await db.query(sql);
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error('Error fetching NSC accomplishments:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;