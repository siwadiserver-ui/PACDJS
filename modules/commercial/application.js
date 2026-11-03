const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 🔢 1. Generate Next Application Number: APP-YY-XXXX
router.get('/next-ref', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear().toString().slice(-2);
    const sql = `
      SELECT r.APPLICATION_NUMBER 
      FROM WATER_SERVICE_APPLICATIONS r 
      WHERE r.APPLICATION_NUMBER LIKE ? OR r.APPLICATION_NUMBER LIKE ?
      ORDER BY r.ID DESC
    `;
    const rows = await db.query(sql, [`APP-${currentYear}-%`, `${currentYear}-%`]);

    let highestSeq = 0;
    if (rows && rows.length > 0) {
      for (const r of rows) {
        const val = (r.APPLICATION_NUMBER || '').trim();
        // Kukunin ang pinakahuling grupo ng mga numero (hal. 0289 sa APP-26-0289 o 26-289)
        const match = val.match(/\d+$/);
        if (match) {
          const seq = parseInt(match[0], 10);
          if (!isNaN(seq) && seq > highestSeq) highestSeq = seq;
        }
      }
    }

    const nextSeq = String(highestSeq + 1).padStart(4, '0');
    res.json({ success: true, refNumber: `APP-${currentYear}-${nextSeq}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 📋 2. Fetch Records (Kasama na ang APPLICATION_TYPE)
router.get('/list', async (req, res) => {
  try {
    const sql = `
      SELECT FIRST 200 
        r.ID, 
        r.APPLICATION_NUMBER, 
        r.APPLICATION_TYPE,
        r.APPLICATION_DATE, 
        r.APPLICATION_TIME,
        r.APPLICANT_NAME, 
        r.ADDRESS, 
        r.CONTACT_NUMBER, 
        r.GOVERNMENT_ID,
        r.ACCOUNT_REFERENCE, 
        r.REQUIREMENTS_PASSED, 
        r.STATUS, 
        r.REMARKS,
        r.CREATED_DATE, 
        r.UPDATED_DATE
      FROM WATER_SERVICE_APPLICATIONS r
      ORDER BY r.ID DESC
    `;
    const rows = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error in /api/application/list:', err);
    res.status(500).json({ error: err.message });
  }
});

// 💾 3. Create Record
router.post('/create', async (req, res) => {
  try {
    const {
      application_number,
      application_type,
      application_date,
      application_time,
      applicant_name,
      address,
      contact_number,
      government_id,
      account_reference,
      requirements_passed,
      status,
      remarks
    } = req.body;

    if (!application_number || !applicant_name || !address) {
      return res.status(400).json({ error: 'Application #, Name, at Address ay kailangan!' });
    }

    // Duplicate Check
    const checkSql = `SELECT COUNT(*) AS CNT FROM WATER_SERVICE_APPLICATIONS r WHERE UPPER(r.APPLICATION_NUMBER) = ?`;
    const check = await db.query(checkSql, [application_number.trim().toUpperCase()]);
    if (check && check[0] && (check[0].CNT > 0 || check[0].cnt > 0)) {
      return res.status(400).json({ error: `Ang Application Number ${application_number} ay nagamit na!` });
    }

    const insertSql = `
      INSERT INTO WATER_SERVICE_APPLICATIONS (
        ID, 
        APPLICATION_NUMBER, 
        APPLICATION_TYPE,
        APPLICATION_DATE, 
        APPLICATION_TIME,
        APPLICANT_NAME, 
        ADDRESS, 
        CONTACT_NUMBER, 
        GOVERNMENT_ID,
        ACCOUNT_REFERENCE, 
        REQUIREMENTS_PASSED, 
        STATUS, 
        REMARKS,
        CREATED_DATE, 
        UPDATED_DATE
      ) VALUES (
        GEN_ID(GEN_WATER_APPLICATIONS_ID, 1),
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;

    const params = [
      application_number.trim().toUpperCase(),
      (application_type || 'NSC').trim().toUpperCase(),
      application_date || new Date().toISOString().split('T')[0],
      application_time || new Date().toTimeString().slice(0, 5),
      applicant_name.trim().toUpperCase(),
      address.trim().toUpperCase(),
      (contact_number || '').trim(),
      (government_id || 'N/A').trim().toUpperCase(),
      (account_reference || '').trim(),
      (requirements_passed || '').trim().toUpperCase(),
      (status || 'PENDING').trim().toUpperCase(),
      (remarks || '').trim()
    ];

    await db.query(insertSql, params);
    res.json({ success: true, message: 'Application submitted successfully!' });
  } catch (err) {
    console.error('❌ Error in /api/application/create:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🔄 4. Update Record
router.post('/update', async (req, res) => {
  try {
    const {
      id,
      application_number,
      application_type,
      application_date,
      application_time,
      applicant_name,
      address,
      contact_number,
      government_id,
      account_reference,
      requirements_passed,
      status,
      remarks
    } = req.body;

    const updateSql = `
      UPDATE WATER_SERVICE_APPLICATIONS SET
        APPLICATION_NUMBER = ?,
        APPLICATION_TYPE = ?,
        APPLICATION_DATE = ?,
        APPLICATION_TIME = ?,
        APPLICANT_NAME = ?,
        ADDRESS = ?,
        CONTACT_NUMBER = ?,
        GOVERNMENT_ID = ?,
        ACCOUNT_REFERENCE = ?,
        REQUIREMENTS_PASSED = ?,
        STATUS = ?,
        REMARKS = ?,
        UPDATED_DATE = CURRENT_TIMESTAMP
      WHERE ID = ?
    `;

    const params = [
      application_number.trim().toUpperCase(),
      (application_type || 'NSC').trim().toUpperCase(),
      application_date,
      application_time,
      applicant_name.trim().toUpperCase(),
      address.trim().toUpperCase(),
      (contact_number || '').trim(),
      (government_id || 'N/A').trim().toUpperCase(),
      (account_reference || '').trim(),
      (requirements_passed || '').trim().toUpperCase(),
      (status || 'PENDING').trim().toUpperCase(),
      (remarks || '').trim(),
      id
    ];

    await db.query(updateSql, params);
    res.json({ success: true, message: 'Application updated successfully!' });
  } catch (err) {
    console.error('❌ Error in /api/application/update:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🚀 5. Send to NSC (New Service Connections) - Kapag PAID na at HINDI Change of Name
router.post('/send-to-nsc', async (req, res) => {
  try {
    const { id } = req.body;

    const getSql = `SELECT r.* FROM WATER_SERVICE_APPLICATIONS r WHERE r.ID = ?`;
    const appRows = await db.query(getSql, [id]);

    if (!appRows || appRows.length === 0) {
      return res.status(404).json({ error: 'Record not found.' });
    }

    const app = appRows[0];
    const appType = (app.APPLICATION_TYPE || 'NSC').trim().toUpperCase();

    // 🚫 Check: Bawal ipadala kapag Change of Name (CON)
    if (appType === 'CON' || appType.includes('CHANGE OF NAME')) {
      return res.status(400).json({
        error: `Hindi maaaring ipadala sa NSC ang transaksyong ito dahil ito ay CHANGE OF NAME (${app.APPLICATION_NUMBER}).`
      });
    }

    if ((app.STATUS || '').trim().toUpperCase() !== 'PAID') {
      return res.status(400).json({
        error: `Bawal ipadala sa NSC kapag hindi pa PAID! (Kasalukuyang Status: ${app.STATUS})`
      });
    }

    const chkExist = `SELECT ID FROM NEW_SERVICE_CONNECTIONS WHERE UPPER(APPLICATION_NUMBER) = ?`;
    const existRows = await db.query(chkExist, [app.APPLICATION_NUMBER.trim().toUpperCase()]);
    if (existRows && existRows.length > 0) {
      return res.status(400).json({ error: `APPLICATION ALREADY SENT TO NSC ${app.APPLICATION_NUMBER}!` });
    }

    const insertNsc = `
      INSERT INTO NEW_SERVICE_CONNECTIONS (
        ID,
        APPLICATION_NUMBER, 
        APPLICANT_NAME, 
        ADDRESS, 
        CONTACT_NUMBER,
        GOVERNMENT_ID, 
        ACCOUNT_REFERENCE, 
        REQUIREMENTS_PASSED,
        STATUS, 
        REMARKS, 
        DEPOSIT, 
        CUSTOMERS_DEPOSIT, 
        METER_MAINTENANCE_FEE,
        CREATED_DATE,
        UPDATED_DATE
      ) VALUES (
        GEN_ID(GEN_NEW_SERVICE_CONN_ID, 1),
        ?, ?, ?, ?,
        ?, ?, ?,
        'PENDING', ?, '6000', '400', '500',
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )
    `;

    await db.query(insertNsc, [
      app.APPLICATION_NUMBER,
      app.APPLICANT_NAME,
      app.ADDRESS,
      app.CONTACT_NUMBER,
      app.GOVERNMENT_ID,
      app.ACCOUNT_REFERENCE,
      app.REQUIREMENTS_PASSED,
      app.REMARKS
    ]);

    await db.query(
      `UPDATE WATER_SERVICE_APPLICATIONS SET REMARKS = ?, UPDATED_DATE = CURRENT_TIMESTAMP WHERE ID = ?`,
      ['SENT ALREADY TO NEW SERVICE CONNECTION', id]
    );

    res.json({ success: true, message: `Application ${app.APPLICATION_NUMBER} matagumpay na naipadala sa NSC!` });
  } catch (err) {
    console.error('❌ Error in /api/application/send-to-nsc:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ 6. Delete Record
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    await db.query(`DELETE FROM WATER_SERVICE_APPLICATIONS WHERE ID = ?`, [id]);
    res.json({ success: true, message: 'Application deleted!' });
  } catch (err) {
    console.error('❌ Error in /api/application/delete:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;