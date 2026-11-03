const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// GET /api/engr/service-requests/print-accomplishment/:ref
router.get('/service-requests/print-accomplishment/:ref', async (req, res) => {
  try {
    const rawRef = req.params.ref;
    const refWithPrefix = 'SR-' + rawRef;

    const sql = `
      SELECT FIRST 1 
        ID, REFERENCE_NUMBER, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, 
        REQUEST_DATE, REQUEST_DETAILS, OTHER_DETAILS, STATUS,
        COMPLETED_BY, ACTION_TAKEN, MATERIALS, COMPLETION_DATE, 
        PLUMBER_REMARKS, RECEIVED_BY, UPDATED_BY
      FROM SERVICE_REQUESTS
      WHERE REFERENCE_NUMBER = ? OR REFERENCE_NUMBER = ?
    `;

    const rows = await db.query(sql, [rawRef, refWithPrefix]);
    if (!rows || rows.length === 0) {
      return res.status(404).send('Record not found.');
    }

    const d = rows[0];

    res.send(`
      <!DOCTYPE html>
      <html lang="tl">
      <head>
        <meta charset="UTF-8">
        <title>SR_${d.REFERENCE_NUMBER || 'ACCOMPLISHMENT'}</title>
        <style>
          @page {
            size: A6 portrait; /* 105mm x 148mm */
            margin: 4mm 6mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 8.5px;
            color: #111;
            margin: 0;
            padding: 0;
            line-height: 1.15;
            background: #fff;
          }

          .doc-header {
            text-align: center;
            border-bottom: 1.5px solid #000;
            padding-bottom: 2px;
            margin-bottom: 4px;
          }
          .doc-header h1 {
            font-size: 11px;
            font-weight: 800;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }
          .doc-header p {
            font-size: 7.5px;
            margin: 1px 0 0;
            font-weight: 600;
            color: #333;
          }

          .title-tag {
            text-align: center;
            font-size: 9px;
            font-weight: 800;
            margin: 3px 0 4px;
            text-transform: uppercase;
            background: #e2e8f0;
            padding: 2px 0;
            border: 1px solid #94a3b8;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
            table-layout: fixed;
          }
          td, th {
            border: 1px solid #475569;
            padding: 2.5px 4px;
            vertical-align: middle;
            word-wrap: break-word;
          }
          th {
            background: #f1f5f9;
            font-size: 8px;
            font-weight: 800;
            text-align: left;
            text-transform: uppercase;
          }
          .lbl {
            font-weight: bold;
            color: #1e293b;
            background: #f8fafc;
            width: 32%;
          }
          .val {
            font-weight: 600;
          }

          .sig-row {
            display: flex;
            justify-content: space-between;
            margin-top: 6px;
            gap: 6px;
          }
          .sig-block {
            width: 48%;
            text-align: center;
            font-size: 7.5px;
          }
          .sig-line {
            border-bottom: 1px solid #000;
            margin-top: 20px;
            margin-bottom: 2px;
          }
          .sig-name {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
          }

          @media screen {
            body {
              background: #64748b;
              display: flex;
              justify-content: center;
              padding: 20px 0;
            }
            .a6-sheet {
              background: #fff;
              width: 105mm;
              min-height: 148mm;
              padding: 6mm 8mm;
              box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            }
            .no-print-bar {
              position: fixed;
              top: 10px;
              right: 15px;
              background: #0f172a;
              padding: 6px 12px;
              border-radius: 6px;
              display: flex;
              gap: 8px;
              z-index: 1000;
            }
            .no-print-bar button {
              background: #0284c7;
              color: #fff;
              border: none;
              padding: 4px 10px;
              font-size: 11px;
              font-weight: bold;
              border-radius: 4px;
              cursor: pointer;
            }
          }

          @media print {
            .no-print-bar { display: none !important; }
            .a6-sheet { width: 100%; height: 100%; }
          }
        </style>
      </head>
      <body>

        <div class="no-print-bar">
          <button onclick="window.print()">🖨️ Print / Save as PDF</button>
        </div>

        <div class="a6-sheet">
          <div class="doc-header">
            <h1>Siniloan Water District</h1>
            <p>Siniloan, Laguna | Engineering Division</p>
          </div>

          <div class="title-tag">
            Service Request Accomplishment
          </div>

          <table>
            <tr>
              <td class="lbl">Ref. No.:</td>
              <td class="val" style="font-weight:800; color:#b91c1c;">${d.REFERENCE_NUMBER || ''}</td>
              <td class="lbl" style="width:20%;">Status:</td>
              <td class="val" style="font-weight:800;">${d.STATUS || 'PENDING'}</td>
            </tr>
            <tr>
              <td class="lbl">Account No.:</td>
              <td class="val" colspan="3">${d.ACCOUNT_NUMBER || 'N/A'}</td>
            </tr>
            <tr>
              <td class="lbl">Concessionaire:</td>
              <td class="val" colspan="3" style="font-weight:800;">${d.ACCOUNT_NAME || ''}</td>
            </tr>
            <tr>
              <td class="lbl">Address:</td>
              <td class="val" colspan="3">${d.ADDRESS || ''}</td>
            </tr>
            <tr>
              <td class="lbl">Date Requested:</td>
              <td class="val" colspan="3">${d.REQUEST_DATE || ''}</td>
            </tr>
            <tr>
              <td class="lbl">Request Details:</td>
              <td class="val" colspan="3">${d.REQUEST_DETAILS || ''}</td>
            </tr>
            <tr>
              <td class="lbl">Specify / Note:</td>
              <td class="val" colspan="3">${d.OTHER_DETAILS || 'N/A'}</td>
            </tr>
          </table>

          <table>
            <tr>
              <th colspan="2">Work Order Accomplishment</th>
            </tr>
            <tr>
              <td class="lbl">Completion Date:</td>
              <td class="val">${d.COMPLETION_DATE || 'N/A'}</td>
            </tr>
            <tr>
              <td class="lbl">Completed By:</td>
              <td class="val" style="font-weight:800;">${d.COMPLETED_BY || 'N/A'}</td>
            </tr>
            <tr>
              <td class="lbl">Action Taken:</td>
              <td class="val">${d.ACTION_TAKEN || 'N/A'}</td>
            </tr>
            <tr>
              <td class="lbl">Materials Used:</td>
              <td class="val">${d.MATERIALS || 'WALA'}</td>
            </tr>
            <tr>
              <td class="lbl">Plumber Remarks:</td>
              <td class="val">${d.PLUMBER_REMARKS || 'None'}</td>
            </tr>
          </table>

          <div class="sig-row">
            <div class="sig-block">
              <div>Accomplished / Installed By:</div>
              <div class="sig-line"></div>
              <div class="sig-name">${d.COMPLETED_BY || 'Plumbing Personnel'}</div>
            </div>
            <div class="sig-block">
              <div>Recorded / Checked By:</div>
              <div class="sig-line"></div>
              <div class="sig-name">${d.UPDATED_BY || 'Engineering Staff'}</div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Server Error: ' + err.message);
  }
});

// GET /api/engr/new-connections/print-accomplishment/:appNo
router.get('/new-connections/print-accomplishment/:appNo', async (req, res) => {
  try {
    const rawApp = req.params.appNo;
    const appWithPrefix = 'APP-' + rawApp;

    // 🛑 Inalis ang CREATED_AT para maiwasan ang column unknown error
    const sql = `
      SELECT FIRST 1 
        ID, APPLICATION_NUMBER, APPLICANT_NAME, ADDRESS, CONTACT_NUMBER,
        OR_NUMBER, STATUS, ASSIGNED_PLUMBERS, INSTALLATION_DATE, 
        INSTALLED_MATERIALS, PLUMBER_REMARKS, GOVERNMENT_ID, ACCOUNT_REFERENCE,
        UPDATED_BY
      FROM NEW_SERVICE_CONNECTIONS
      WHERE APPLICATION_NUMBER = ? OR APPLICATION_NUMBER = ?
    `;

    const rows = await db.query(sql, [rawApp, appWithPrefix]);
    if (!rows || rows.length === 0) {
      return res.status(404).send('Record not found.');
    }

    const d = rows[0];

    res.send(`
      <!DOCTYPE html>
      <html lang="tl">
      <head>
        <meta charset="UTF-8">
        <title>NSC_${d.APPLICATION_NUMBER || 'ACCOMPLISHMENT'}</title>
        <style>
          @page {
            size: A6 portrait; /* 105mm x 148mm */
            margin: 4mm 6mm;
          }
          * {
            box-sizing: border-box;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 8.5px;
            color: #111;
            margin: 0;
            padding: 0;
            line-height: 1.15;
            background: #fff;
          }

          .doc-header {
            text-align: center;
            border-bottom: 1.5px solid #000;
            padding-bottom: 2px;
            margin-bottom: 4px;
          }
          .doc-header h1 {
            font-size: 11px;
            font-weight: 800;
            margin: 0;
            text-transform: uppercase;
            letter-spacing: 0.02em;
          }
          .doc-header p {
            font-size: 7.5px;
            margin: 1px 0 0;
            font-weight: 600;
            color: #333;
          }

          .title-tag {
            text-align: center;
            font-size: 9px;
            font-weight: 800;
            margin: 3px 0 4px;
            text-transform: uppercase;
            background: #e2e8f0;
            padding: 2px 0;
            border: 1px solid #94a3b8;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
            table-layout: fixed;
          }
          td, th {
            border: 1px solid #475569;
            padding: 2.5px 4px;
            vertical-align: middle;
            word-wrap: break-word;
          }
          th {
            background: #f1f5f9;
            font-size: 8px;
            font-weight: 800;
            text-align: left;
            text-transform: uppercase;
          }
          .lbl {
            font-weight: bold;
            color: #1e293b;
            background: #f8fafc;
            width: 32%;
          }
          .val {
            font-weight: 600;
          }

          .sig-row {
            display: flex;
            justify-content: space-between;
            margin-top: 6px;
            gap: 6px;
          }
          .sig-block {
            width: 48%;
            text-align: center;
            font-size: 7.5px;
          }
          .sig-line {
            border-bottom: 1px solid #000;
            margin-top: 20px;
            margin-bottom: 2px;
          }
          .sig-name {
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
          }

          @media screen {
            body {
              background: #64748b;
              display: flex;
              justify-content: center;
              padding: 20px 0;
            }
            .a6-sheet {
              background: #fff;
              width: 105mm;
              min-height: 148mm;
              padding: 6mm 8mm;
              box-shadow: 0 4px 15px rgba(0,0,0,0.3);
            }
            .no-print-bar {
              position: fixed;
              top: 10px;
              right: 15px;
              background: #0f172a;
              padding: 6px 12px;
              border-radius: 6px;
              display: flex;
              gap: 8px;
              z-index: 1000;
            }
            .no-print-bar button {
              background: #0284c7;
              color: #fff;
              border: none;
              padding: 4px 10px;
              font-size: 11px;
              font-weight: bold;
              border-radius: 4px;
              cursor: pointer;
            }
          }

          @media print {
            .no-print-bar { display: none !important; }
            .a6-sheet { width: 100%; height: 100%; }
          }
        </style>
      </head>
      <body>

        <div class="no-print-bar">
          <button onclick="window.print()">🖨️ Print / Save as PDF</button>
        </div>

        <div class="a6-sheet">
          <div class="doc-header">
            <h1>Siniloan Water District</h1>
            <p>Siniloan, Laguna | Engineering Division</p>
          </div>

          <div class="title-tag">
            New Connection Accomplishment
          </div>

          <table>
            <tr>
              <td class="lbl">App. No.:</td>
              <td class="val" style="font-weight:800; color:#b91c1c;">${d.APPLICATION_NUMBER || ''}</td>
              <td class="lbl" style="width:20%;">Status:</td>
              <td class="val" style="font-weight:800;">${d.STATUS || 'PENDING'}</td>
            </tr>
            <tr>
              <td class="lbl">OR Number:</td>
              <td class="val" colspan="3" style="font-weight:800; color:#15803d;">${d.OR_NUMBER || 'NO OR'}</td>
            </tr>
            <tr>
              <td class="lbl">Applicant:</td>
              <td class="val" colspan="3" style="font-weight:800;">${d.APPLICANT_NAME || ''}</td>
            </tr>
            <tr>
              <td class="lbl">Address:</td>
              <td class="val" colspan="3">${d.ADDRESS || ''}</td>
            </tr>
            <tr>
              <td class="lbl">Contact No.:</td>
              <td class="val">${d.CONTACT_NUMBER || 'N/A'}</td>
              <td class="lbl" style="width:20%;">Acct Ref:</td>
              <td class="val">${d.ACCOUNT_REFERENCE || 'N/A'}</td>
            </tr>
          </table>

          <table>
            <tr>
              <th colspan="2">Installation Work Details</th>
            </tr>
            <tr>
              <td class="lbl">Installation Date:</td>
              <td class="val">${d.INSTALLATION_DATE || 'N/A'}</td>
            </tr>
            <tr>
              <td class="lbl">Assigned Plumber(s):</td>
              <td class="val" style="font-weight:800;">${d.ASSIGNED_PLUMBERS || 'N/A'}</td>
            </tr>
            <tr>
              <td class="lbl">Materials Installed:</td>
              <td class="val">${d.INSTALLED_MATERIALS || 'None'}</td>
            </tr>
            <tr>
              <td class="lbl">Remarks / Notes:</td>
              <td class="val">${d.PLUMBER_REMARKS || 'None'}</td>
            </tr>
          </table>

          <div class="sig-row">
            <div class="sig-block">
              <div>Installed / Completed By:</div>
              <div class="sig-line"></div>
              <div class="sig-name">${d.ASSIGNED_PLUMBERS || 'Plumbing Personnel'}</div>
            </div>
            <div class="sig-block">
              <div>Verified / Recorded By:</div>
              <div class="sig-line"></div>
              <div class="sig-name">${d.UPDATED_BY || 'Engineering Staff'}</div>
            </div>
          </div>
        </div>

        <script>
          window.onload = function() {
            setTimeout(() => {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    res.status(500).send('Server Error: ' + err.message);
  }
});

module.exports = router;