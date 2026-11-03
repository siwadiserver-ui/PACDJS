const express = require('express');
const router = express.Router();
const db = require('../config/db');

router.get('/latest-events', async (req, res) => {
  try {
    // 1. Service Requests
    const sqlSR = `SELECT FIRST 1 ID, REFERENCE_NUMBER, ACCOUNT_NAME, REQUEST_DETAILS FROM SERVICE_REQUESTS ORDER BY ID DESC`;
    
    // 2. Reconnection Requests
    const sqlRec = `SELECT FIRST 1 ID, REFERENCE_NUMBER, ACCOUNT_NAME FROM RECONNECTION_REQUESTS ORDER BY ID DESC`;
    
    // 3. New Service Connections
    const sqlNSC = `SELECT FIRST 1 ID, APPLICATION_NUMBER, APPLICANT_NAME FROM NEW_SERVICE_CONNECTIONS ORDER BY ID DESC`;

    const [rowsSR, rowsRec, rowsNSC] = await Promise.all([
      db.query(sqlSR).catch(err => { console.error('SR Query Error:', err.message); return []; }),
      db.query(sqlRec).catch(err => { console.error('Recon Query Error:', err.message); return []; }),
      db.query(sqlNSC).catch(err => { console.error('NSC Query Error:', err.message); return []; })
    ]);

    res.json({
      success: true,
      serviceRequest: rowsSR && rowsSR.length > 0 ? rowsSR[0] : null,
      reconnection: rowsRec && rowsRec.length > 0 ? rowsRec[0] : null,
      newConnection: rowsNSC && rowsNSC.length > 0 ? rowsNSC[0] : null
    });
  } catch (err) {
    console.error('Notifications endpoint error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;