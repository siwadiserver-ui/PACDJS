const db = require('../../config/db');

const RequestDetailsController = {
  // 1. Get All Active Details for Service Request Form Dropdown / Modal
  async getActiveList(req, res) {
    try {
      const sql = `
        SELECT ID, DETAIL_NAME, CATEGORY 
        FROM REQUEST_DETAILS_CONFIG 
        WHERE IS_ACTIVE = 1 
        ORDER BY DISPLAY_ORDER ASC, DETAIL_NAME ASC
      `;
      const rows = await db.query(sql);
      res.json({ success: true, data: rows || [] });
    } catch (err) {
      console.error('Fetch Active Details Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 2. Get All (Active & Inactive) for Management Panel
  async getAllList(req, res) {
    try {
      const sql = `
        SELECT ID, DETAIL_NAME, CATEGORY, IS_ACTIVE, DISPLAY_ORDER 
        FROM REQUEST_DETAILS_CONFIG 
        ORDER BY DISPLAY_ORDER ASC, ID ASC
      `;
      const rows = await db.query(sql);
      res.json({ success: true, data: rows || [] });
    } catch (err) {
      console.error('Fetch All Details Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 3. Add New Detail
  async createDetail(req, res) {
    const { detailName, category, displayOrder } = req.body;
    if (!detailName || !detailName.trim()) {
      return res.status(400).json({ success: false, message: 'Detail name is required.' });
    }

    try {
      const cleanName = detailName.trim().toUpperCase();
      const order = parseInt(displayOrder, 10) || 0;

      const sql = `
        INSERT INTO REQUEST_DETAILS_CONFIG (ID, DETAIL_NAME, CATEGORY, IS_ACTIVE, DISPLAY_ORDER)
        VALUES (GEN_ID(GEN_REQ_DETAILS_ID, 1), ?, ?, 1, ?)
      `;
      await db.query(sql, [cleanName, category || 'COMMERCIAL', order]);
      res.json({ success: true, message: `Successfully added "${cleanName}"` });
    } catch (err) {
      console.error('Create Detail Error:', err);
      res.status(500).json({ success: false, message: 'Failed to add detail: ' + err.message });
    }
  },

  // 4. Update Detail Name / Order / Status
  async updateDetail(req, res) {
    const { id, detailName, category, isActive, displayOrder } = req.body;
    if (!id || !detailName) {
      return res.status(400).json({ success: false, message: 'ID and Detail Name are required.' });
    }

    try {
      const sql = `
        UPDATE REQUEST_DETAILS_CONFIG 
        SET DETAIL_NAME = ?, CATEGORY = ?, IS_ACTIVE = ?, DISPLAY_ORDER = ?
        WHERE ID = ?
      `;
      await db.query(sql, [
        detailName.trim().toUpperCase(),
        category || 'COMMERCIAL',
        isActive ? 1 : 0,
        parseInt(displayOrder, 10) || 0,
        id
      ]);
      res.json({ success: true, message: 'Successfully updated!' });
    } catch (err) {
      console.error('Update Detail Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 5. Delete Detail
  async deleteDetail(req, res) {
    const { id } = req.params;
    try {
      await db.query(`DELETE FROM REQUEST_DETAILS_CONFIG WHERE ID = ?`, [id]);
      res.json({ success: true, message: 'Successfully deleted!' });
    } catch (err) {
      console.error('Delete Detail Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = RequestDetailsController;