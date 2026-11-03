const xlsx = require('xlsx');
const firebird = require('node-firebird');
const db = require('../../config/db');

const ExcelUploadController = {
  // 1. Kumuha ng status ng Masterlist
  async getStatus(req, res) {
    try {
      const countRes = await db.query(`SELECT COUNT(*) AS CNT FROM CUSTOMER_DATABASE`);
      const samples = await db.query(`SELECT FIRST 10 ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, METER_NUMBER FROM CUSTOMER_DATABASE ORDER BY ID ASC`);
      const totalRecords = countRes && countRes[0] ? (countRes[0].CNT || countRes[0].cnt || 0) : 0;

      res.json({
        success: true,
        totalRecords,
        preview: samples || []
      });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 2. Optimized 11,000+ Fast Upload (Chunked Batch Insert)
  async processUpload(req, res) {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Pumili ng Excel file (.xlsx o .xls).' });
    }

    try {
      console.log('⏳ Binabasa ang Concessionaire Excel Buffer...');
      const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];

      const sheetData = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

      if (!sheetData || sheetData.length <= 1) {
        return res.status(400).json({ success: false, message: 'Walang data ang Excel file.' });
      }

      const mappedRows = [];

      for (let i = 1; i < sheetData.length; i++) {
        const row = sheetData[i];
        const accNo = String(row[0] || '').trim();
        const name = String(row[1] || '').trim();
        const address = String(row[2] || '').trim();
        const meterNo = String(row[3] || '').trim();

        if (accNo && name) {
          mappedRows.push({
            accNo: accNo.toUpperCase(),
            name: name.toUpperCase(),
            address: address.toUpperCase(),
            meterNo: meterNo ? meterNo.toUpperCase() : 'NO METER'
          });
        }
      }

      console.log(`📦 Nakitang valid concessionaires: ${mappedRows.length}. Nagsisimula ang fast database sync...`);

      db.pool.get((err, fbDb) => {
        if (err) {
          return res.status(500).json({ success: false, message: 'Database connection failed: ' + err.message });
        }

        fbDb.transaction(firebird.ISOLATION_READ_COMMITTED, async (trErr, transaction) => {
          if (trErr) {
            fbDb.detach();
            return res.status(500).json({ success: false, message: 'Transaction error: ' + trErr.message });
          }

          try {
            // STEP 1: Burahin ang lumang masterlist
            await new Promise((resolve, reject) => {
              transaction.query('DELETE FROM CUSTOMER_DATABASE', (dErr) => {
                if (dErr) return reject(dErr);
                resolve();
              });
            });

            // STEP 2: I-reset ang Generator ID
            await new Promise((resolve) => {
              transaction.query('SET GENERATOR GEN_CUSTOMER_ID TO 0', () => resolve());
            });

            // STEP 3: Batch Insertion sa pamamagitan ng Chunks (100 rows per round)
            const insertSql = `
              INSERT INTO CUSTOMER_DATABASE (
                ID, ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, METER_NUMBER, CREATED_DATE
              ) VALUES (
                GEN_ID(GEN_CUSTOMER_ID, 1), ?, ?, ?, ?, CURRENT_TIMESTAMP
              )
            `;

            const CHUNK_SIZE = 100;
            for (let i = 0; i < mappedRows.length; i += CHUNK_SIZE) {
              const chunk = mappedRows.slice(i, i + CHUNK_SIZE);
              await Promise.all(chunk.map(item => {
                return new Promise((resolve, reject) => {
                  transaction.query(insertSql, [item.accNo, item.name, item.address, item.meterNo], (qErr) => {
                    if (qErr) return reject(qErr);
                    resolve();
                  });
                });
              }));
            }

            // STEP 4: Commit transaction
            transaction.commit((cErr) => {
              fbDb.detach();
              if (cErr) {
                return res.status(500).json({ success: false, message: 'Commit failed: ' + cErr.message });
              }

              console.log(`✅ OVERWRITE COMPLETE: ${mappedRows.length} records ang naipasok!`);
              return res.json({
                success: true,
                message: `Tagumpay! ${mappedRows.length} concessionaires ang na-load sa Master Database!`,
                totalProcessed: mappedRows.length
              });
            });

          } catch (batchErr) {
            transaction.rollback();
            fbDb.detach();
            console.error('Batch error:', batchErr);
            return res.status(500).json({ success: false, message: 'Upload Failed: ' + batchErr.message });
          }
        });
      });

    } catch (err) {
      console.error('Upload Error:', err);
      return res.status(500).json({ success: false, message: err.message });
    }
  },

  // 3. UNIVERSAL CUSTOMER SEARCH (Index Friendly & Zero-Padding Fallback)
  async searchCustomerPattern(req, res) {
    const { part1, part3, fullAccount } = req.query;

    try {
      if (fullAccount) {
        // Direct indexed lookup
        const cleanFull = fullAccount.trim().toUpperCase();
        const sql = `SELECT FIRST 1 ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, METER_NUMBER FROM CUSTOMER_DATABASE WHERE ACCOUNT_NUMBER = ?`;
        const rows = await db.query(sql, [cleanFull]);
        if (rows && rows.length > 0) return res.json({ success: true, found: true, customer: rows[0] });
        return res.json({ success: true, found: false });
      }

      if (part1 && part3) {
        const rawP1 = part1.trim().toUpperCase();
        const rawP3 = part3.trim().toUpperCase();

        const p1Padded = rawP1.padStart(3, '0');
        const p3Padded = rawP3.padStart(3, '0');

        // Tinanggal ang UPPER(ACCOUNT_NUMBER) para aktibong magamit ang Index
        const searchSql = `
          SELECT FIRST 1 ACCOUNT_NUMBER, ACCOUNT_NAME, ADDRESS, METER_NUMBER 
          FROM CUSTOMER_DATABASE 
          WHERE ACCOUNT_NUMBER LIKE ? 
             OR ACCOUNT_NUMBER LIKE ? 
             OR ACCOUNT_NUMBER LIKE ? 
             OR ACCOUNT_NUMBER LIKE ?
        `;

        const patterns = [
          `${p1Padded}-%-${p3Padded}`,
          `${rawP1}-%-${rawP3}`,
          `${p1Padded}-%-${rawP3}`,
          `${rawP1}-%-${p3Padded}`
        ];

        const rows = await db.query(searchSql, patterns);

        if (rows && rows.length > 0) {
          return res.json({ success: true, found: true, customer: rows[0] });
        }

        return res.json({ success: true, found: false });
      }

      return res.status(400).json({ success: false, message: 'Kulang ang parameters.' });

    } catch (err) {
      console.error('Universal Search Error:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  },

  // 4. Manual Wipe
  async clearDatabase(req, res) {
    try {
      await db.query('DELETE FROM CUSTOMER_DATABASE');
      res.json({ success: true, message: 'Lahat ng Concessionaire records ay nabura na.' });
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
};

module.exports = ExcelUploadController;