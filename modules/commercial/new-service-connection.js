const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 📋 1. Fetch List
router.get('/list', async (req, res) => {
  try {
    const sql = `
      SELECT FIRST 200 
        r.ID, 
        r.APPLICATION_NUMBER, 
        r.APPLICANT_NAME, 
        r.ADDRESS,
        r.CONTACT_NUMBER, 
        r.GOVERNMENT_ID, 
        r.ACCOUNT_REFERENCE,
        r.REQUIREMENTS_PASSED, 
        r.OR_NUMBER, 
        r.REMARKS, 
        r.DEPOSIT,
        r.CUSTOMERS_DEPOSIT, 
        r.METER_MAINTENANCE_FEE, 
        r.TRANSFER_DATE,
        r.TRANSFER_TIME, 
        r.ASSIGNED_PLUMBERS, 
        r.INSTALLATION_DATE,
        r.INSTALLED_MATERIALS, 
        r.PLUMBER_REMARKS, 
        r.UPDATED_BY,
        r.STATUS, 
        r.CREATED_DATE,
        r.UPDATED_DATE
      FROM NEW_SERVICE_CONNECTIONS r
      ORDER BY r.ID DESC
    `;
    const rows = await db.query(sql);
    res.json(rows);
  } catch (err) {
    console.error('❌ Error in /api/nsc/list:', err);
    res.status(500).json({ error: err.message });
  }
});

// 💾 2. Save / Update Record (GOVERNMENT_ID ay naka-default sa 'N/A')
router.post('/save', async (req, res) => {
  try {
    const {
      id,
      application_number,
      applicant_name,
      address,
      contact_number,
      account_reference,
      requirements_passed,
      or_number,
      deposit,
      customers_deposit,
      meter_maintenance_fee,
      transfer_date,
      transfer_time,
      remarks
    } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Pumili muna ng record na i-eedit.' });
    }

    const updateSql = `
      UPDATE NEW_SERVICE_CONNECTIONS SET
        APPLICATION_NUMBER = ?,
        APPLICANT_NAME = ?,
        ADDRESS = ?,
        CONTACT_NUMBER = ?,
        GOVERNMENT_ID = 'N/A',
        ACCOUNT_REFERENCE = ?,
        REQUIREMENTS_PASSED = ?,
        OR_NUMBER = ?,
        DEPOSIT = ?,
        CUSTOMERS_DEPOSIT = ?,
        METER_MAINTENANCE_FEE = ?,
        TRANSFER_DATE = ?,
        TRANSFER_TIME = ?,
        REMARKS = ?,
        UPDATED_DATE = CURRENT_TIMESTAMP
      WHERE ID = ?
    `;

    const params = [
      (application_number || '').trim().toUpperCase(),
      (applicant_name || '').trim().toUpperCase(),
      (address || '').trim().toUpperCase(),
      (contact_number || '').trim(),
      (account_reference || '').trim(),
      (requirements_passed || '').trim().toUpperCase(),
      (or_number || '').trim(),
      deposit || '6000',
      customers_deposit || '400',
      meter_maintenance_fee || '500',
      transfer_date || null,
      transfer_time || null,
      (remarks || '').trim(),
      id
    ];

    await db.query(updateSql, params);
    res.json({ success: true, message: `Connection record for ${application_number} updated successfully!` });
  } catch (err) {
    console.error('❌ Error in /api/nsc/save:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🚀 3. Send to Engineering (May Validation kung naipadala na)
router.post('/send-to-engineering', async (req, res) => {
  try {
    const { id, application_number, account_reference } = req.body;

    if (!id || !application_number) {
      return res.status(400).json({ error: 'Kailangan ang Record ID at Application Number.' });
    }

    // 🛑 VALIDATION: I-check kung ano ang kasalukuyang STATUS sa database
    const checkSql = `SELECT STATUS FROM NEW_SERVICE_CONNECTIONS WHERE ID = ?`;
    const checkRows = await db.query(checkSql, [id]);

    if (!checkRows || checkRows.length === 0) {
      return res.status(404).json({ error: 'Hindi mahanap ang record sa New Service Connections.' });
    }

    const currentStatus = (checkRows[0].STATUS || '').trim().toUpperCase();

    if (currentStatus === 'SENT TO ENGINEERING') {
      return res.status(400).json({ 
        error: `Naipadala na sa Engineering ang Application ${application_number}! Hindi na kailangang ipadala muli.` 
      });
    }

    if (currentStatus === 'COMPLETED' || currentStatus === 'INSTALLED') {
      return res.status(400).json({ 
        error: `Hindi na maaaring ipadala sa Engineering dahil ito ay ${currentStatus} na.` 
      });
    }

    // Update NEW_SERVICE_CONNECTIONS
    const updateNscSql = `
      UPDATE NEW_SERVICE_CONNECTIONS SET 
        GOVERNMENT_ID = 'N/A', 
        ACCOUNT_REFERENCE = ?, 
        STATUS = 'SENT TO ENGINEERING', 
        REMARKS = 'SENT ALREADY TO ENGINEERING',
        PLUMBER_REMARKS = NULL,
        UPDATED_DATE = CURRENT_TIMESTAMP
      WHERE ID = ?
    `;
    await db.query(updateNscSql, [account_reference || '', id]);

    // Sync status/remarks sa WATER_SERVICE_APPLICATIONS
    const updateAppSql = `
      UPDATE WATER_SERVICE_APPLICATIONS SET 
        REMARKS = 'SENT ALREADY TO ENGINEERING',
        UPDATED_DATE = CURRENT_TIMESTAMP
      WHERE UPPER(APPLICATION_NUMBER) = ?
    `;
    await db.query(updateAppSql, [application_number.trim().toUpperCase()]);

    res.json({ success: true, message: `Application ${application_number} successfully sent to Engineering!` });
  } catch (err) {
    console.error('❌ Error in /api/nsc/send-to-engineering:', err);
    res.status(500).json({ error: err.message });
  }
});

// 👁️ 4. View Installation Details
router.get('/installation-details/:appNo', async (req, res) => {
  try {
    const { appNo } = req.params;
    const sql = `
      SELECT FIRST 1
        r.ID,
        r.APPLICATION_NUMBER, 
        r.APPLICANT_NAME, 
        r.ADDRESS, 
        r.CONTACT_NUMBER,
        r.ACCOUNT_REFERENCE,
        r.OR_NUMBER,
        r.STATUS,
        r.ASSIGNED_PLUMBERS, 
        r.INSTALLATION_DATE, 
        r.INSTALLED_MATERIALS, 
        r.PLUMBER_REMARKS,
        r.UPDATED_BY
      FROM NEW_SERVICE_CONNECTIONS r 
      WHERE UPPER(r.APPLICATION_NUMBER) = ?
    `;
    const rows = await db.query(sql, [appNo.trim().toUpperCase()]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Hindi mahanap ang record.' });
    }
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ 5. Delete Record
router.post('/delete', async (req, res) => {
  try {
    const { id } = req.body;
    await db.query(`DELETE FROM NEW_SERVICE_CONNECTIONS WHERE ID = ?`, [id]);
    res.json({ success: true, message: 'Record deleted successfully!' });
  } catch (err) {
    console.error('❌ Error in /api/nsc/delete:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;