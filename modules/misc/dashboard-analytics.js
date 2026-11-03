const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 📊 1. DASHBOARD SUMMARY ENDPOINT
router.get('/summary', async (req, res) => {
  try {
    // 1. Service Requests Stats
    const sqlSR = `
      SELECT 
        COUNT(*) AS TOTAL,
        SUM(CASE WHEN UPPER(STATUS) = 'COMPLETED' THEN 1 ELSE 0 END) AS COMPLETED,
        SUM(CASE WHEN UPPER(STATUS) != 'COMPLETED' OR STATUS IS NULL THEN 1 ELSE 0 END) AS PENDING
      FROM SERVICE_REQUESTS
    `;

    // 2. Reconnections Stats
    const sqlRecon = `
      SELECT 
        COUNT(*) AS TOTAL,
        SUM(CASE WHEN UPPER(STATUS) IN ('RECONNECTED', 'COMPLETED') THEN 1 ELSE 0 END) AS RECONNECTED,
        SUM(CASE WHEN UPPER(STATUS) NOT IN ('RECONNECTED', 'COMPLETED') OR STATUS IS NULL THEN 1 ELSE 0 END) AS PENDING
      FROM RECONNECTION_REQUESTS
    `;

    // 3. New Connections Stats
    const sqlNSC = `
      SELECT 
        COUNT(*) AS TOTAL,
        SUM(CASE WHEN UPPER(STATUS) IN ('INSTALLED', 'COMPLETED') THEN 1 ELSE 0 END) AS INSTALLED,
        SUM(CASE WHEN UPPER(STATUS) NOT IN ('INSTALLED', 'COMPLETED') OR STATUS IS NULL THEN 1 ELSE 0 END) AS PENDING
      FROM NEW_SERVICE_CONNECTIONS
    `;

    // 4. Request Types Breakdown (Top 5 categories)
    const sqlSRBreakdown = `
      SELECT FIRST 5 REQUEST_DETAILS, COUNT(*) AS CNT
      FROM SERVICE_REQUESTS
      WHERE REQUEST_DETAILS IS NOT NULL AND REQUEST_DETAILS != ''
      GROUP BY REQUEST_DETAILS
      ORDER BY CNT DESC
    `;

    // 5. 📅 Monthly Complaints Trend (Firebird SQL)
    const sqlMonthly = `
      SELECT 
        EXTRACT(MONTH FROM CAST(REQUEST_DATE AS DATE)) AS MO,
        COUNT(*) AS CNT
      FROM SERVICE_REQUESTS
      WHERE REQUEST_DATE IS NOT NULL
      GROUP BY EXTRACT(MONTH FROM CAST(REQUEST_DATE AS DATE))
      ORDER BY MO ASC
    `;

// 5. Recent Service Requests
    const sqlRecentSR = `
      SELECT FIRST 5 
        'Service Request' AS TYPE, 
        REFERENCE_NUMBER AS REF, 
        ACCOUNT_NAME AS NAME, 
        STATUS
      FROM SERVICE_REQUESTS
      ORDER BY ID DESC
    `;

    // 6. Recent Reconnections
    const sqlRecentRecon = `
      SELECT FIRST 5 
        'Reconnection' AS TYPE, 
        REFERENCE_NUMBER AS REF, 
        ACCOUNT_NAME AS NAME, 
        STATUS
      FROM RECONNECTION_REQUESTS
      ORDER BY ID DESC
    `;

    const [srRes, reconRes, nscRes, breakdownRes, monthlyRes, recentSR, recentRecon] = await Promise.all([
      db.query(sqlSR),
      db.query(sqlRecon),
      db.query(sqlNSC),
      db.query(sqlSRBreakdown),
      db.query(sqlMonthly),
      db.query(sqlRecentSR).catch(err => { console.warn('Recent SR error:', err.message); return []; }),
      db.query(sqlRecentRecon).catch(err => { console.warn('Recent Recon error:', err.message); return []; })
    ]);

    // Pagsamahin ang dalawa (Salitan/Interleaved para siguradong kita agad pareho)
    const combinedRecent = [];
    const maxLen = Math.max((recentSR || []).length, (recentRecon || []).length);
    for (let i = 0; i < maxLen; i++) {
      if (recentSR && recentSR[i]) combinedRecent.push(recentSR[i]);
      if (recentRecon && recentRecon[i]) combinedRecent.push(recentRecon[i]);
    }

    const sr = srRes[0] || { TOTAL: 0, COMPLETED: 0, PENDING: 0 };
    const recon = reconRes[0] || { TOTAL: 0, RECONNECTED: 0, PENDING: 0 };
    const nsc = nscRes[0] || { TOTAL: 0, INSTALLED: 0, PENDING: 0 };

    res.json({
      success: true,
      data: {
        metrics: {
          srTotal: sr.TOTAL || 0,
          srCompleted: sr.COMPLETED || 0,
          srPending: sr.PENDING || 0,
          reconTotal: recon.TOTAL || 0,
          reconCompleted: recon.RECONNECTED || 0,
          reconPending: recon.PENDING || 0,
          nscTotal: nsc.TOTAL || 0,
          nscCompleted: nsc.INSTALLED || 0,
          nscPending: nsc.PENDING || 0
        },
        breakdown: breakdownRes || [],
        monthly: monthlyRes || [],
        recent: combinedRecent // 👈 Eto ang ipapasa sa frontend
      }
    });

  } catch (err) {
    console.error('Error fetching dashboard analytics:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 🔍 2. DEDICATED GLOBAL SEARCH ENDPOINT (Ref No, Account No, Name LAMANG)
router.get('/global-search', async (req, res) => {
  const query = (req.query.q || '').trim();
  if (!query) {
    return res.json({ success: true, data: [] });
  }

  const searchParam = `%${query}%`;
  let combinedResults = [];

  // 1. Hanapin sa SERVICE_REQUESTS
  try {
    const sqlSR = `
      SELECT FIRST 20 
        'SERVICE REQUEST' AS MODULE_TYPE, 
        COALESCE(REFERENCE_NUMBER, '') AS REF_NO, 
        COALESCE(ACCOUNT_NUMBER, '') AS ACCOUNT_NO, 
        COALESCE(ACCOUNT_NAME, '') AS ACCOUNT_NAME, 
        COALESCE(STATUS, 'PENDING') AS STATUS, 
        '/commercial/service-request.html' AS TARGET_URL
      FROM SERVICE_REQUESTS
      WHERE UPPER(COALESCE(REFERENCE_NUMBER, '')) LIKE UPPER(?)
         OR UPPER(COALESCE(ACCOUNT_NUMBER, '')) LIKE UPPER(?)
         OR UPPER(COALESCE(ACCOUNT_NAME, '')) LIKE UPPER(?)
    `;
    const srRows = await db.query(sqlSR, [searchParam, searchParam, searchParam]);
    if (srRows && srRows.length) combinedResults.push(...srRows);
  } catch (err) {
    console.error('SR Search query warning:', err.message);
  }

  // 2. Hanapin sa RECONNECTION_REQUESTS
  try {
    const sqlRecon = `
      SELECT FIRST 20 
        'RECONNECTION' AS MODULE_TYPE, 
        COALESCE(REFERENCE_NUMBER, '') AS REF_NO, 
        COALESCE(ACCOUNT_NUMBER, '') AS ACCOUNT_NO, 
        COALESCE(ACCOUNT_NAME, '') AS ACCOUNT_NAME, 
        COALESCE(STATUS, 'PENDING') AS STATUS, 
        '/commercial/reconnection.html' AS TARGET_URL
      FROM RECONNECTION_REQUESTS
      WHERE UPPER(COALESCE(REFERENCE_NUMBER, '')) LIKE UPPER(?)
         OR UPPER(COALESCE(ACCOUNT_NUMBER, '')) LIKE UPPER(?)
         OR UPPER(COALESCE(ACCOUNT_NAME, '')) LIKE UPPER(?)
    `;
    const reconRows = await db.query(sqlRecon, [searchParam, searchParam, searchParam]);
    if (reconRows && reconRows.length) combinedResults.push(...reconRows);
  } catch (err) {
    console.error('Recon Search query warning:', err.message);
  }

  // 3. Hanapin sa NEW_SERVICE_CONNECTIONS
  try {
    const sqlNSC = `
      SELECT FIRST 20 
        'NEW CONNECTION' AS MODULE_TYPE, 
        COALESCE(APPLICATION_NUMBER, '') AS REF_NO, 
        COALESCE(ACCOUNT_REFERENCE, '') AS ACCOUNT_NO, 
        COALESCE(APPLICANT_NAME, '') AS ACCOUNT_NAME, 
        COALESCE(STATUS, 'PENDING') AS STATUS, 
        '/commercial/new-service-connection.html' AS TARGET_URL
      FROM NEW_SERVICE_CONNECTIONS
      WHERE UPPER(COALESCE(APPLICATION_NUMBER, '')) LIKE UPPER(?)
         OR UPPER(COALESCE(ACCOUNT_REFERENCE, '')) LIKE UPPER(?)
         OR UPPER(COALESCE(APPLICANT_NAME, '')) LIKE UPPER(?)
    `;
    const nscRows = await db.query(sqlNSC, [searchParam, searchParam, searchParam]);
    if (nscRows && nscRows.length) combinedResults.push(...nscRows);
  } catch (err) {
    console.error('NSC Search query warning:', err.message);
  }

  res.json({ success: true, data: combinedResults });
});

module.exports = router;