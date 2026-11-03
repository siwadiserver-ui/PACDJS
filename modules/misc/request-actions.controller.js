const db = require('../../config/db');

const RequestActionsController = {
  // 1. Kuhanin ang Active List (Para sa dropdown / checklist)
  async getActiveList(req, res) {
    try {
      const sql = `
        SELECT ID, ACTION_NAME, CATEGORY 
        FROM REQUEST_ACTIONS_CONFIG 
        WHERE IS_ACTIVE = 1 
        ORDER BY DISPLAY_ORDER ASC, ACTION_NAME ASC
      `;
      const rows = await db.query(sql);
      res.json({ success: true, data: rows || [] });
    } catch (err) {
      console.error('Fetch Active Actions Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 2. Kuhanin ang Lahat para sa Management Panel
  async getAllList(req, res) {
    try {
      const sql = `
        SELECT ID, ACTION_NAME, CATEGORY, IS_ACTIVE, DISPLAY_ORDER 
        FROM REQUEST_ACTIONS_CONFIG 
        ORDER BY DISPLAY_ORDER ASC, ID ASC
      `;
      const rows = await db.query(sql);
      res.json({ success: true, data: rows || [] });
    } catch (err) {
      console.error('Fetch All Actions Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 3. Magdagdag ng Bagong Action
  async createAction(req, res) {
    const { actionName, category, displayOrder } = req.body;
    if (!actionName || !actionName.trim()) {
      return res.status(400).json({ success: false, message: 'Action name is required.' });
    }

    try {
      const cleanName = actionName.trim().toUpperCase();
      const order = parseInt(displayOrder, 10) || 0;

      const sql = `
        INSERT INTO REQUEST_ACTIONS_CONFIG (ID, ACTION_NAME, CATEGORY, IS_ACTIVE, DISPLAY_ORDER)
        VALUES (GEN_ID(GEN_REQ_ACTIONS_ID, 1), ?, ?, 1, ?)
      `;
      await db.query(sql, [cleanName, category || 'SERVICE_REQUEST', order]);
      res.json({ success: true, message: `Successfully added "${cleanName}"` });
    } catch (err) {
      console.error('Create Action Error:', err);
      res.status(500).json({ success: false, message: 'Failed to add action: ' + err.message });
    }
  },

  // 4. I-update ang Action
  async updateAction(req, res) {
    const { id, actionName, category, isActive, displayOrder } = req.body;
    if (!id || !actionName) {
      return res.status(400).json({ success: false, message: 'ID and Action Name are required.' });
    }

    try {
      const sql = `
        UPDATE REQUEST_ACTIONS_CONFIG 
        SET ACTION_NAME = ?, CATEGORY = ?, IS_ACTIVE = ?, DISPLAY_ORDER = ?
        WHERE ID = ?
      `;
      await db.query(sql, [
        actionName.trim().toUpperCase(),
        category || 'SERVICE_REQUEST',
        isActive ? 1 : 0,
        parseInt(displayOrder, 10) || 0,
        id
      ]);
      res.json({ success: true, message: 'Successfully updated!' });
    } catch (err) {
      console.error('Update Action Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 5. Burahin ang Action
  async deleteAction(req, res) {
    const { id } = req.params;
    try {
      await db.query(`DELETE FROM REQUEST_ACTIONS_CONFIG WHERE ID = ?`, [id]);
      res.json({ success: true, message: 'Successfully deleted!' });
    } catch (err) {
      console.error('Delete Action Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = RequestActionsController;