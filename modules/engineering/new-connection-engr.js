// modules/engineering/new-connection-engr.js
const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 📋 1. Fetch New Service Connections Pool para sa Engineering
router.get('/list', async (req, res) => {
  try {
    const status = req.query.status || 'ALL';
    let sql = `
      SELECT FIRST 300
        n.ID, 
        n.APPLICATION_NUMBER, 
        n.APPLICANT_NAME, 
        n.ADDRESS, 
        n.CONTACT_NUMBER, 
        n.GOVERNMENT_ID, 
        n.ACCOUNT_REFERENCE, 
        n.REQUIREMENTS_PASSED, 
        n.OR_NUMBER, 
        n.REMARKS, 
        n.DEPOSIT, 
        n.CUSTOMERS_DEPOSIT, 
        n.METER_MAINTENANCE_FEE, 
        n.TRANSFER_DATE, 
        n.TRANSFER_TIME, 
        n.ASSIGNED_PLUMBERS, 
        n.INSTALLATION_DATE, 
        n.INSTALLED_MATERIALS, 
        n.PLUMBER_REMARKS,
        n.UPDATED_BY, 
        n.STATUS,
        n.CREATED_DATE
      FROM NEW_SERVICE_CONNECTIONS n
      WHERE 1=1
    `;
    const params = [];

    if (status !== 'ALL') {
      sql += ` AND UPPER(n.STATUS) = ?`;
      params.push(status.toUpperCase());
    }

    sql += ` ORDER BY n.ID DESC`;

    const rows = await db.query(sql, params);
    res.json({ success: true, data: rows || [] });
  } catch (err) {
    console.error('❌ Error in /api/engr/new-connections/list:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/update-action', async (req, res) => {
  try {
    const {
      id,
      assignedPlumbers,
      installationDate,
      installedMaterials,
      plumberRemarks,
      updatedBy, // 👈 Kunin ang encoder mula sa request body
      status
    } = req.body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'Record ID is required.' });
    }

    // 🔙 Special Workflow: SEND BACK TO COMMERCIAL
    if (status === 'SEND BACK TO COMMERCIAL') {
      if (!plumberRemarks || !plumberRemarks.trim()) {
        return res.status(400).json({ 
          success: false, 
          error: 'Kailangang maglagay ng dahilan o remarks kung bakit ibinabalik sa Commercial Tab!' 
        });
      }

      const sendBackSql = `
        UPDATE NEW_SERVICE_CONNECTIONS SET
          ASSIGNED_PLUMBERS = NULL,
          INSTALLATION_DATE = NULL,
          INSTALLED_MATERIALS = NULL,
          PLUMBER_REMARKS = ?,
          UPDATED_BY = ?,
          STATUS = 'PAID'
        WHERE ID = ?
      `;
      await db.query(sendBackSql, [
        plumberRemarks.trim(), 
        (updatedBy || 'STAFF').trim().toUpperCase(), 
        id
      ]);
      return res.json({ 
        success: true, 
        message: 'Matagumpay na naibalik ang application sa Commercial Module!' 
      });
    }

    // 🔨 Normal Update / Installation
    let finalStatus = (status || 'COMPLETED').trim().toUpperCase();
    if (assignedPlumbers && !['COMPLETED', 'INSTALLED', 'PENDING'].includes(finalStatus)) {
      finalStatus = 'COMPLETED';
    }

    const updateSql = `
      UPDATE NEW_SERVICE_CONNECTIONS SET
        ASSIGNED_PLUMBERS = ?,
        INSTALLATION_DATE = ?,
        INSTALLED_MATERIALS = ?,
        PLUMBER_REMARKS = ?,
        UPDATED_BY = ?,
        STATUS = ?
      WHERE ID = ?
    `;

    const params = [
      (assignedPlumbers || '').trim().toUpperCase(),
      (installationDate || '').trim(),
      (installedMaterials || '').trim().toUpperCase(),
      (plumberRemarks || '').trim(),
      (updatedBy || 'STAFF').trim().toUpperCase(), // 👈 I-save ang encoder
      finalStatus,
      id
    ];

    await db.query(updateSql, params);
    res.json({ success: true, message: 'New Connection installation details updated successfully!' });
  } catch (err) {
    console.error('❌ Error updating new connection:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;