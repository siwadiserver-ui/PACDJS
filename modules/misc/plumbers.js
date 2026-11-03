const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 📋 1. List All Plumbers
router.get('/list', async (req, res) => {
  try {
    const onlyActive = req.query.active === 'true';
    let sql = `SELECT ID, NAME, CATEGORY, IS_ACTIVE FROM PLUMBERS`;
    
    if (onlyActive) {
      sql += ` WHERE IS_ACTIVE = 1`;
    }
    sql += ` ORDER BY CATEGORY DESC, NAME ASC`;

    const rows = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error in /api/plumbers/list:', err);
    res.status(500).json({ error: err.message });
  }
});

// 💾 2. Add New Plumber
router.post('/create', async (req, res) => {
  try {
    const { name, category, active } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Pangalan ng tubero ay kailangan!' });
    }

    const checkSql = `SELECT 1 FROM PLUMBERS WHERE UPPER(NAME) = ?`;
    const exist = await db.query(checkSql, [name.trim().toUpperCase()]);
    if (exist && exist.length > 0) {
      return res.status(400).json({ error: 'Nasa listahan na ang tubero na ito!' });
    }

    const insertSql = `
      INSERT INTO PLUMBERS (ID, NAME, CATEGORY, IS_ACTIVE, CREATED_DATE)
      VALUES (GEN_ID(GEN_PLUMBERS_ID, 1), ?, ?, ?, CURRENT_TIMESTAMP)
    `;

    await db.query(insertSql, [
      name.trim().toUpperCase(),
      (category || 'REGULAR').trim().toUpperCase(),
      active ? 1 : 0
    ]);

    res.json({ success: true, message: 'Plumber added successfully!' });
  } catch (err) {
    console.error('❌ Error in /api/plumbers/create:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔄 3. Update Plumber
router.post('/update', async (req, res) => {
  try {
    const { id, name, category, active } = req.body;

    if (!id || !name) {
      return res.status(400).json({ error: 'ID at Name ay kailangan.' });
    }

    const updateSql = `
      UPDATE PLUMBERS SET 
        NAME = ?, 
        CATEGORY = ?, 
        IS_ACTIVE = ? 
      WHERE ID = ?
    `;

    await db.query(updateSql, [
      name.trim().toUpperCase(),
      (category || 'REGULAR').trim().toUpperCase(),
      active ? 1 : 0,
      id
    ]);

    res.json({ success: true, message: 'Plumber details updated!' });
  } catch (err) {
    console.error('❌ Error in /api/plumbers/update:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ 4. Delete Plumber
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    await db.query(`DELETE FROM PLUMBERS WHERE ID = ?`, [id]);
    res.json({ success: true, message: 'Plumber deleted from pool!' });
  } catch (err) {
    console.error('❌ Error in /api/plumbers/delete:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;