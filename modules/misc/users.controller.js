const db = require('../../config/db');

const UsersController = {
  // 1. Kuhanin ang active staff para sa "Received By" dropdown
  async getActiveReceivers(req, res) {
    try {
      const sql = `
        SELECT ID, USERNAME, FULL_NAME, DIVISION, ROLE 
        FROM USERS 
        WHERE IS_ACTIVE = 1 
        ORDER BY DIVISION ASC, FULL_NAME ASC
      `;
      const rows = await db.query(sql);
      res.json({ success: true, data: rows || [] });
    } catch (err) {
      console.error('Get Active Receivers Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 2. Kuhanin ang lahat para sa Management Panel (KASAMA ANG PASSWORD PARA KITA ANG DATI)
  async getAllUsers(req, res) {
    try {
      const sql = `SELECT ID, USERNAME, "PASSWORD", FULL_NAME, DIVISION, ROLE, IS_ACTIVE FROM USERS ORDER BY ID ASC`;
      const rows = await db.query(sql);
      res.json({ success: true, data: rows || [] });
    } catch (err) {
      console.error('Get All Users Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 3. Magdagdag ng bagong user/staff
  async addUser(req, res) {
    const { username, password, fullName, division, role } = req.body;
    if (!username || !password || !division) {
      return res.status(400).json({ success: false, message: 'Kulang ang mandatory fields (Username, Password, Division).' });
    }

    try {
      const cleanUser = username.trim().toUpperCase();
      const cleanPass = password.trim();
      const cleanName = (fullName || username).trim().toUpperCase();
      const cleanDiv = division.trim().toUpperCase();
      const cleanRole = (role || 'STAFF').trim().toUpperCase();

      const sql = `
        INSERT INTO USERS (ID, USERNAME, "PASSWORD", FULL_NAME, DIVISION, ROLE, IS_ACTIVE)
        VALUES (GEN_ID(GEN_USERS_ID, 1), ?, ?, ?, ?, ?, 1)
      `;

      await db.query(sql, [cleanUser, cleanPass, cleanName, cleanDiv, cleanRole]);
      res.json({ success: true, message: `Matagumpay na nairehistro si ${cleanUser}!` });

    } catch (err) {
      console.error('Add User Database Error:', err);
      res.status(500).json({ success: false, message: 'Database insert failed: ' + err.message });
    }
  },

  // 4. I-update ang User Info (Full Name, Division, Role, Active Status)
  async updateUser(req, res) {
    const { id, username, fullName, division, role, isActive } = req.body;
    if (!id || !username || !division) {
      return res.status(400).json({ success: false, message: 'Kulang ang mandatory fields.' });
    }

    try {
      const cleanUser = username.trim().toUpperCase();
      const cleanName = (fullName || username).trim().toUpperCase();
      const cleanDiv = division.trim().toUpperCase();
      const cleanRole = (role || 'STAFF').trim().toUpperCase();
      const activeFlag = isActive ? 1 : 0;

      const sql = `
        UPDATE USERS SET 
          USERNAME = ?, 
          FULL_NAME = ?, 
          DIVISION = ?, 
          ROLE = ?, 
          IS_ACTIVE = ?
        WHERE ID = ?
      `;

      await db.query(sql, [cleanUser, cleanName, cleanDiv, cleanRole, activeFlag, id]);
      res.json({ success: true, message: `Na-update ang account ni ${cleanUser}!` });
    } catch (err) {
      console.error('Update User Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 5. Pagpapalit ng Password (Gamit ang ID)
  async changePassword(req, res) {
    const { id, newPassword } = req.body;
    if (!id || !newPassword || !newPassword.trim()) {
      return res.status(400).json({ success: false, message: 'Kailangan ang User ID at Bagong Password.' });
    }

    try {
      const cleanPass = newPassword.trim();
      const sql = `UPDATE USERS SET "PASSWORD" = ? WHERE ID = ?`;
      await db.query(sql, [cleanPass, id]);
      res.json({ success: true, message: 'Matagumpay na napalitan ang password!' });
    } catch (err) {
      console.error('Change Password Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 6. Burahin ang user
  async deleteUser(req, res) {
    const { id } = req.params;
    try {
      await db.query(`DELETE FROM USERS WHERE ID = ?`, [id]);
      res.json({ success: true, message: 'User deleted!' });
    } catch (err) {
      console.error('Delete User Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = UsersController;