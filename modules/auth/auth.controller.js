const db = require('../../config/db');

const AuthController = {
  async login(req, res) {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Pakilagay ang username at password.' });
    }

    try {
      const sql = `
        SELECT ID, USERNAME, FULLNAME, DIVISION, ROLE, STATUS
        FROM USERS
        WHERE UPPER(USERNAME) = UPPER(?) AND "PASSWORD" = ? AND STATUS = 'ACTIVE'
      `;

      const users = await db.query(sql, [username.trim(), password]);

      if (!users || users.length === 0) {
        return res.status(401).json({ success: false, message: 'Maling username o password.' });
      }

      const user = users[0];

      return res.json({
        success: true,
        message: 'Login successful!',
        user: {
          id: user.ID,
          username: user.USERNAME,
          fullname: user.FULLNAME,
          division: user.DIVISION,
          role: user.ROLE
        }
      });

    } catch (error) {
      console.error('Login Error:', error);
      return res.status(500).json({ success: false, message: 'Database login query error.' });
    }
  }
};

module.exports = AuthController;