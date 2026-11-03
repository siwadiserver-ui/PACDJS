const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 📋 1. I-update ang /list route upang tumanggap ng `is_senior` filter
router.get('/list', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 50);
    const search = (req.query.search || '').trim().toUpperCase();
    const isSeniorFilter = req.query.is_senior === '1'; // 👈 Bagong Filter
    let zone = (req.query.zone || '').trim();

    if (zone && zone.length === 1 && !isNaN(zone)) {
      zone = zone.padStart(2, '0');
    }

    const startRow = (page - 1) * limit + 1;
    const endRow = page * limit;

    let conditions = [];
    let params = [];

    // 📍 Zone Filter
    if (zone) {
      conditions.push(`c.ACCOUNT_NUMBER STARTING WITH ?`);
      params.push(zone);
    }

    // 🔍 Search Filter
    if (search) {
      conditions.push(`(UPPER(c.ACCOUNT_NUMBER) CONTAINING ? OR UPPER(c.ACCOUNT_NAME) CONTAINING ? OR UPPER(c.ADDRESS) CONTAINING ?)`);
      params.push(search, search, search);
    }

    // 🧓 Senior Citizen Filter
    if (isSeniorFilter) {
      conditions.push(`g.IS_SENIOR = 1`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 1. Bilangin ang kabuuang records
    const countSql = `
      SELECT COUNT(*) AS TOTAL_CNT 
      FROM CUSTOMER_DATABASE c
      LEFT JOIN CUSTOMER_GAD_PROFILES g ON c.ACCOUNT_NUMBER = g.ACCOUNT_NUMBER
      ${whereClause}
    `;
    const countRes = await db.query(countSql, params);
    const totalRecords = countRes && countRes[0] ? Number(countRes[0].TOTAL_CNT || countRes[0].total_cnt || 0) : 0;
    const totalPages = Math.ceil(totalRecords / limit) || 1;

    // 2. Kuhanin ang data
    const dataSql = `
      SELECT 
        c.ID,
        c.ACCOUNT_NUMBER,
        c.ACCOUNT_NAME,
        c.ADDRESS,
        COALESCE(g.IS_SENIOR, 0) AS IS_SENIOR,
        COALESCE(g.IS_SOLO_PARENT, 0) AS IS_SOLO_PARENT,
        COALESCE(g.IS_PWD, 0) AS IS_PWD,
        COALESCE(g.IS_INDIGENT, 0) AS IS_INDIGENT,
        g.GENDER
      FROM CUSTOMER_DATABASE c
      LEFT JOIN CUSTOMER_GAD_PROFILES g ON c.ACCOUNT_NUMBER = g.ACCOUNT_NUMBER
      ${whereClause}
      ORDER BY c.ACCOUNT_NUMBER ASC
      ROWS ? TO ?
    `;

    const queryParams = [...params, startRow, endRow];
    const rows = await db.query(dataSql, queryParams);

    res.json({
      data: rows || [],
      page,
      limit,
      totalRecords,
      totalPages
    });
  } catch (err) {
    console.error('❌ Error in /api/gad/list:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🧓 2. Kunin ang LAHAT ng Senior Citizens para sa buong Listahan / Master Export
router.get('/seniors/all', async (req, res) => {
  try {
    let zone = (req.query.zone || '').trim();
    if (zone && zone.length === 1 && !isNaN(zone)) {
      zone = zone.padStart(2, '0');
    }

    let whereClause = 'WHERE g.IS_SENIOR = 1';
    let params = [];

    if (zone) {
      whereClause += ' AND c.ACCOUNT_NUMBER STARTING WITH ?';
      params.push(zone);
    }

    const sql = `
      SELECT 
        c.ACCOUNT_NUMBER,
        c.ACCOUNT_NAME,
        c.ADDRESS,
        g.GENDER,
        COALESCE(g.IS_PWD, 0) AS IS_PWD,
        COALESCE(g.IS_SOLO_PARENT, 0) AS IS_SOLO_PARENT,
        COALESCE(g.IS_INDIGENT, 0) AS IS_INDIGENT
      FROM CUSTOMER_DATABASE c
      INNER JOIN CUSTOMER_GAD_PROFILES g ON c.ACCOUNT_NUMBER = g.ACCOUNT_NUMBER
      ${whereClause}
      ORDER BY c.ACCOUNT_NUMBER ASC
    `;

    const rows = await db.query(sql, params);
    res.json({ success: true, count: rows.length, data: rows || [] });
  } catch (err) {
    console.error('❌ Error fetching all seniors:', err);
    res.status(500).json({ error: err.message });
  }
});

// 💾 Save GAD data via ACCOUNT_NUMBER (UPDATE OR INSERT)
router.post('/save', async (req, res) => {
  try {
    const { account_number, is_senior, is_solo_parent, is_pwd, is_indigent, gender, user_role, user_division } = req.body;

    const role = String(user_role || '').toUpperCase();
    const division = String(user_division || '').toUpperCase();

    if (role === 'ENGINEERING' || division === 'ENGINEERING') {
      return res.status(403).json({ error: 'Bawal mag-edit ang Engineering Division sa GAD Profiling.' });
    }

    if (!account_number) {
      return res.status(400).json({ error: 'Kailangan ang Account Number ng customer.' });
    }

    const cleanAccNo = String(account_number).trim();

    const sql = `
      UPDATE OR INSERT INTO CUSTOMER_GAD_PROFILES (
        ACCOUNT_NUMBER,
        IS_SENIOR,
        IS_SOLO_PARENT,
        IS_PWD,
        IS_INDIGENT,
        GENDER,
        UPDATED_DATE
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      MATCHING (ACCOUNT_NUMBER)
    `;

    await db.query(sql, [
      cleanAccNo,
      is_senior ? 1 : 0,
      is_solo_parent ? 1 : 0,
      is_pwd ? 1 : 0,
      is_indigent ? 1 : 0,
      gender ? String(gender).trim().toUpperCase() : null
    ]);

    res.json({ success: true, message: 'Customer GAD Profiling successfully saved!' });
  } catch (err) {
    console.error('❌ Error in /api/gad/save:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🧹 Clear GAD tags
router.post('/reset-tag', async (req, res) => {
  try {
    const { account_number, user_role, user_division } = req.body;

    const role = String(user_role || '').toUpperCase();
    const division = String(user_division || '').toUpperCase();

    if (role === 'ENGINEERING' || division === 'ENGINEERING') {
      return res.status(403).json({ error: 'Bawal magbago ang Engineering Division sa GAD Profiling.' });
    }

    if (!account_number) {
      return res.status(400).json({ error: 'Kailangan ang Account Number.' });
    }

    const cleanAccNo = String(account_number).trim();
    await db.query(`DELETE FROM CUSTOMER_GAD_PROFILES WHERE ACCOUNT_NUMBER = ?`, [cleanAccNo]);

    res.json({ success: true, message: 'Customer GAD tags cleared/reset.' });
  } catch (err) {
    console.error('❌ Error in /api/gad/reset-tag:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📊 GAD Demographics Summary (Mabilis: Direct SQL Aggregation)
router.get('/summary', async (req, res) => {
  try {
    let zone = (req.query.zone || '').trim();
    if (zone && zone.length === 1 && !isNaN(zone)) {
      zone = zone.padStart(2, '0');
    }

    let whereTotal = '';
    let whereProfile = '';
    let params = [];

    if (zone) {
      whereTotal = 'WHERE c.ACCOUNT_NUMBER STARTING WITH ?';
      whereProfile = 'WHERE g.ACCOUNT_NUMBER STARTING WITH ?';
      params.push(zone);
    }

    // 1. Bilang ng kabuuang konsyumer
    const countSql = `SELECT COUNT(*) AS TOTAL_CNT FROM CUSTOMER_DATABASE c ${whereTotal}`;
    
    // 2. Direct SQL Sum Aggregation (Mabilis at walang memory leak)
    const profileSql = `
      SELECT 
        SUM(CASE WHEN UPPER(TRIM(g.GENDER)) IN ('MALE', 'M') THEN 1 ELSE 0 END) AS MALE_CNT,
        SUM(CASE WHEN UPPER(TRIM(g.GENDER)) IN ('FEMALE', 'F') THEN 1 ELSE 0 END) AS FEMALE_CNT,
        SUM(CASE WHEN UPPER(TRIM(g.GENDER)) IN ('OTHERS', 'OTHER', 'O', 'LGBTQ+') THEN 1 ELSE 0 END) AS OTHERS_CNT,
        SUM(CASE WHEN COALESCE(g.IS_SENIOR, 0) = 1 THEN 1 ELSE 0 END) AS SENIOR_CNT,
        SUM(CASE WHEN COALESCE(g.IS_PWD, 0) = 1 THEN 1 ELSE 0 END) AS PWD_CNT,
        SUM(CASE WHEN COALESCE(g.IS_SOLO_PARENT, 0) = 1 THEN 1 ELSE 0 END) AS SOLO_CNT,
        SUM(CASE WHEN COALESCE(g.IS_INDIGENT, 0) = 1 THEN 1 ELSE 0 END) AS INDIGENT_CNT
      FROM CUSTOMER_GAD_PROFILES g
      ${whereProfile}
    `;

    const [countRes, profileRes] = await Promise.all([
      db.query(countSql, params),
      db.query(profileSql, params)
    ]);

    const total = countRes && countRes[0] ? Number(countRes[0].TOTAL_CNT || countRes[0].total_cnt || 0) : 0;
    const p = profileRes && profileRes[0] ? profileRes[0] : {};

    const male = Number(p.MALE_CNT || p.male_cnt || 0);
    const female = Number(p.FEMALE_CNT || p.female_cnt || 0);
    const others = Number(p.OTHERS_CNT || p.others_cnt || 0);

    const senior = Number(p.SENIOR_CNT || p.senior_cnt || 0);
    const pwd = Number(p.PWD_CNT || p.pwd_cnt || 0);
    const soloParent = Number(p.SOLO_CNT || p.solo_cnt || 0);
    const indigent = Number(p.INDIGENT_CNT || p.indigent_cnt || 0);

    // Tamang pagtantiya sa walang gender profile tag
    const taggedGenderTotal = male + female + others;
    const untagged = Math.max(0, total - taggedGenderTotal);

    res.json({
      success: true,
      zone: zone || 'ALL',
      total,
      gender: { male, female, others, untagged },
      sectors: { senior, pwd, soloParent, indigent }
    });
  } catch (err) {
    console.error('❌ Error in /api/gad/summary:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔄 Auto-Sync: I-tag bilang Senior Citizen sa GAD ang lahat ng nasa Senior Citizen Applications
router.post('/sync-seniors', async (req, res) => {
  try {
    // 1. Kunin ang lahat ng unique Account Numbers mula sa Senior Citizen module
    const seniorSql = `
      SELECT DISTINCT TRIM(ACCOUNT_NUMBER) AS ACCOUNT_NUMBER
      FROM SENIOR_CITIZEN_APPLICATIONS
      WHERE ACCOUNT_NUMBER IS NOT NULL 
        AND TRIM(ACCOUNT_NUMBER) != ''
        AND COALESCE(STATUS, 'ACTIVE') NOT IN ('REJECTED', 'CANCELLED')
    `;
    const seniorRows = await db.query(seniorSql);

    if (!seniorRows || seniorRows.length === 0) {
      return res.json({ success: true, count: 0, message: 'Walang nahanap na tala sa Senior Citizen Applications.' });
    }

    let updatedCount = 0;

    // 2. I-upsert ang bawat senior sa CUSTOMER_GAD_PROFILES (pananatilihin ang ibang existing flags at gender)
    for (const row of seniorRows) {
      const accNo = row.ACCOUNT_NUMBER;

      const upsertSql = `
        UPDATE OR INSERT INTO CUSTOMER_GAD_PROFILES (
          ACCOUNT_NUMBER,
          IS_SENIOR,
          UPDATED_DATE
        ) VALUES (?, 1, CURRENT_TIMESTAMP)
        MATCHING (ACCOUNT_NUMBER)
      `;

      await db.query(upsertSql, [accNo]);
      updatedCount++;
    }

    res.json({
      success: true,
      count: updatedCount,
      message: `Matagumpay na nai-sync at nai-tag ang ${updatedCount} Senior Citizens sa GAD Profiling!`
    });
  } catch (err) {
    console.error('❌ Error syncing seniors to GAD:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;