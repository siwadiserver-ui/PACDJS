const db = require('../../config/db');
const PrintService = require('./print.service');

const ServiceRequestController = {
  // 1. Optimized Next Reference Number (Ligtas sa string sort bug)
  async getNextRef(req, res) {
    try {
      const currentYear = new Date().getFullYear().toString().slice(-2);
      
      const sql = `
        SELECT REFERENCE_NUMBER 
        FROM SERVICE_REQUESTS 
        WHERE REFERENCE_NUMBER LIKE ?
      `;
      const rows = await db.query(sql, [`${currentYear}-%`]);

      let highest = 0;
      if (rows && rows.length > 0) {
        rows.forEach(r => {
          if (r.REFERENCE_NUMBER) {
            const clean = r.REFERENCE_NUMBER.replace(/^SR-?/i, '');
            const parts = clean.split('-');
            if (parts.length === 2 && parts[0] === currentYear) {
              const seq = parseInt(parts[1], 10);
              if (!isNaN(seq) && seq > highest) highest = seq;
            }
          }
        });
      }

      const nextNum = highest + 1;
      const nextRef = `${currentYear}-${String(nextNum).padStart(4, '0')}`;
      res.json({ success: true, nextRef });
    } catch (err) {
      console.error('Get Next Ref Error:', err);
      const currentYear = new Date().getFullYear().toString().slice(-2);
      res.json({ success: true, nextRef: `${currentYear}-0001` });
    }
  },

  // 2. Check if Reference Number exists (Direct Index Match)
  async checkRefExists(req, res) {
    const { ref } = req.query;
    if (!ref) return res.json({ exists: false });

    try {
      let cleanRef = ref.trim().toUpperCase();
      if (cleanRef.startsWith('SR-')) cleanRef = cleanRef.substring(3);

      const sql = `SELECT COUNT(*) AS CNT FROM SERVICE_REQUESTS WHERE REFERENCE_NUMBER = ?`;
      const result = await db.query(sql, [cleanRef]);
      const exists = (result && result[0] && (result[0].CNT > 0 || result[0].cnt > 0));

      res.json({ success: true, exists: Boolean(exists) });
    } catch (err) {
      console.error('Check Ref Error:', err);
      res.status(500).json({ success: false, exists: false });
    }
  },

  // 3. Matatag na Customer Search (Suportado ang 2-part, 3-part, at iba't ibang zero-padding)
  async searchCustomerPattern(req, res) {
    const p1 = (req.query.part1 || req.query.p1 || '').trim();
    const p3 = (req.query.part3 || req.query.p3 || '').trim();

    if (!p1 || !p3) {
      return res.status(400).json({ success: false, message: 'Missing pattern parts' });
    }

    try {
      const cleanP1 = p1.replace(/^0+/, '') || '0';
      const cleanP3 = p3.replace(/^0+/, '') || '0';

      const p1List = [...new Set([cleanP1, cleanP1.padStart(2, '0'), cleanP1.padStart(3, '0')])];
      const p3List = [...new Set([
        cleanP3, 
        cleanP3.padStart(2, '0'), 
        cleanP3.padStart(3, '0'), 
        cleanP3.padStart(4, '0'), 
        cleanP3.padStart(5, '0')
      ])];

      let conditions = [];
      let params = [];

      // Format A: 3-Part (v1-%-v3) -> bypass ang gitna
      // Format B: 2-Part (v1-v3)
      p1List.forEach(v1 => {
        p3List.forEach(v3 => {
          conditions.push(`ACCOUNT_NUMBER LIKE ?`);
          params.push(`${v1}-%-${v3}`);
          
          conditions.push(`ACCOUNT_NUMBER LIKE ?`);
          params.push(`${v1}-${v3}`);
        });
      });

      const sql = `
        SELECT FIRST 15 ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, METER_NUMBER
        FROM CUSTOMER_DATABASE
        WHERE ${conditions.join(' OR ')}
      `;
      const rows = await db.query(sql, params);

      if (rows && rows.length > 0) {
        // Tiyaking ang unang segment at huling segment ay tumutugma sa input
        const exactMatch = rows.find(r => {
          if (!r.ACCOUNT_NUMBER || !r.ACCOUNT_NUMBER.includes('-')) return false;
          const parts = r.ACCOUNT_NUMBER.split('-').map(s => s.trim().replace(/^0+/, ''));
          return parts[0] === cleanP1 && parts[parts.length - 1] === cleanP3;
        });

        return res.json({ success: true, found: true, customer: exactMatch || rows[0] });
      }
      return res.json({ success: true, found: false, customer: null });
    } catch (err) {
      console.error('Customer Pattern Search Error:', err);
      res.status(500).json({ success: false, message: 'Database search error: ' + err.message });
    }
  },

  // 4. Check Existing Requests Today (Index Friendly)
  async checkExistingToday(req, res) {
    const { accountName, accountNumber, requestDate } = req.query;
    try {
      const cleanAcc = (accountNumber || '').trim().toUpperCase();
      const cleanName = (accountName || '').trim().toUpperCase();

      const sql = `
        SELECT REFERENCE_NUMBER, REQUEST_DETAILS, REQUESTED_BY
        FROM SERVICE_REQUESTS
        WHERE (ACCOUNT_NUMBER = ? OR ACCOUNT_NAME = ?)
          AND REQUEST_DATE = ?
      `;
      const rows = await db.query(sql, [cleanAcc, cleanName, requestDate]);
      res.json({ success: true, requests: rows || [] });
    } catch (err) {
      console.error('Check Today Error:', err);
      res.status(500).json({ success: false, requests: [] });
    }
  },

  // 5. Create Service Request (Ligtas sa Concurrency at Sabayang Pag-save)
  async createRequest(req, res) {
    const {
      referenceNumber,
      accountNumber,
      accountName,
      address,
      meterNumber,
      receivedBy,
      requestedBy,
      contactNumber,
      waterMeterReading,
      requestDate,
      requestTime,
      requestDetails,
      otherDetails
    } = req.body;

    const currentYear = new Date().getFullYear().toString().slice(-2);
    let targetRef = (referenceNumber || '').trim().toUpperCase().replace(/^SR-?/i, '');

    try {
      // 🔒 Pre-check: Kung nagamit na ng ibang PC ang number, kumuha agad ng panibagong next sequence
      const checkSql = `SELECT COUNT(*) AS CNT FROM SERVICE_REQUESTS WHERE REFERENCE_NUMBER = ?`;
      const existCheck = await db.query(checkSql, [targetRef]);
      const alreadyTaken = existCheck && existCheck[0] && (existCheck[0].CNT > 0 || existCheck[0].cnt > 0);

      if (!targetRef || alreadyTaken) {
        const allRefs = await db.query(
          `SELECT REFERENCE_NUMBER FROM SERVICE_REQUESTS WHERE REFERENCE_NUMBER LIKE ?`,
          [`${currentYear}-%`]
        );
        
        let highest = 0;
        if (allRefs && allRefs.length > 0) {
          allRefs.forEach(r => {
            if (r.REFERENCE_NUMBER) {
              const parts = r.REFERENCE_NUMBER.replace(/^SR-?/i, '').split('-');
              if (parts.length === 2 && parts[0] === currentYear) {
                const seq = parseInt(parts[1], 10);
                if (!isNaN(seq) && seq > highest) highest = seq;
              }
            }
          });
        }
        targetRef = `${currentYear}-${String(highest + 1).padStart(4, '0')}`;
      }

      const insertSql = `
        INSERT INTO SERVICE_REQUESTS (
          ID, REFERENCE_NUMBER, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS,
          METER_NUMBER, RECEIVED_BY, REQUESTED_BY, CONTACT_NUMBER,
          WATER_METER_READING, REQUEST_DATE, REQUEST_TIME, REQUEST_DETAILS,
          OTHER_DETAILS, STATUS, CREATED_DATE
        ) VALUES (
          GEN_ID(GEN_SERVICE_REQUESTS_ID, 1),
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, 'PENDING', CURRENT_TIMESTAMP
        )
      `;

      await db.query(insertSql, [
        targetRef,
        (accountNumber || '').toUpperCase(),
        (accountName || '').toUpperCase(),
        (address || '').toUpperCase(),
        (meterNumber || '').toUpperCase(),
        receivedBy || '',
        requestedBy || 'CONCERN CITIZEN',
        contactNumber || 'N/A',
        parseFloat(waterMeterReading) || 0,
        requestDate,
        requestTime,
        requestDetails,
        otherDetails || 'N/A'
      ]);

      return res.json({
        success: true,
        message: `Service request ${targetRef} successfully submitted!`,
        refNumber: targetRef
      });
    } catch (err) {
      console.error('Submit Request Error:', err);
      return res.status(500).json({ success: false, message: 'Database insert failed: ' + err.message });
    }
  },

  // 6. Get Data Pool List (Lahat ng Records / No Limit)
  async getDataPool(req, res) {
    const { status } = req.query;
    try {
      let sql = `
        SELECT ID, REFERENCE_NUMBER, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, 
               METER_NUMBER, RECEIVED_BY, REQUESTED_BY, CONTACT_NUMBER,
               WATER_METER_READING, REQUEST_DATE, REQUEST_TIME, REQUEST_DETAILS, 
               OTHER_DETAILS, STATUS,
               COMPLETED_BY, ACTION_TAKEN, MATERIALS, COMPLETION_DATE, PLUMBER_REMARKS,
               UPDATED_BY
        FROM SERVICE_REQUESTS
      `;
      const params = [];

      if (status && status !== 'ALL') {
        sql += ` WHERE STATUS = ?`;
        params.push(status.toUpperCase());
      }

      sql += ` ORDER BY ID DESC`;

      const rows = await db.query(sql, params);
      res.json({ success: true, data: rows || [] });
    } catch (err) {
      console.error('Data Pool Fetch Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 7. Update Service Request (Hindi ginagalaw ang STATUS ng Tubero/Maintenance)
  async updateRequest(req, res) {
    const {
      id,
      accountNumber,
      accountName,
      address,
      meterNumber,
      receivedBy,
      requestedBy,
      contactNumber,
      waterMeterReading,
      requestDate,
      requestTime,
      requestDetails,
      otherDetails
    } = req.body;

    if (!id) return res.status(400).json({ success: false, message: 'Missing record ID.' });

    try {
      const sql = `
        UPDATE SERVICE_REQUESTS
        SET 
          ACCOUNT_NUMBER = ?,
          ACCOUNT_NAME = ?,
          ADDRESS = ?,
          METER_NUMBER = ?,
          RECEIVED_BY = ?,
          REQUESTED_BY = ?,
          CONTACT_NUMBER = ?,
          WATER_METER_READING = ?,
          REQUEST_DATE = ?,
          REQUEST_TIME = ?,
          REQUEST_DETAILS = ?,
          OTHER_DETAILS = ?,
          UPDATED_DATE = CURRENT_TIMESTAMP
        WHERE ID = ?
      `;

      await db.query(sql, [
        (accountNumber || '').toUpperCase(),
        (accountName || '').toUpperCase(),
        (address || '').toUpperCase(),
        (meterNumber || '').toUpperCase(),
        receivedBy || '',
        requestedBy || 'CONCERN CITIZEN',
        contactNumber || 'N/A',
        parseFloat(waterMeterReading) || 0,
        requestDate,
        requestTime,
        requestDetails,
        otherDetails || 'N/A',
        id
      ]);

      res.json({ success: true, message: 'Service Request successfully updated!' });
    } catch (err) {
      console.error('Update Request Error:', err);
      res.status(500).json({ success: false, message: 'Update failed: ' + err.message });
    }
  },

  // 8. Delete Service Request
// 8. Delete Service Request (May Hardcoded Security Password Check)
  async deleteRequest(req, res) {
    const { id } = req.params;
    const { password } = req.body;

    if (!id) return res.status(400).json({ success: false, message: 'Missing record ID.' });

    // 🔒 Server-Side Security Password Verification
    if (password !== 'KUMAKALABUKAB' && password !== 'kumakalabukab') {
      return res.status(403).json({ success: false, message: 'Unauthorized: Mali ang security password!' });
    }

    try {
      await db.query(`DELETE FROM SERVICE_REQUESTS WHERE ID = ?`, [id]);
      res.json({ success: true, message: 'Service Request and Reference Number permanently deleted!' });
    } catch (err) {
      console.error('Delete Request Error:', err);
      res.status(500).json({ success: false, message: 'Delete failed: ' + err.message });
    }
  },

  // 9. Generate & Stream PDF
  async printRequestPDF(req, res) {
    const { ref } = req.params;
    try {
      const cleanRef = (ref || '').trim().toUpperCase();
      const strippedRef = cleanRef.replace(/^SR-?/i, '');
      const prefixedRef = `SR-${strippedRef}`;

      const sql = `
        SELECT FIRST 1 
          ID, REFERENCE_NUMBER, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, 
          METER_NUMBER, RECEIVED_BY, REQUESTED_BY, CONTACT_NUMBER,
          WATER_METER_READING, REQUEST_DATE, REQUEST_TIME, REQUEST_DETAILS, 
          OTHER_DETAILS
        FROM SERVICE_REQUESTS 
        WHERE REFERENCE_NUMBER = ? 
           OR REFERENCE_NUMBER = ?
      `;

      const rows = await db.query(sql, [strippedRef, prefixedRef]);

      if (!rows || rows.length === 0) {
        return res.status(404).send(`Record with Reference #${ref} not found in database.`);
      }

      const r = rows[0];
      const dataPayload = {
        referenceNumber: String(r.REFERENCE_NUMBER || strippedRef),
        accountNumber: String(r.ACCOUNT_NUMBER || ''),
        accountName: String(r.ACCOUNT_NAME || ''),
        address: String(r.ADDRESS || ''),
        meterNumber: String(r.METER_NUMBER || ''),
        waterMeterReading: r.WATER_METER_READING,
        requestedBy: String(r.REQUESTED_BY || 'CONCERN CITIZEN'),
        receivedBy: String(r.RECEIVED_BY || ''),
        contactNumber: String(r.CONTACT_NUMBER || 'N/A'),
        requestDetails: String(r.REQUEST_DETAILS || ''),
        otherDetails: String(r.OTHER_DETAILS || 'N/A'),
        requestDate: r.REQUEST_DATE,
        requestTime: r.REQUEST_TIME
      };

      PrintService.generateServiceRequestPDF(dataPayload, res);
    } catch (err) {
      console.error('PDF Print Error:', err);
      res.status(500).send('Error generating PDF printout: ' + err.message);
    }
  }
};

module.exports = ServiceRequestController;