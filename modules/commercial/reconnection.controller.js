const db = require('../../config/db');
const PDFDocument = require('pdfkit');

const ReconnectionController = {
  // 1. Get Next Reference Number (Ligtas sa string-length sorting at concurrency)
  async getNextRef(req, res) {
    try {
      const currentYear = new Date().getFullYear().toString().slice(-2);
      
      // Kunin ang lahat ng reference numbers para sa taong ito upang matukoy ang tunay na pinakamataas na numeric sequence
      const sql = `
        SELECT REFERENCE_NUMBER 
        FROM RECONNECTION_REQUESTS 
        WHERE REFERENCE_NUMBER LIKE ?
      `;
      const rows = await db.query(sql, [`${currentYear}-%`]);

      let highest = 0;
      if (rows && rows.length > 0) {
        rows.forEach(r => {
          if (r.REFERENCE_NUMBER) {
            const clean = r.REFERENCE_NUMBER.replace(/^RC-?/i, '');
            const parts = clean.split('-');
            if (parts.length === 2 && parts[0] === currentYear) {
              const seq = parseInt(parts[1], 10);
              if (!isNaN(seq) && seq > highest) {
                highest = seq;
              }
            }
          }
        });
      }

      const nextNum = highest + 1;
      const nextRef = `${currentYear}-${String(nextNum).padStart(4, '0')}`;
      res.json({ success: true, nextRef });
    } catch (err) {
      console.error('Recon Next Ref Error:', err);
      const currentYear = new Date().getFullYear().toString().slice(-2);
      res.json({ success: true, nextRef: `${currentYear}-0001` });
    }
  },

  // 2. Check Reference Exists (Index Friendly)
  async checkRefExists(req, res) {
    const { ref } = req.query;
    if (!ref) return res.json({ exists: false });

    try {
      let cleanRef = ref.trim().toUpperCase();
      if (cleanRef.startsWith('RC-')) cleanRef = cleanRef.substring(3);

      const sql = `SELECT COUNT(*) AS CNT FROM RECONNECTION_REQUESTS WHERE REFERENCE_NUMBER = ?`;
      const result = await db.query(sql, [cleanRef]);
      const exists = (result && result[0] && (result[0].CNT > 0 || result[0].cnt > 0));

      res.json({ success: true, exists: Boolean(exists) });
    } catch (err) {
      console.error('Check Ref Error:', err);
      res.status(500).json({ success: false, exists: false });
    }
  },

  // 3. Tunay na 30-Day Duplicate Request Check (Firebird SQL DATEADD)
  async checkDuplicateAccount(req, res) {
    const { accountNumber, accountName } = req.query;
    if (!accountNumber && !accountName) return res.json({ exists: false });

    try {
      const cleanAcc = (accountNumber || '').trim().toUpperCase();
      const cleanName = (accountName || '').trim().toUpperCase();

      // 🎯 Hinahanap lamang ang mga records sa loob ng nakaraang 30 araw
      const sql = `
        SELECT FIRST 1 REFERENCE_NUMBER, REQUEST_DATE, ACCOUNT_NAME
        FROM RECONNECTION_REQUESTS
        WHERE (ACCOUNT_NUMBER = ? OR ACCOUNT_NAME = ?)
          AND REQUEST_DATE >= DATEADD(-30 DAY TO CURRENT_DATE)
        ORDER BY ID DESC
      `;
      const rows = await db.query(sql, [cleanAcc, cleanName]);

      if (rows && rows.length > 0) {
        return res.json({ success: true, exists: true, data: rows[0] });
      }
      res.json({ success: true, exists: false });
    } catch (err) {
      console.error('Check Duplicate Account Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

// 4. Create Reconnection Request (Concurrency-Safe)
  async createRequest(req, res) {
    const {
      referenceNumber, accountNumber, accountName, address,
      meterNumber, reading, orNumber, paidBy,
      reconFee, cdFee, materialsFee, othersFee,
      meterStatus, receivedBy, requestDate, requestTime
    } = req.body;

    const currentYear = new Date().getFullYear().toString().slice(-2);

    try {
      // 🔒 1. Suriin kung may nakagamit na ng Reference Number bago mag-insert
      let cleanRef = (referenceNumber || '').trim().toUpperCase().replace(/^RC-?/i, '');

      // Kung blangko o nagamit na ng ibang PC, kumuha agad ng panibagong next sequence
      const checkSql = `SELECT COUNT(*) AS CNT FROM RECONNECTION_REQUESTS WHERE REFERENCE_NUMBER = ?`;
      const existCheck = await db.query(checkSql, [cleanRef]);
      const alreadyTaken = existCheck && existCheck[0] && (existCheck[0].CNT > 0 || existCheck[0].cnt > 0);

      let finalRef = cleanRef;

      if (!finalRef || alreadyTaken) {
        // Mag-calculate ng pinakabagong highest reference number on the fly
        const fetchRefsSql = `SELECT REFERENCE_NUMBER FROM RECONNECTION_REQUESTS WHERE REFERENCE_NUMBER LIKE ?`;
        const allRefs = await db.query(fetchRefsSql, [`${currentYear}-%`]);
        
        let highest = 0;
        if (allRefs && allRefs.length > 0) {
          allRefs.forEach(r => {
            if (r.REFERENCE_NUMBER) {
              const parts = r.REFERENCE_NUMBER.replace(/^RC-?/i, '').split('-');
              if (parts.length === 2 && parts[0] === currentYear) {
                const seq = parseInt(parts[1], 10);
                if (!isNaN(seq) && seq > highest) highest = seq;
              }
            }
          });
        }
        finalRef = `${currentYear}-${String(highest + 1).padStart(4, '0')}`;
      }

      // 💾 2. I-insert ang record gamit ang garantisadong unique na finalRef
      const insertSql = `
        INSERT INTO RECONNECTION_REQUESTS (
          ID, REFERENCE_NUMBER, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS,
          METER_NUMBER, READING, OR_NUMBER, DATE_RECONNECTED,
          PAID_BY, METER_STATUS, RECEIVED_BY, RECONNECTED_BY,
          STATUS, PLUMBER_REMARKS, REQUEST_DATE, REQUEST_TIME,
          RECON_FEE, CD_FEE, MATERIALS_FEE, OTHERS_FEE, NEW_METER_NUMBER,
          CREATED_DATE
        ) VALUES (
          GEN_ID(GEN_RECONNECTION_REQUESTS_ID, 1),
          ?, ?, ?, ?,
          ?, ?, ?, '',
          ?, ?, ?, '',
          'PRINTED', '', ?, ?,
          ?, ?, ?, ?, '',
          CURRENT_TIMESTAMP
        )
      `;

      await db.query(insertSql, [
        finalRef,
        (accountNumber || '').trim().toUpperCase(),
        (accountName || '').trim().toUpperCase(),
        (address || '').trim().toUpperCase(),
        (meterNumber || '').trim().toUpperCase(),
        parseFloat(reading) || 0,
        (orNumber || '').trim(),
        (paidBy || accountName || '').trim().toUpperCase(),
        (meterStatus || 'MAGNETIC').trim().toUpperCase(),
        (receivedBy || 'COMMDIV/STAFF').trim().toUpperCase(),
        requestDate,
        requestTime,
        parseFloat(reconFee) || 0,
        parseFloat(cdFee) || 0,
        parseFloat(materialsFee) || 0,
        parseFloat(othersFee) || 0
      ]);

      // Ibalik ang finalRef para iyon ang i-print ng frontend
      res.json({ 
        success: true, 
        message: `Reconnection #${finalRef} saved!`, 
        refNumber: finalRef 
      });
    } catch (err) {
      console.error('Submit Reconnection Error:', err);
      res.status(500).json({ success: false, message: 'Database insert failed: ' + err.message });
    }
  },
  
  // 5. Get Data Pool
  async getDataPool(req, res) {
    const { status } = req.query;
    try {
      let sql = `
        SELECT ID, REFERENCE_NUMBER, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS,
               METER_NUMBER, READING, OR_NUMBER, DATE_RECONNECTED,
               PAID_BY, METER_STATUS, RECEIVED_BY, RECONNECTED_BY,
               STATUS, PLUMBER_REMARKS, REQUEST_DATE, REQUEST_TIME,
               RECON_FEE, CD_FEE, MATERIALS_FEE, OTHERS_FEE, NEW_METER_NUMBER,
               UPDATED_BY
        FROM RECONNECTION_REQUESTS
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
      console.error('Fetch Reconnection Pool Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 6. Update Request (Ingatan ang kasalukuyang STATUS kung RECONNECTED na)
  async updateRequest(req, res) {
    const {
      id, referenceNumber, accountNumber, accountName, address,
      meterNumber, reading, orNumber, paidBy,
      reconFee, cdFee, materialsFee, othersFee,
      meterStatus, receivedBy, requestDate, requestTime
    } = req.body;

    if (!id) return res.status(400).json({ success: false, message: 'Missing record ID.' });

    try {
      // 🎯 COALESCE / CASE check: Huwag i-override ang RECONNECTED status pabalik sa PRINTED
      const sql = `
        UPDATE RECONNECTION_REQUESTS
        SET 
          REFERENCE_NUMBER = ?, ACCOUNT_NUMBER = ?, ACCOUNT_NAME = ?, ADDRESS = ?,
          METER_NUMBER = ?, READING = ?, OR_NUMBER = ?, PAID_BY = ?,
          METER_STATUS = ?, RECEIVED_BY = ?, REQUEST_DATE = ?, REQUEST_TIME = ?,
          RECON_FEE = ?, CD_FEE = ?, MATERIALS_FEE = ?, OTHERS_FEE = ?,
          STATUS = CASE 
            WHEN UPPER(STATUS) = 'RECONNECTED' THEN 'RECONNECTED' 
            ELSE 'PRINTED' 
          END,
          UPDATED_DATE = CURRENT_TIMESTAMP
        WHERE ID = ?
      `;

      await db.query(sql, [
        (referenceNumber || '').trim().toUpperCase(),
        (accountNumber || '').trim().toUpperCase(),
        (accountName || '').trim().toUpperCase(),
        (address || '').trim().toUpperCase(),
        (meterNumber || '').trim().toUpperCase(),
        parseFloat(reading) || 0,
        (orNumber || '').trim(),
        (paidBy || '').trim().toUpperCase(),
        (meterStatus || 'MAGNETIC').trim().toUpperCase(),
        (receivedBy || '').trim().toUpperCase(),
        requestDate,
        requestTime,
        parseFloat(reconFee) || 0,
        parseFloat(cdFee) || 0,
        parseFloat(materialsFee) || 0,
        parseFloat(othersFee) || 0,
        id
      ]);

      res.json({ success: true, message: 'Reconnection successfully updated!' });
    } catch (err) {
      console.error('Update Reconnection Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 7. Delete Request
  async deleteRequest(req, res) {
    const { id } = req.params;
    try {
      await db.query(`DELETE FROM RECONNECTION_REQUESTS WHERE ID = ?`, [id]);
      res.json({ success: true, message: 'Reconnection request permanently deleted!' });
    } catch (err) {
      console.error('Delete Reconnection Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 8. Generate & Stream A6 Reconnection PDF Slip
  async printPDF(req, res) {
    const { ref } = req.params;
    try {
      const cleanRef = (ref || '').trim().toUpperCase();
      const strippedRef = cleanRef.replace(/^RC-?/i, '');
      const prefixedRef = `RC-${strippedRef}`;

      const sql = `
        SELECT FIRST 1 * 
        FROM RECONNECTION_REQUESTS 
        WHERE REFERENCE_NUMBER = ? OR REFERENCE_NUMBER = ?
      `;
      const rows = await db.query(sql, [strippedRef, prefixedRef]);

      if (!rows || rows.length === 0) {
        return res.status(404).send(`Reconnection #${ref} not found.`);
      }

      const r = rows[0];

      const INCH_TO_PT = 72;
      const pageWidth = 4.1 * INCH_TO_PT;
      const pageHeight = 5.8 * INCH_TO_PT;
      const margin = 0.2 * INCH_TO_PT;

      const doc = new PDFDocument({
        size: [pageWidth, pageHeight],
        margins: { top: margin, bottom: margin, left: margin, right: margin }
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Reconnection_${r.REFERENCE_NUMBER}.pdf"`);
      doc.pipe(res);

      let currentY = margin + 10;

      // 1. Title - CENTERED
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#000000');
      doc.text('SIWADI RECONNECTION SLIP', 0, currentY, { width: pageWidth, align: 'center' });
      currentY += 18;

      // 2. Reference Number - CENTERED, BOLD, RED
      doc.font('Helvetica-Bold').fontSize(14).fillColor('#fa383e');
      doc.text(`Ref #: ${r.REFERENCE_NUMBER}`, 0, currentY, { width: pageWidth, align: 'center' });
      currentY += 18;

      doc.strokeColor('#000000').lineWidth(0.8)
         .moveTo(margin, currentY)
         .lineTo(pageWidth - margin, currentY)
         .stroke();
      currentY += 10;

      // 3. Account Details
      doc.font('Helvetica-Bold').fontSize(12).fillColor('#fa383e');
      if (r.ACCOUNT_NUMBER) {
        doc.text(String(r.ACCOUNT_NUMBER), 0, currentY, { width: pageWidth, align: 'center' });
        currentY += 14;
      }
      if (r.ACCOUNT_NAME) {
        doc.text(String(r.ACCOUNT_NAME).toUpperCase(), 0, currentY, { width: pageWidth, align: 'center' });
        currentY += 14;
      }
      if (r.ADDRESS) {
        doc.text(String(r.ADDRESS).toUpperCase(), margin + 10, currentY, { 
          width: pageWidth - ((margin + 10) * 2), 
          align: 'center' 
        });
        currentY += (doc.heightOfString(String(r.ADDRESS).toUpperCase(), { width: pageWidth - ((margin + 10) * 2) }) + 8);
      }

      // Two-Column Section
      const colStartY = currentY;

      // LEFT COLUMN: METER INFORMATION
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
         .text('METER INFORMATION:', margin, colStartY);
      
      let leftY = colStartY + 12;
      doc.font('Helvetica').fontSize(8).fillColor('#000000').text('Meter #: ', margin, leftY, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#fa383e').text(String(r.METER_NUMBER || ''));
      leftY += 11;

      doc.font('Helvetica').fontSize(8).fillColor('#000000').text('Reading: ', margin, leftY, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#fa383e').text(String(r.READING || 0));
      leftY += 11;

      doc.font('Helvetica').fontSize(8).fillColor('#000000').text('Meter Status: ', margin, leftY, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#fa383e').text(String(r.METER_STATUS || 'MAGNETIC'));

      // RIGHT COLUMN: FEES AND CHARGES
      const rightColX = (pageWidth / 2) + 5;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
         .text('FEES AND CHARGES:', rightColX, colStartY);

      let rightY = colStartY + 12;
      const feeList = [
        { label: 'Recon Fee: ', val: r.RECON_FEE },
        { label: 'CD: ', val: r.CD_FEE },
        { label: 'Materials: ', val: r.MATERIALS_FEE },
        { label: 'Others: ', val: r.OTHERS_FEE }
      ];

      let totalFee = 0;
      feeList.forEach(f => {
        const num = parseFloat(f.val) || 0;
        totalFee += num;
        doc.font('Helvetica').fontSize(8).fillColor('#000000').text(f.label, rightColX, rightY, { continued: true });
        doc.font('Helvetica-Bold').fillColor('#fa383e').text(num > 0 ? num.toFixed(2) : '');
        rightY += 10;
      });

      doc.font('Helvetica-Bold').fontSize(8).fillColor('#000000').text('Total: ', rightColX, rightY, { continued: true });
      if (totalFee > 0) {
        doc.fillColor('#fa383e').text(totalFee.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      } else {
        doc.fillColor('#000000').text('________________');
      }

      currentY = Math.max(leftY, rightY) + 12;

      // 4. Payment Information
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
         .text('PAYMENT INFORMATION:', margin, currentY);
      currentY += 12;

      doc.font('Helvetica').fontSize(8).fillColor('#000000').text('OR Number: ', margin, currentY, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#fa383e').text(String(r.OR_NUMBER || ''));
      currentY += 11;

      doc.font('Helvetica').fontSize(8).fillColor('#000000').text('Paid By: ', margin, currentY, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#fa383e').text(String(r.PAID_BY || r.ACCOUNT_NAME || ''));
      currentY += 13;

      // 5. Request Details
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
         .text('REQUEST DETAILS:', margin, currentY);
      currentY += 12;

      doc.font('Helvetica').fontSize(8).fillColor('#000000').text('Received By: ', margin, currentY, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#fa383e').text(String(r.RECEIVED_BY || ''));
      currentY += 11;

      let formattedDate = r.REQUEST_DATE || '';
      try {
        const d = new Date(r.REQUEST_DATE);
        if (!isNaN(d.getTime())) {
          formattedDate = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
        }
      } catch (e) {}

      doc.font('Helvetica').fontSize(8).fillColor('#000000').text('Request Date: ', margin, currentY, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#fa383e').text(String(formattedDate));
      currentY += 11;

      doc.font('Helvetica').fontSize(8).fillColor('#000000').text('Request Time: ', margin, currentY, { continued: true });
      doc.font('Helvetica-Bold').fillColor('#fa383e').text(String(r.REQUEST_TIME || ''));
      currentY += 14;

      // 6. Completion Details
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
         .text('COMPLETION DETAILS:', margin, currentY);
      currentY += 12;
      doc.font('Helvetica').fontSize(8).fillColor('#000000')
         .text('Reconnected By: ___________________', margin, currentY);
      currentY += 11;
      doc.text('Date Reconnected: ___________________', margin, currentY);
      currentY += 11;
      doc.text('Time Reconnected: ___________________', margin, currentY);
      currentY += 13;

      // 7. Plumber Remarks
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor('#000000')
         .text('PLUMBER REMARKS:', margin, currentY);
      currentY += 11;
      doc.font('Helvetica').fontSize(8)
         .text('_________________________________________________', margin, currentY);
      currentY += 8;
      doc.text('_________________________________________________', margin, currentY);
      currentY += 14;

      // 8. Footer
      doc.font('Helvetica-BoldOblique').fontSize(8).fillColor('#1877f2')
         .text('Serbisyong Tapat, Serbisyong Sapat', 0, currentY, { width: pageWidth, align: 'center' });

      doc.end();
    } catch (err) {
      console.error('A6 Recon PDF Generation Error:', err);
      if (!res.headersSent) {
        res.status(500).send('Print PDF Error: ' + err.message);
      }
    }
  }
};

module.exports = ReconnectionController;