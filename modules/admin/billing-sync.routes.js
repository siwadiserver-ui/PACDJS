const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const { createClient } = require('@supabase/supabase-js');

// Configuration Paths (Naka-point pabalik sa config folder sa root ng project)
const SENDER_CONFIG_PATH = path.join(__dirname, '../../config', 'sender-config.json');

// Supabase Configuration
const SUPABASE_URL = 'https://eavuwdjjmofxuwhtompp.supabase.co';
const SUPABASE_KEY = 'sb_publishable_kRq0ET-3jP4Ul6DoGSxjrQ_GqmVdPaI';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = (io) => {
  // ============================================
  // 1. SENDER CONFIG
  // ============================================
  router.get('/sender-config', (req, res) => {
    try {
      if (fs.existsSync(SENDER_CONFIG_PATH)) {
        const config = JSON.parse(fs.readFileSync(SENDER_CONFIG_PATH, 'utf8'));
        res.json({ success: true, config });
      } else {
        res.json({ success: true, config: null });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post('/sender-config', (req, res) => {
    try {
      const { email, pass } = req.body;
      if (!email || !pass) return res.status(400).json({ success: false, error: 'Kailangan ang email at password.' });
      
      const configDir = path.dirname(SENDER_CONFIG_PATH);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      fs.writeFileSync(SENDER_CONFIG_PATH, JSON.stringify({ email, pass }, null, 2), 'utf8');
      res.json({ success: true, message: 'Nai-save ang sender credentials!' });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ============================================
  // 2. ZONE CONFIG (Supabase-based)
  // ============================================
  router.get('/zone-config', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'zone_config')
        .maybeSingle();

      if (error) throw new Error(error.message);

      if (!data || !data.value) {
        return res.json({});
      }

      const config = typeof data.value === 'string' 
        ? JSON.parse(data.value) 
        : data.value;

      res.json(config);
    } catch (err) {
      console.error('❌ Zone config fetch error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/zone-config', async (req, res) => {
    try {
      const configData = req.body;
      configData.last_saved = new Date().toISOString();

      const { error } = await supabase
        .from('settings')
        .upsert(
          {
            key: 'zone_config',
            value: JSON.stringify(configData),
            updated_at: new Date().toISOString()
          },
          { onConflict: 'key' }
        );

      if (error) throw new Error(error.message);

      console.log('✅ Zone config saved to Supabase');
      res.json({ success: true });
    } catch (err) {
      console.error('❌ Zone config save error:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // ============================================
  // 3. DIRECT EXCEL TO SUPABASE
  // ============================================
  router.post('/excel-to-supabase', async (req, res) => {
    try {
      const { data } = req.body;
      
      if (!data || !data.length) {
        return res.status(400).json({ success: false, error: 'Walang data na ipinasa.' });
      }
      
      console.log(`📊 Received ${data.length} rows from Excel`);
      
      const headers = data[0];
      const dataRows = data.slice(1).filter(row => row[0]);
      
      const columnMap = {
        'Account No.': 'account_no',
        'Name': 'name',
        'Address': 'address',
        'No.': 'meter_no',
        'BALANCE': 'balance',
        'AROBALANCE': 'arobalance',
        'Total': 'total',
        'Status': 'status',
        'Zone': 'zone',
        'Due Date': 'due_date',
        'Status for App': 'status_for_app',
        'Reading Date': 'reading_date',
        'Discon Date': 'discon_date'
      };
      
      const colIndexes = {};
      headers.forEach((h, i) => {
        const mapped = columnMap[String(h).trim()];
        if (mapped) colIndexes[mapped] = i;
      });
      
      const records = dataRows.map(row => {
        const record = {};
        for (const [supabaseCol, sheetIdx] of Object.entries(colIndexes)) {
          let value = row[sheetIdx];
          
          if (supabaseCol === 'account_no') {
            value = String(value || '').replace(/\D/g, '');
            if (value.length === 9) {
              value = `${value.slice(0,3)}-${value.slice(3,6)}-${value.slice(6,9)}`;
            }
          }
          
          if (['balance', 'arobalance', 'total'].includes(supabaseCol)) {
            value = parseFloat(String(value || '0').replace(/[^0-9.-]/g, '')) || 0;
          }
          
          if (['due_date', 'reading_date', 'discon_date'].includes(supabaseCol)) {
            value = value ? String(value).trim() : null;
          }
          
          if (typeof value === 'string') value = value.trim();
          
          record[supabaseCol] = value;
        }
        return record;
      });
      
      console.log(`✅ Transformed ${records.length} records`);
      
      console.log('🗑️ Deleting existing rows...');
      const { error: deleteError } = await supabase
        .from('balances')
        .delete()
        .gt('id', 0);
      
      if (deleteError) {
        throw new Error('Delete failed: ' + deleteError.message);
      }
      
      const BATCH_SIZE = 500;
      let uploaded = 0;
      
      for (let i = 0; i < records.length; i += BATCH_SIZE) {
        const batch = records.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
          .from('balances')
          .insert(batch);
        
        if (insertError) {
          throw new Error('Insert failed: ' + insertError.message);
        }
        
        uploaded += batch.length;
        console.log(`📤 Uploaded ${uploaded}/${records.length}`);
      }
      
      console.log(`🎉 Direct sync complete! ${records.length} rows`);
      res.json({ success: true, count: records.length });
      
    } catch (err) {
      console.error('❌ Direct Excel sync error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ============================================
  // 4. GET BALANCES FROM SUPABASE
  // ============================================
  router.get('/balances', async (req, res) => {
    try {
      const { data, error } = await supabase
        .from('balances')
        .select('*');
      
      if (error) throw new Error(error.message);
      
      res.json({ success: true, balances: data || [], count: (data || []).length });
    } catch (err) {
      console.error('❌ Balances fetch error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ============================================
  // 4.5 MATCH BILLING EMAILS
  // ============================================
  router.post('/match-billing-emails', async (req, res) => {
    try {
      function normalizeAccountNumber(val) {
        if (!val) return '';
        const cleaned = String(val).replace(/\D/g, '').trim();
        return cleaned.replace(/^0+/, '');
      }

      let allBalances = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('balances')
          .select('*')
          .range(from, from + step - 1);

        if (error) throw new Error(error.message);
        if (!data || data.length === 0) break;
        allBalances.push(...data);
        if (data.length < step) break;
        from += step;
      }

      const { data: emailsData, error: emailError } = await supabase
        .from('emails')
        .select('*')
        .range(0, 5000);

      if (emailError) throw new Error(emailError.message);

      const balances = allBalances;
      const emails = emailsData || [];

      console.log(`📊 Balances nakuha: ${balances.length}, Emails nakuha: ${emails.length}`);

      const now = new Date();
      const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const emailMap = new Map();
      emails.forEach(row => {
        const rawAcc = row.account_number || row.account_no || '';
        const norm = normalizeAccountNumber(rawAcc);
        const mail = String(row.email_address || row.email || '').trim();

        if (norm && mail && mail.includes('@')) {
          emailMap.set(norm, {
            email: mail,
            timestamp: row.timestamp || null,
            contactNumber: row.contact_number || null
          });
        }
      });

      const matched = [];
      let newCount = 0;

      balances.forEach(row => {
        const rawAcc = String(row.account_no || '').trim();
        const normAcc = normalizeAccountNumber(rawAcc);
        const emailData = emailMap.get(normAcc);

        if (emailData) {
          let isNew = false;
          if (emailData.timestamp) {
            const emailTime = new Date(emailData.timestamp);
            isNew = emailTime > twentyFourHoursAgo;
          }

          if (isNew) newCount++;

          matched.push({
            accountNo: rawAcc,
            name: row.name || '',
            address: row.address || '',
            meterNo: row.meter_no || '',
            balance: row.balance || '0',
            arobalance: row.arobalance || '0',
            total: row.total || '0',
            status: row.status || '',
            zone: row.zone || '',
            dueDate: row.due_date || '',
            readingDate: row.reading_date || '',
            disconDate: row.discon_date || '',
            email: emailData.email,
            contactNumber: emailData.contactNumber || '',
            isNew: isNew,
            emailTimestamp: emailData.timestamp 
          });
        }
      });

      console.log(`✅ Matched: ${matched.length} out of ${balances.length} accounts`);

      res.json({ 
        success: true, 
        matched,
        newCount
      });
    } catch (err) {
      console.error('Match error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ============================================
  // DELETE EMAIL BY ACCOUNT NUMBER
  // ============================================
  router.delete('/delete-email/:accountNo', async (req, res) => {
    try {
      const { accountNo } = req.params;
      
      if (!accountNo) {
        return res.status(400).json({ success: false, error: 'Kailangan ang account number.' });
      }
      
      const formattedAccountNo = String(accountNo).trim();
      
      const { error } = await supabase
        .from('emails')
        .delete()
        .eq('account_number', formattedAccountNo);
      
      if (error) {
        throw new Error(error.message);
      }
      
      console.log(`✅ Deleted email for account: ${formattedAccountNo}`);
      res.json({ success: true, message: `Deleted email for ${formattedAccountNo}` });
    } catch (err) {
      console.error('❌ Delete error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

    // ============================================
  // 5. SEND BILLING EMAILS (OPTIMIZED: Chunked Concurrency)
  // ============================================
  router.post('/send-billing-emails', async (req, res) => {
    try {
      const { senderEmail, senderPass, records } = req.body;
      if (!senderEmail || !senderPass || !Array.isArray(records) || records.length === 0) {
        return res.status(400).json({ success: false, error: 'Kulang ang parameters sa pagpapadala.' });
      }

      // Pinapanatiling bukas ang connection (pool: true) para mas mabilis
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        pool: true,
        maxConnections: 5,
        auth: { user: senderEmail, pass: senderPass },
        connectionTimeout: 15000,
        greetingTimeout: 15000,
        socketTimeout: 15000
      });

      let sentCount = 0;
      let processedCount = 0;
      const errors = [];
      const total = records.length;
      const BATCH_CONCURRENCY = 5; // 5 sabay-sabay na emails

      for (let i = 0; i < records.length; i += BATCH_CONCURRENCY) {
        const batch = records.slice(i, i + BATCH_CONCURRENCY);

        await Promise.all(
          batch.map(async (rec) => {
            try {
              const htmlContent = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #e2e8f0; border-radius: 10px; padding: 20px; color: #1e293b;">
                  <h2 style="color: #1e3c72; border-bottom: 2px solid #0284c7; padding-bottom: 8px;">Siniloan Water District</h2>
                  <p>Magandang araw, <strong>${rec.name}</strong>!</p>
                  <p>Ito ang inyong Electronic Statement of Account para sa Account No: <strong>${rec.accountNo}</strong>.</p>
                  
                  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
                    <tr style="background: #f8fafc;"><td style="padding: 8px; border: 1px solid #cbd5e1;">Water Bill:</td><td style="padding: 8px; border: 1px solid #cbd5e1;">₱${rec.balance}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #cbd5e1;">S.C. / Materials:</td><td style="padding: 8px; border: 1px solid #cbd5e1;">₱${rec.arobalance}</td></tr>
                    <tr style="background: #e0f2fe; font-weight: bold;"><td style="padding: 8px; border: 1px solid #cbd5e1;">KABUUANG BABAYARAN:</td><td style="padding: 8px; border: 1px solid #cbd5e1; color: #b91c1c; font-size: 16px;">₱${rec.total}</td></tr>
                    <tr><td style="padding: 8px; border: 1px solid #cbd5e1;">Due Date:</td><td style="padding: 8px; border: 1px solid #cbd5e1;">${rec.dueDate}</td></tr>
                    <tr style="background: #fef2f2;"><td style="padding: 8px; border: 1px solid #cbd5e1;">Disconnection Date:</td><td style="padding: 8px; border: 1px solid #cbd5e1; color: #dc2626;">${rec.disconDate}</td></tr>
                  </table>

                  <p style="font-size: 12px; color: #64748b;">Maaari kayong magbayad sa SIWADI Main Office o via GCash. Maraming salamat sa inyong patuloy na pagtangkilik! Kung alam nyo po na isang buwan lang ang inyong bayarin, i disregard po ang Disconnection Date. Para sa inyong mga katanungan, maaari kayong tumawag sa aming hotline sa (049) 501-6656.</p>
                </div>
              `;

              await transporter.sendMail({
                from: `"Siniloan Water District" <${senderEmail}>`,
                to: rec.email,
                subject: `SIWADI Water Bill Notice - Acc #${rec.accountNo}`,
                html: htmlContent
              });

              sentCount++;
            } catch (mailErr) {
              errors.push({ account: rec.accountNo, error: mailErr.message });
            } finally {
              processedCount++;
              if (io) {
                io.emit('email_send_progress', {
                  current: processedCount,
                  total: total,
                  accountNo: rec.accountNo,
                  name: rec.name,
                  percent: Math.round((processedCount / total) * 100)
                });
              }
            }
          })
        );
      }

      transporter.close();

      res.json({
        success: true,
        message: `Matagumpay na naipadala ang ${sentCount} sa ${records.length} billing emails.`,
        errors
      });
    } catch (err) {
      console.error('Send error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ============================================
  // 6. INQUIRY ENDPOINTS (List, Stats, Delete)
  // ============================================
  router.get('/inquiries', async (req, res) => {
    try {
      const { accountNo, name, limit } = req.query;
      
      let query = supabase
        .from('inquiries')
        .select('*')
        .order('inquiry_at', { ascending: false });
      
      if (accountNo) query = query.ilike('account_no', `%${accountNo}%`);
      if (name) query = query.ilike('name', `%${name}%`);
      query = query.limit(parseInt(limit) || 500);
      
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      
      res.json({ success: true, inquiries: data || [], count: (data || []).length });
    } catch (err) {
      console.error('❌ Inquiries fetch error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get('/inquiries/stats', async (req, res) => {
    try {
      const { count: totalCount } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true });
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const { count: todayCount } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true })
        .gte('inquiry_at', today.toISOString());
      
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      
      const { count: weekCount } = await supabase
        .from('inquiries')
        .select('*', { count: 'exact', head: true })
        .gte('inquiry_at', weekAgo.toISOString());
      
      res.json({
        success: true,
        stats: {
          total: totalCount || 0,
          today: todayCount || 0,
          lastWeek: weekCount || 0
        }
      });
    } catch (err) {
      console.error('❌ Stats error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.delete('/inquiries/:id', async (req, res) => {
    try {
      const { id } = req.params;
      if (!id) return res.status(400).json({ success: false, error: 'Kailangan ang inquiry ID.' });
      
      const { error } = await supabase
        .from('inquiries')
        .delete()
        .eq('id', id);
      
      if (error) throw new Error(error.message);
      
      res.json({ success: true, message: `Deleted inquiry ID ${id}` });
    } catch (err) {
      console.error('❌ Delete error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ============================================
  // 7. BACKUP ENDPOINT
  // ============================================
  router.get('/backup', async (req, res) => {
    try {
      console.log('💾 Starting backup...');

      function arrayToCSV(data) {
        if (!data || data.length === 0) return '';
        const headers = Object.keys(data[0]);
        const csvRows = [];
        
        csvRows.push(headers.map(h => `"${String(h).replace(/"/g, '""')}"`).join(','));
        
        data.forEach(row => {
          const values = headers.map(h => {
            let val = row[h];
            if (val === null || val === undefined) val = '';
            if (typeof val === 'object') val = JSON.stringify(val);
            return `"${String(val).replace(/"/g, '""')}"`;
          });
          csvRows.push(values.join(','));
        });
        return csvRows.join('\n');
      }

      const tables = ['settings', 'emails', 'inquiries'];
      const backupData = {};

      for (const table of tables) {
        const { data, error } = await supabase.from(table).select('*');
        backupData[table] = error ? [] : (data || []);
      }

      let allBalances = [];
      let from = 0;
      const step = 1000;
      while (true) {
        const { data, error } = await supabase
          .from('balances')
          .select('*')
          .range(from, from + step - 1);
        
        if (error || !data || data.length === 0) break;
        allBalances.push(...data);
        if (data.length < step) break;
        from += step;
      }
      backupData.balances = allBalances;

      const csvFiles = {};
      for (const [tableName, tableData] of Object.entries(backupData)) {
        csvFiles[tableName] = arrayToCSV(tableData);
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      
      res.json({
        success: true,
        timestamp: timestamp,
        files: csvFiles,
        counts: {
          settings: backupData.settings.length,
          emails: backupData.emails.length,
          inquiries: backupData.inquiries.length,
          balances: backupData.balances.length
        }
      });
    } catch (err) {
      console.error('❌ Backup error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });

  return router;
};