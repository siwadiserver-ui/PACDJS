const db = require('../../config/db');

const CommercialController = {
  // Fast Search Concessionaire (Index-friendly at Case-insensitive lookup)
  async searchCustomer(req, res) {
    const { query: keyword } = req.query;
    if (!keyword || keyword.trim().length < 2) {
      return res.json({ success: true, data: [] });
    }

    try {
      const term = `%${keyword.trim().toUpperCase()}%`;
      const sql = `
        SELECT FIRST 10 ID, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, METER_NUMBER
        FROM CUSTOMER_DATABASE
        WHERE ACCOUNT_NUMBER LIKE ? 
           OR ACCOUNT_NAME LIKE ?
      `;
      const records = await db.query(sql, [term, term]);
      res.json({ success: true, data: records });
    } catch (error) {
      console.error('Customer Search Error:', error);
      res.status(500).json({ success: false, message: 'Database search error' });
    }
  },

  // 1. Service / Repair Request Submit
  async createServiceRequest(req, res) {
    const {
      accountNumber, accountName, address, meterNumber,
      requestedBy, contactNumber, waterMeterReading,
      complaint, requestDetails, otherDetails, receivedBy
    } = req.body;

    if (!accountNumber || !accountName || !complaint) {
      return res.status(400).json({ success: false, message: 'Kailangan ang Account No, Pangalan, at Complaint.' });
    }

    const currentYear = new Date().getFullYear().toString().slice(-2);

    try {
      // Kunin ang pinakamataas na sequence gamit ang B-Tree index
      const rows = await db.query(`
        SELECT FIRST 1 REFERENCE_NUMBER 
        FROM SERVICE_REQUESTS 
        WHERE REFERENCE_NUMBER LIKE ? 
        ORDER BY REFERENCE_NUMBER DESC
      `, [`${currentYear}-%`]);

      let highest = 0;
      if (rows && rows.length > 0 && rows[0].REFERENCE_NUMBER) {
        const parts = rows[0].REFERENCE_NUMBER.split('-');
        if (parts.length === 2 && parts[0] === currentYear) {
          const seq = parseInt(parts[1], 10);
          if (!isNaN(seq)) highest = seq;
        }
      }

      const refNumber = `${currentYear}-${String(highest + 1).padStart(4, '0')}`;
      const now = new Date();

      const sql = `
        INSERT INTO SERVICE_REQUESTS (
          ID, REFERENCE_NUMBER, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS,
          METER_NUMBER, RECEIVED_BY, REQUESTED_BY, CONTACT_NUMBER,
          WATER_METER_READING, REQUEST_DATE, REQUEST_TIME, COMPLAINT,
          REQUEST_DETAILS, OTHER_DETAILS, STATUS, CREATED_DATE
        ) VALUES (
          GEN_ID(GEN_SERVICE_REQUESTS_ID, 1),
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, 'PENDING', CURRENT_TIMESTAMP
        )
      `;

      await db.query(sql, [
        refNumber, 
        accountNumber.trim().toUpperCase(), 
        accountName.trim().toUpperCase(), 
        (address || '').trim().toUpperCase(),
        (meterNumber || '').trim().toUpperCase(), 
        receivedBy || 'COMMERCIAL', 
        (requestedBy || accountName).trim().toUpperCase(),
        contactNumber || 'N/A', 
        parseFloat(waterMeterReading) || 0,
        now.toISOString().slice(0, 10), 
        now.toTimeString().slice(0, 8),
        complaint, 
        requestDetails || '', 
        otherDetails || 'N/A'
      ]);

      res.json({ success: true, message: 'Nai-submit ang Service Request!', refNumber });
    } catch (error) {
      console.error('SR Insert Error:', error);
      res.status(500).json({ success: false, message: 'Failed to save Service Request: ' + error.message });
    }
  },

  // 2. Reconnection Request Submit
  async createReconnection(req, res) {
    const {
      accountNumber, accountName, address, meterNumber,
      orNumber, reconFee, cdFee, materialsFee, othersFee,
      paidBy, receivedBy, remarks
    } = req.body;

    const currentYear = new Date().getFullYear().toString().slice(-2);

    try {
      const rows = await db.query(`
        SELECT FIRST 1 REFERENCE_NUMBER 
        FROM RECONNECTION_REQUESTS 
        WHERE REFERENCE_NUMBER LIKE ? 
        ORDER BY REFERENCE_NUMBER DESC
      `, [`${currentYear}-%`]);

      let highest = 0;
      if (rows && rows.length > 0 && rows[0].REFERENCE_NUMBER) {
        const parts = rows[0].REFERENCE_NUMBER.split('-');
        if (parts.length === 2 && parts[0] === currentYear) {
          const seq = parseInt(parts[1], 10);
          if (!isNaN(seq)) highest = seq;
        }
      }

      const refNumber = `${currentYear}-${String(highest + 1).padStart(4, '0')}`;
      const now = new Date();

      const sql = `
        INSERT INTO RECONNECTION_REQUESTS (
          ID, REFERENCE_NUMBER, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS,
          METER_NUMBER, OR_NUMBER, RECON_FEE, CD_FEE,
          MATERIALS_FEE, OTHERS_FEE, PAID_BY, RECEIVED_BY,
          PLUMBER_REMARKS, REQUEST_DATE, REQUEST_TIME, STATUS, CREATED_DATE
        ) VALUES (
          GEN_ID(GEN_RECONNECTION_REQUESTS_ID, 1),
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, 'PENDING', CURRENT_TIMESTAMP
        )
      `;

      await db.query(sql, [
        refNumber, 
        (accountNumber || '').trim().toUpperCase(), 
        (accountName || '').trim().toUpperCase(), 
        (address || '').trim().toUpperCase(),
        (meterNumber || '').trim().toUpperCase(), 
        (orNumber || '').trim(), 
        parseFloat(reconFee) || 0,
        parseFloat(cdFee) || 0, 
        parseFloat(materialsFee) || 0, 
        parseFloat(othersFee) || 0,
        (paidBy || accountName || '').trim().toUpperCase(), 
        receivedBy || 'COMMERCIAL', 
        remarks || '',
        now.toISOString().slice(0, 10), 
        now.toTimeString().slice(0, 8)
      ]);

      res.json({ success: true, message: 'Nai-submit ang Reconnection Request!', refNumber });
    } catch (error) {
      console.error('Recon Insert Error:', error);
      res.status(500).json({ success: false, message: 'Failed to save Reconnection: ' + error.message });
    }
  },

  // 3. Transfer Request Submit
  async createTransfer(req, res) {
    const {
      accountNumber, accountName, fromAddress, fromMeterNumber,
      toAddress, toContactNumber, toMeterNumber, requirement, remarks
    } = req.body;

    try {
      const now = new Date();
      const sql = `
        INSERT INTO TRANSFER_REQUESTS (
          ID, ACCOUNT_NUMBER, ACCOUNT_NAME, FROM_ADDRESS, FROM_METER_NUMBER,
          TO_ADDRESS, TO_CONTACT_NUMBER, TO_METER_NUMBER, APPLICATION_DATE,
          REQUIREMENT, REMARKS, STATUS, CREATED_DATE
        ) VALUES (
          GEN_ID(GEN_TRANSFER_REQUESTS_ID, 1),
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, 'PENDING', CURRENT_TIMESTAMP
        )
      `;

      await db.query(sql, [
        (accountNumber || '').trim().toUpperCase(), 
        (accountName || '').trim().toUpperCase(), 
        (fromAddress || '').trim().toUpperCase(), 
        (fromMeterNumber || '').trim().toUpperCase(),
        (toAddress || '').trim().toUpperCase(), 
        toContactNumber || '', 
        (toMeterNumber || '').trim().toUpperCase(),
        now.toISOString().slice(0, 10), 
        requirement || '', 
        remarks || ''
      ]);

      res.json({ success: true, message: 'Nai-submit ang Transfer Request!' });
    } catch (error) {
      console.error('Transfer Insert Error:', error);
      res.status(500).json({ success: false, message: 'Failed to save Transfer Request: ' + error.message });
    }
  },

  // 4. Water Service Application Submit
  async createApplication(req, res) {
    const {
      applicantName, address, contactNumber, governmentId,
      accountReference, requirementsPassed, remarks
    } = req.body;

    const currentYear = new Date().getFullYear().toString().slice(-2);

    try {
      const rows = await db.query(`
        SELECT FIRST 1 APPLICATION_NUMBER 
        FROM WATER_SERVICE_APPLICATIONS 
        WHERE APPLICATION_NUMBER LIKE ? 
        ORDER BY APPLICATION_NUMBER DESC
      `, [`APP-${currentYear}-%`]);

      let highest = 0;
      if (rows && rows.length > 0 && rows[0].APPLICATION_NUMBER) {
        const parts = rows[0].APPLICATION_NUMBER.split('-');
        if (parts.length === 3 && parts[1] === currentYear) {
          const seq = parseInt(parts[2], 10);
          if (!isNaN(seq)) highest = seq;
        }
      }

      const appNumber = `APP-${currentYear}-${String(highest + 1).padStart(4, '0')}`;
      const now = new Date();

      const sql = `
        INSERT INTO WATER_SERVICE_APPLICATIONS (
          ID, APPLICATION_NUMBER, APPLICATION_DATE, APPLICATION_TIME, APPLICANT_NAME,
          ADDRESS, CONTACT_NUMBER, GOVERNMENT_ID, ACCOUNT_REFERENCE,
          REQUIREMENTS_PASSED, REMARKS, STATUS, CREATED_DATE
        ) VALUES (
          GEN_ID(GEN_WATER_SERVICE_APP_ID, 1),
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, 'FOR INSPECTION', CURRENT_TIMESTAMP
        )
      `;

      await db.query(sql, [
        appNumber, 
        now.toISOString().slice(0, 10), 
        now.toTimeString().slice(0, 8),
        (applicantName || '').trim().toUpperCase(), 
        (address || '').trim().toUpperCase(), 
        contactNumber || '', 
        governmentId || '',
        (accountReference || '').trim().toUpperCase(), 
        requirementsPassed || '', 
        remarks || ''
      ]);

      res.json({ success: true, message: 'Nai-submit ang Application!', appNumber });
    } catch (error) {
      console.error('App Insert Error:', error);
      res.status(500).json({ success: false, message: 'Failed to save Application: ' + error.message });
    }
  },

  // 5. New Service Connection Submit
  async createNewConnection(req, res) {
    const {
      applicationNumber, applicantName, address, contactNumber,
      orNumber, deposit, customersDeposit, meterMaintenanceFee, remarks
    } = req.body;

    try {
      const sql = `
        INSERT INTO NEW_SERVICE_CONNECTIONS (
          ID, APPLICATION_NUMBER, APPLICANT_NAME, ADDRESS, CONTACT_NUMBER,
          OR_NUMBER, DEPOSIT, CUSTOMERS_DEPOSIT, METER_MAINTENANCE_FEE,
          REMARKS, STATUS, CREATED_DATE
        ) VALUES (
          GEN_ID(GEN_NEW_SERVICE_CONN_ID, 1),
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 'PENDING', CURRENT_TIMESTAMP
        )
      `;

      await db.query(sql, [
        (applicationNumber || '').trim().toUpperCase(), 
        (applicantName || '').trim().toUpperCase(), 
        (address || '').trim().toUpperCase(), 
        contactNumber || '',
        (orNumber || '').trim(), 
        parseFloat(deposit) || 0, 
        parseFloat(customersDeposit) || 0,
        parseFloat(meterMaintenanceFee) || 0, 
        remarks || ''
      ]);

      res.json({ success: true, message: 'Nai-submit ang New Service Connection para sa Installation!' });
    } catch (error) {
      console.error('New Conn Insert Error:', error);
      res.status(500).json({ success: false, message: 'Failed to save New Service Connection: ' + error.message });
    }
  },

  // Optimized Fetch para sa Recent Activity Feed (Index at Limit Friendly)
  async getRecentActivity(req, res) {
    try {
      const sql = `
        SELECT FIRST 10 'SERVICE REQUEST' AS TYPE, REFERENCE_NUMBER AS REF, ACCOUNT_NAME, STATUS, REQUEST_DATE AS TX_DATE
        FROM SERVICE_REQUESTS
        ORDER BY ID DESC
      `;
      const data = await db.query(sql);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = CommercialController;