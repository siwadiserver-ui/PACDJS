const express = require('express');
const router = express.Router();
const db = require('../../config/db');

// 📅 Helper: Local Date Formatter (YYYY-MM-DD) na ligtas sa UTC timezone rollback
function formatLocalDate(dateObj) {
  const d = new Date(dateObj);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 🔧 Helper para basahin ang Firebird BLOB
const readBlobAsync = (blobField) => {
  return new Promise((resolve) => {
    if (!blobField) return resolve(null);
    if (typeof blobField === 'string') return resolve(blobField);
    if (typeof blobField === 'function') {
      blobField((err, name, eStream) => {
        if (err || !eStream) return resolve(null);
        let chunks = [];
        eStream.on('data', (chunk) => chunks.push(chunk));
        eStream.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
        eStream.on('error', () => resolve(null));
      });
    } else if (Buffer.isBuffer(blobField)) {
      resolve(blobField.toString('utf-8'));
    } else {
      resolve(null);
    }
  });
};

// 🔢 1. Dynamic Auto-Increment Reference Number (YY-MM-COUNT, tuloy-tuloy sa buong taon)
router.get('/next-ref', async (req, res) => {
  try {
    const now = new Date();
    const currentYear = now.getFullYear().toString().slice(-2); // '26'
    const currentMonth = String(now.getMonth() + 1).padStart(2, '0'); // '09'

    const sql = `
      SELECT REFERENCE_NUMBER 
      FROM SENIOR_CITIZEN_APPLICATIONS 
      WHERE REFERENCE_NUMBER LIKE ? 
    `;
    const rows = await db.query(sql, [`${currentYear}-%`]);

    let maxSeq = 0;
    if (rows && rows.length > 0) {
      for (const r of rows) {
        const val = (r.REFERENCE_NUMBER || '').trim();
        const parts = val.split('-');
        
        if (parts.length >= 3) {
          const numPart = parseInt(parts[2], 10);
          if (!isNaN(numPart) && numPart > maxSeq) {
            maxSeq = numPart;
          }
        } else if (parts.length === 2) {
          const numPart = parseInt(parts[1], 10);
          if (!isNaN(numPart) && numPart > maxSeq) {
            maxSeq = numPart;
          }
        }
      }
    }

    const nextSeq = maxSeq + 1;
    const nextSeqStr = String(nextSeq).padStart(3, '0');
    const newRefNumber = `${currentYear}-${currentMonth}-${nextSeqStr}`;

    res.json({ success: true, refNumber: newRefNumber });
  } catch (err) {
    console.error('❌ Error fetching next-ref:', err);
    res.status(500).json({ error: err.message });
  }
});

// 📋 2. Lightweight List (Mabilis: Inalis ang PHOTO_DATA sa payload ng buong talaan)
router.get('/list', async (req, res) => {
  try {
    const sql = `
      SELECT FIRST 500
        ID, REFERENCE_NUMBER, APPLICATION_TYPE, ACCOUNT_NUMBER,
        SURNAME, FIRSTNAME, MIDDLE_NAME, ADDRESS, CONTACT_NUMBER,
        REQUIREMENTS_SUBMITTED, ID_SUBMITTED, IS_REPRESENTATIVE,
        APPLICATION_DATE, EXPIRATION_DATE, STATUS, REMARKS
      FROM SENIOR_CITIZEN_APPLICATIONS
      ORDER BY ID DESC
    `;
    const rows = await db.query(sql);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

  const processed = (rows || []).map((r) => {
      let expiryStatus = 'ACTIVE';
      if (r.EXPIRATION_DATE) {
        const exp = new Date(r.EXPIRATION_DATE);
        exp.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((exp - today) / (1000 * 60 * 60 * 24));

        if (diffDays < 0) {
          expiryStatus = 'EXPIRED';
        } else if (diffDays <= 30) {
          expiryStatus = 'NEAR EXPIRY';
        }
      }

      // Ligtas na kunin ang YYYY-MM-DD nang walang timezone rollback
      const cleanAppDate = r.APPLICATION_DATE ? formatLocalDate(r.APPLICATION_DATE) : '';
      const cleanExpDate = r.EXPIRATION_DATE ? formatLocalDate(r.EXPIRATION_DATE) : '';

      return {
        ...r,
        APPLICATION_DATE: cleanAppDate,
        EXPIRATION_DATE: cleanExpDate,
        COMPUTED_STATUS: expiryStatus
      };
    });

    res.json(processed);
  } catch (err) {
    console.error('❌ Error in /api/commercial/senior/list:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🖼️ 2.1 Hiwalay na Endpoint para sa Litrato (Tatawagin kapag binuksan ang Profile / Card)
router.get('/photo/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const rows = await db.query('SELECT PHOTO_DATA FROM SENIOR_CITIZEN_APPLICATIONS WHERE ID = ?', [id]);
    
    if (!rows || !rows.length || !rows[0].PHOTO_DATA) {
      return res.json({ success: false, photo: null });
    }

    const base64Data = await readBlobAsync(rows[0].PHOTO_DATA);
    res.json({ success: true, photo: base64Data });
  } catch (err) {
    console.error('❌ Error fetching photo:', err);
    res.status(500).json({ error: err.message });
  }
});

// 💾 3. Create or Update Record (Tugma sa Local Timezone)
router.post('/save', async (req, res) => {
  try {
    const {
      id,
      reference_number,
      application_type,
      account_number,
      surname,
      firstname,
      middle_name,
      address,
      contact_number,
      requirements_submitted,
      id_submitted,
      is_representative,
      photo_data,
      application_date,
      remarks
    } = req.body;

    if (!reference_number || !account_number || !surname || !firstname) {
      return res.status(400).json({ error: 'Kailangan ang Ref #, Account #, Surname, at Firstname.' });
    }

    const cleanRef = reference_number.trim().toUpperCase();

    // Check duplicate reference number
    if (id) {
      const dupSql = `SELECT ID FROM SENIOR_CITIZEN_APPLICATIONS WHERE UPPER(REFERENCE_NUMBER) = ? AND ID <> ?`;
      const dupRows = await db.query(dupSql, [cleanRef, id]);
      if (dupRows && dupRows.length > 0) {
        return res.status(400).json({ error: `Ang Reference #${cleanRef} ay ginagamit na sa ibang tala.` });
      }
    } else {
      const dupSql = `SELECT ID FROM SENIOR_CITIZEN_APPLICATIONS WHERE UPPER(REFERENCE_NUMBER) = ?`;
      const dupRows = await db.query(dupSql, [cleanRef]);
      if (dupRows && dupRows.length > 0) {
        return res.status(400).json({ error: `May umiiral nang record na may Reference #${cleanRef}.` });
      }
    }

    // 1. Kunin nang direkta ang petsa mula sa form input nang walang new Date() parsing
    let appDateStr = '';
    if (application_date && typeof application_date === 'string' && application_date.trim()) {
      appDateStr = application_date.trim().split('T')[0];
    } else {
      const now = new Date();
      appDateStr = formatLocalDate(now);
    }

    // 2. Dagdagan ng 1 taon para sa expiration
    const parts = appDateStr.split('-');
    const expDateStr = `${parseInt(parts[0], 10) + 1}-${parts[1]}-${parts[2]}`;

    if (id) {
      // Gumamit ng CAST(? AS DATE) para piliting tanggapin ng Firebird ang bagong date string
      const updateSql = `
        UPDATE SENIOR_CITIZEN_APPLICATIONS SET
          REFERENCE_NUMBER = ?,
          APPLICATION_TYPE = ?,
          ACCOUNT_NUMBER = ?,
          SURNAME = ?,
          FIRSTNAME = ?,
          MIDDLE_NAME = ?,
          ADDRESS = ?,
          CONTACT_NUMBER = ?,
          REQUIREMENTS_SUBMITTED = ?,
          ID_SUBMITTED = ?,
          IS_REPRESENTATIVE = ?,
          PHOTO_DATA = COALESCE(?, PHOTO_DATA),
          APPLICATION_DATE = CAST(? AS DATE),
          EXPIRATION_DATE = CAST(? AS DATE),
          REMARKS = ?,
          UPDATED_DATE = CURRENT_TIMESTAMP
        WHERE ID = ?
      `;
      await db.query(updateSql, [
        cleanRef,
        (application_type || 'NEW').toUpperCase(),
        account_number.trim(),
        surname.trim().toUpperCase(),
        firstname.trim().toUpperCase(),
        (middle_name || '').trim().toUpperCase(),
        (address || '').trim().toUpperCase(),
        (contact_number || '').trim(),
        (requirements_submitted || '').trim(),
        (id_submitted || '').trim(),
        is_representative ? 1 : 0,
        photo_data || null,
        appDateStr,
        expDateStr,
        (remarks || '').trim(),
        parseInt(id, 10)
      ]);
      return res.json({ success: true, message: `Application #${cleanRef} updated successfully!` });
    }

    const insertSql = `
      INSERT INTO SENIOR_CITIZEN_APPLICATIONS (
        ID, REFERENCE_NUMBER, APPLICATION_TYPE, ACCOUNT_NUMBER,
        SURNAME, FIRSTNAME, MIDDLE_NAME, ADDRESS, CONTACT_NUMBER,
        REQUIREMENTS_SUBMITTED, ID_SUBMITTED, IS_REPRESENTATIVE,
        PHOTO_DATA, APPLICATION_DATE, EXPIRATION_DATE, STATUS, REMARKS
      ) VALUES (
        GEN_ID(GEN_SENIOR_CITIZEN_ID, 1),
        ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, CAST(? AS DATE), CAST(? AS DATE), 'ACTIVE', ?
      )
    `;

    await db.query(insertSql, [
      cleanRef,
      (application_type || 'NEW').toUpperCase(),
      account_number.trim(),
      surname.trim().toUpperCase(),
      firstname.trim().toUpperCase(),
      (middle_name || '').trim().toUpperCase(),
      (address || '').trim().toUpperCase(),
      (contact_number || '').trim(),
      (requirements_submitted || '').trim(),
      (id_submitted || '').trim(),
      is_representative ? 1 : 0,
      photo_data || null,
      appDateStr,
      expDateStr,
      (remarks || '').trim()
    ]);

    res.json({ success: true, message: `Application #${cleanRef} saved successfully!` });
  } catch (err) {
    console.error('❌ Error in /api/commercial/senior/save:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🗑️ 4. Delete Record (May Hardcoded Security Password Check)
router.post('/delete', async (req, res) => {
  try {
    const { id, password } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Kailangan ang Record ID.' });
    }

    // 🔒 Server-Side Security Password Verification
    if (password !== 'KUMAKALABUKAB' && password !== 'kumakalabukab') {
      return res.status(403).json({ error: 'Unauthorized: Mali ang security password!' });
    }

    await db.query('DELETE FROM SENIOR_CITIZEN_APPLICATIONS WHERE ID = ?', [id]);
    res.json({ success: true, message: 'Record deleted successfully!' });
  } catch (err) {
    console.error('❌ Error in /api/commercial/senior/delete:', err);
    res.status(500).json({ error: err.message });
  }
});

// 🖼️ 3.1 Update Photo Only Endpoint
router.post('/update-photo', async (req, res) => {
  try {
    const { id, photo_data } = req.body;

    if (!id) {
      return res.status(400).json({ error: 'Kailangan ang Record ID.' });
    }
    if (!photo_data) {
      return res.status(400).json({ error: 'Walang ibinigay na litrato.' });
    }

    const updateSql = `
      UPDATE SENIOR_CITIZEN_APPLICATIONS 
      SET PHOTO_DATA = ?, 
          UPDATED_DATE = CURRENT_TIMESTAMP
      WHERE ID = ?
    `;

    await db.query(updateSql, [photo_data, parseInt(id, 10)]);

    res.json({ success: true, message: 'Matagumpay na na-update ang litrato!' });
  } catch (err) {
    console.error('❌ Error updating photo:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;