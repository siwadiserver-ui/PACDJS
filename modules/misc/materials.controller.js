const db = require('../../config/db');

const MaterialsController = {
  // 1. Kuhanin ang Active List (Para sa Engineering Module checklist/dropdowns)
  async getActiveList(req, res) {
    try {
      const sql = `
        SELECT ID, MATERIAL_NAME, CATEGORY 
        FROM MATERIALS_CONFIG 
        WHERE IS_ACTIVE = 1 
        ORDER BY DISPLAY_ORDER ASC, MATERIAL_NAME ASC
      `;
      const rows = await db.query(sql);
      res.json({ success: true, data: rows || [] });
    } catch (err) {
      console.error('Fetch Active Materials Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 2. Kuhanin ang Lahat para sa Materials Manager Panel
  async getAllList(req, res) {
    try {
      const sql = `
        SELECT ID, MATERIAL_NAME, CATEGORY, IS_ACTIVE, DISPLAY_ORDER 
        FROM MATERIALS_CONFIG 
        ORDER BY DISPLAY_ORDER ASC, ID ASC
      `;
      const rows = await db.query(sql);
      res.json({ success: true, data: rows || [] });
    } catch (err) {
      console.error('Fetch All Materials Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 3. Magdagdag ng Bagong Material
  async createMaterial(req, res) {
    const { materialName, category, displayOrder } = req.body;
    if (!materialName || !materialName.trim()) {
      return res.status(400).json({ success: false, message: 'Material name is required.' });
    }

    try {
      const cleanName = materialName.trim().toUpperCase();
      const order = parseInt(displayOrder, 10) || 0;

      const checkSql = `SELECT 1 FROM MATERIALS_CONFIG WHERE UPPER(MATERIAL_NAME) = ?`;
      const exist = await db.query(checkSql, [cleanName]);
      if (exist && exist.length > 0) {
        return res.status(400).json({ success: false, message: 'Material already exists in pool.' });
      }

      const sql = `
        INSERT INTO MATERIALS_CONFIG (ID, MATERIAL_NAME, CATEGORY, IS_ACTIVE, DISPLAY_ORDER)
        VALUES (GEN_ID(GEN_MATERIALS_CONFIG_ID, 1), ?, ?, 1, ?)
      `;
      await db.query(sql, [cleanName, category || 'PLUMBING', order]);
      res.json({ success: true, message: `Successfully added "${cleanName}"` });
    } catch (err) {
      console.error('Create Material Error:', err);
      res.status(500).json({ success: false, message: 'Failed to add material: ' + err.message });
    }
  },

  // 4. I-update ang Material
  async updateMaterial(req, res) {
    const { id, materialName, category, isActive, displayOrder } = req.body;
    if (!id || !materialName) {
      return res.status(400).json({ success: false, message: 'ID and Material Name are required.' });
    }

    try {
      const sql = `
        UPDATE MATERIALS_CONFIG 
        SET MATERIAL_NAME = ?, CATEGORY = ?, IS_ACTIVE = ?, DISPLAY_ORDER = ?
        WHERE ID = ?
      `;
      await db.query(sql, [
        materialName.trim().toUpperCase(),
        category || 'PLUMBING',
        isActive ? 1 : 0,
        parseInt(displayOrder, 10) || 0,
        id
      ]);
      res.json({ success: true, message: 'Successfully updated!' });
    } catch (err) {
      console.error('Update Material Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 5. Burahin ang Material
  async deleteMaterial(req, res) {
    const { id } = req.params;
    try {
      await db.query(`DELETE FROM MATERIALS_CONFIG WHERE ID = ?`, [id]);
      res.json({ success: true, message: 'Successfully deleted!' });
    } catch (err) {
      console.error('Delete Material Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = MaterialsController;