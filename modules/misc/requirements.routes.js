const express = require('express');
const router = express.Router();
const db = require('../../config/db'); // parehong connection pool sa server.js

// 1. Kunin lahat para sa Requirements Manager
router.get('/all', async (req, res) => {
  try {
    const query = `
      SELECT ID, REQUIREMENT_NAME, CATEGORY, DISPLAY_ORDER, IS_ACTIVE, CREATED_DATE
      FROM REQUEST_REQUIREMENTS_CONFIG
      ORDER BY DISPLAY_ORDER ASC, REQUIREMENT_NAME ASC
    `;
    const rows = await db.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching all requirements:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 2. Kunin lamang ang aktibong listahan para sa Application Form
router.get('/active', async (req, res) => {
  try {
    const query = `
      SELECT ID, REQUIREMENT_NAME, DISPLAY_ORDER
      FROM REQUEST_REQUIREMENTS_CONFIG
      WHERE IS_ACTIVE = 1
      ORDER BY DISPLAY_ORDER ASC, REQUIREMENT_NAME ASC
    `;
    const rows = await db.query(query);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('Error fetching active requirements:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 3. Magdagdag ng bagong requirement item
router.post('/add', async (req, res) => {
  try {
    const { requirement_name, display_order } = req.body;
    if (!requirement_name || !requirement_name.trim()) {
      return res.status(400).json({ success: false, message: 'Requirement name is required.' });
    }

    const orderVal = parseInt(display_order, 10) || 0;
    const cleanName = requirement_name.trim().toUpperCase();

    const query = `
      INSERT INTO REQUEST_REQUIREMENTS_CONFIG (REQUIREMENT_NAME, DISPLAY_ORDER, IS_ACTIVE)
      VALUES (?, ?, 1)
    `;
    await db.query(query, [cleanName, orderVal]);

    res.json({ success: true, message: 'Requirement successfully added.' });
  } catch (err) {
    console.error('Error inserting requirement:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// 4. Burahin ang isang requirement
router.delete('/delete/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `DELETE FROM REQUEST_REQUIREMENTS_CONFIG WHERE ID = ?`;
    await db.query(query, [id]);
    res.json({ success: true, message: 'Requirement successfully deleted.' });
  } catch (err) {
    console.error('Error deleting requirement:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;