window.SendEmailsModule = {
  DEFAULT_SHEET_URL: "https://docs.google.com/spreadsheets/d/1fzxNPlEjyk4OYvfq05z2EDtNlIB6RPNJRvxtmsKEpFA",
  matchedRecords: [],
  socket: null,

  init: function () {
    this.loadSavedCredentials();
    this.initSocket();
    this.injectUIControls();
    this.setupEvents();
  },

  initSocket: function () {
    if (typeof io !== 'undefined') {
      this.socket = io();
      this.socket.on('email_send_progress', (data) => {
        const bar = document.getElementById('emailProgressBar');
        const text = document.getElementById('emailProgressText');
        const count = document.getElementById('emailProgressCount');
        
        if (bar) bar.style.width = `${data.percent}%`;
        if (text) text.textContent = `${data.percent}% - Kasalukuyang pinapadala: ${data.name} (${data.accountNo})`;
        if (count) count.textContent = `${data.current} / ${data.total}`;
      });
    }
  },

// Magdagdag ng Zone Filter, Progress Bar, at Modal nang kusa sa view (Spotify Dark Theme)
  injectUIControls: function () {
    const tableContainer = document.getElementById('matchedListContainer');
    if (!tableContainer) return;

    // Filter controls sa itaas ng listahan (Dark Theme styled)
    if (!document.getElementById('zoneFilterWrapper')) {
      const filterDiv = document.createElement('div');
      filterDiv.id = 'zoneFilterWrapper';
      filterDiv.style.cssText = 'display:flex; gap:14px; align-items:center; margin: 14px 0; flex-wrap:wrap; padding: 14px 16px; background: #181818; border-radius: 8px; border: 1px solid #282828; color: #ffffff;';
      filterDiv.innerHTML = `
        <label style="font-weight:700; font-size:0.85rem; color:#b3b3b3; text-transform:uppercase; letter-spacing:0.05em;">Piliin ang Zone:</label>
        <select id="zoneSelector" style="flex:1; min-width:240px; padding: 10px 14px; border-radius: 6px; border: 1px solid #3e3e3e; background: #282828; color: #ffffff; font-weight: 600; font-size: 0.9rem; outline: none;">
          <option value="ALL">Lahat ng Zones (Zone 1-9)</option>
          <option value="1">Zone 1</option>
          <option value="2">Zone 2</option>
          <option value="3">Zone 3</option>
          <option value="4">Zone 4</option>
          <option value="5">Zone 5</option>
          <option value="6_9" style="font-weight:bold; color:#1db954;">Zone 6 & 9 (Pinagsama)</option>
          <option value="7">Zone 7</option>
          <option value="8">Zone 8</option>
        </select>
        <div style="margin-left:auto; display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
          <label style="font-size:0.88rem; font-weight:700; color:#ffffff; cursor:pointer; display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chkOnlyNew" style="width:16px; height:16px; accent-color:#f59e0b; cursor:pointer;">
            🆕 Mga Bagong Rehistro (Last 24h)
          </label>
          <label style="font-size:0.88rem; font-weight:700; color:#ffffff; cursor:pointer; display:flex; align-items:center; gap:8px;">
            <input type="checkbox" id="chkSelectAllAccounts" checked style="width:16px; height:16px; accent-color:#1db954; cursor:pointer;">
            Piliin Lahat (<span id="selectedCountDisplay" style="color:#1db954;">0</span>)
          </label>
        </div>
      `;
      tableContainer.parentNode.insertBefore(filterDiv, tableContainer);
    }

    // Real-time Progress Bar (Dark Theme styled)
    if (!document.getElementById('sendingProgressWrapper')) {
      const progressDiv = document.createElement('div');
      progressDiv.id = 'sendingProgressWrapper';
      progressDiv.style.cssText = 'display:none; margin: 16px 0; padding: 16px; background:#181818; border: 1px solid #282828; border-radius: 8px;';
      progressDiv.innerHTML = `
        <div style="display:flex; justify-content:space-between; margin-bottom: 8px; font-weight:700; font-size:0.85rem; color:#b3b3b3;">
          <span id="emailProgressText" style="color:#ffffff;">Inihahanda ang pagpapadala...</span>
          <span id="emailProgressCount" style="color:#1db954;">0 / 0</span>
        </div>
        <div style="background:#282828; border-radius:999px; height: 14px; overflow:hidden;">
          <div id="emailProgressBar" style="width:0%; height:100%; background: #1db954; transition: width 0.2s;"></div>
        </div>
      `;
      tableContainer.parentNode.insertBefore(progressDiv, tableContainer);
    }

    // Modal para sa Centered Success Notification
    if (!document.getElementById('centerSuccessModal')) {
      const modal = document.createElement('div');
      modal.id = 'centerSuccessModal';
      modal.style.cssText = 'display:none; position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(0, 0, 0, 0.8); z-index:99999; align-items:center; justify-content:center; backdrop-filter: blur(8px);';
      modal.innerHTML = `
        <div style="background:#202020; border: 1px solid #333333; border-radius:16px; padding: 32px 28px; width:90%; max-width:460px; text-align:center; box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <div style="font-size: 3.5rem; margin-bottom: 12px; line-height: 1;">🎉</div>
          <h3 style="margin: 0 0 10px 0; color:#ffffff; font-size:1.25rem; font-weight:800;">Email Sending Completed!</h3>
          <p id="centerSuccessMessage" style="color:#b3b3b3; font-size:0.92rem; line-height:1.6; margin-bottom: 24px;"></p>
          <button id="btnCloseCenterModal" style="background:#1db954; color:#000000; border:none; border-radius:999px; padding: 10px 32px; font-weight:700; font-size:0.95rem; cursor:pointer;">OK</button>
        </div>
      `;
      document.body.appendChild(modal);

      document.getElementById('btnCloseCenterModal').onclick = () => {
        modal.style.display = 'none';
      };
    }
  },

  loadSavedCredentials: async function () {
    try {
      const res = await fetch('/api/sender-config');
      const data = await res.json();
      if (data.success && data.config) {
        const emailInput = document.getElementById('senderEmail');
        const passInput = document.getElementById('senderPass');
        if (emailInput && data.config.email) emailInput.value = data.config.email;
        if (passInput && data.config.pass) passInput.value = data.config.pass;
      }
    } catch (err) {
      console.error('Error loading sender-config.json:', err);
    }
  },

  saveCredentialsToServer: async function () {
    const emailInput = document.getElementById('senderEmail');
    const passInput = document.getElementById('senderPass');
    const btnSave = document.getElementById('btnSaveSenderConfig');
    const msgLabel = document.getElementById('senderConfigMsg');

    const email = emailInput ? emailInput.value.trim() : '';
    const pass = passInput ? passInput.value.trim() : '';

    if (!email || !pass) {
      return alert('⚠️ Pakilagay muna ang Sender Gmail Address at App Password.');
    }

    if (btnSave) {
      btnSave.disabled = true;
      btnSave.textContent = '⏳ Sine-save...';
    }

    try {
      const res = await fetch('/api/sender-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, pass })
      });
      const data = await res.json();

      if (data.success) {
        alert('✅ Matagumpay na na-save ang sender credentials sa server (sender-config.json)!');
        if (msgLabel) {
          msgLabel.style.color = '#16a34a';
          msgLabel.style.fontWeight = 'bold';
          msgLabel.textContent = '✅ Naka-save na sa sender-config.json!';
        }
      } else {
        alert('❌ Error: ' + (data.error || 'Hindi ma-save.'));
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('❌ Connection error: Hindi maabot ang /api/sender-config');
    } finally {
      if (btnSave) {
        btnSave.disabled = false;
        btnSave.textContent = '💾 I-save Settings';
      }
    }
  },

  extractSpreadsheetId: function (urlOrId) {
    const match = String(urlOrId).match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : urlOrId;
  },

  // Pagsala ayon sa piniling Zone
  getFilteredRecords: function () {
    const selectedZone = document.getElementById('zoneSelector')?.value || 'ALL';
    const onlyNew = document.getElementById('chkOnlyNew')?.checked || false;
    
    return this.matchedRecords.filter(item => {
      // Zone filter
      const z = String(item.zone || '').trim();
      let zoneMatch = false;
      if (selectedZone === 'ALL') zoneMatch = true;
      else if (selectedZone === '6_9') zoneMatch = (z === '6' || z === '9');
      else zoneMatch = (z === selectedZone);
      
      // New filter (Option D)
      const newMatch = onlyNew ? item.isNew === true : true;
      
      return zoneMatch && newMatch;
    });
  },

  renderTable: function () {
    const tbody = document.getElementById('matchedTableBody');
    const filtered = this.getFilteredRecords();
    
    tbody.innerHTML = filtered.map((item, idx) => `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 6px 8px; text-align:center;">
          <input type="checkbox" class="account-item-chk" data-account="${item.accountNo}" checked>
        </td>
        <td style="padding: 6px 8px;"><strong>Zone ${item.zone || '-'}</strong></td>
        <td style="padding: 6px 8px;">${item.accountNo}</td>
        <td style="padding: 6px 8px;">${item.name}</td>
        <td style="padding: 6px 8px;">${item.email}</td>
        <td style="padding: 6px 8px;">${item.contactNumber || '-'}</td>
        <td style="padding: 6px 8px; font-weight: bold; color: #b91c1c;">₱${item.total}</td>
        <td style="padding: 6px 8px; color: #16a34a;">Ready</td>
        <td style="padding: 6px 8px; text-align:center;">
          <button class="btn-delete-email" 
                  data-account="${item.accountNo}" 
                  data-name="${item.name}"
                  data-email="${item.email}"
                  style="background:#dc2626; color:white; border:none; border-radius:6px; padding:6px 10px; font-size:11px; font-weight:700; cursor:pointer;">
            🗑️ Delete
          </button>
        </td>
      </tr>
    `).join('');

    this.updateSelectedCount();
    this.attachCheckboxEvents();
    this.attachDeleteHandlers();  // ← BAGO
  },

  // 🗑️ DELETE HANDLER
  attachDeleteHandlers: function () {
    document.querySelectorAll('.btn-delete-email').forEach(btn => {
      btn.addEventListener('click', async () => {
        const accountNo = btn.getAttribute('data-account');
        const name = btn.getAttribute('data-name');
        const email = btn.getAttribute('data-email');
        
        const confirmMsg = `Sigurado ka bang gusto mong i-delete ang email registration na ito?\n\nAccount: ${accountNo}\nName: ${name}\nEmail: ${email}\n\nHindi na ito maibabalik.`;
        
        if (!confirm(confirmMsg)) return;
        
        btn.disabled = true;
        btn.textContent = '⏳';
        
        try {
          const res = await fetch(`/api/delete-email/${encodeURIComponent(accountNo)}`, {
            method: 'DELETE'
          });
          
          const result = await res.json();
          
          if (result.success) {
            // I-remove ang row mula sa matchedRecords array
            this.matchedRecords = this.matchedRecords.filter(item => item.accountNo !== accountNo);
            
            // I-render muli ang table
            this.renderTable();
            
            // I-update ang summary
            const summaryText = document.getElementById('matchSummaryText');
            if (summaryText) {
              summaryText.innerHTML = `✅ Natagpuan: <strong>${this.matchedRecords.length}</strong> matched account(s) na may email.`;
            }
            
            alert(`✅ Na-delete na ang email registration para sa ${accountNo}.`);
          } else {
            alert(`❌ Hindi na-delete: ${result.error || 'Unknown error'}`);
            btn.disabled = false;
            btn.textContent = '🗑️ Delete';
          }
        } catch (err) {
          alert(`❌ Connection error: ${err.message}`);
          btn.disabled = false;
          btn.textContent = '🗑️ Delete';
        }
      });
    });
  },

  updateSelectedCount: function () {
    const count = document.querySelectorAll('.account-item-chk:checked').length;
    const disp = document.getElementById('selectedCountDisplay');
    const btnSend = document.getElementById('btnSendAllEmails');
    if (disp) disp.textContent = count;
    if (btnSend) btnSend.disabled = count === 0;
  },

  attachCheckboxEvents: function () {
    document.querySelectorAll('.account-item-chk').forEach(chk => {
      chk.addEventListener('change', () => this.updateSelectedCount());
    });
  },

  setupEvents: function () {
    const btnMatch = document.getElementById('btnFetchAndMatch');
    const btnSend = document.getElementById('btnSendAllEmails');
    const btnSave = document.getElementById('btnSaveSenderConfig');
    const tableContainer = document.getElementById('matchedListContainer');
    const summaryText = document.getElementById('matchSummaryText');
    const zoneSelector = document.getElementById('zoneSelector');
    const chkSelectAll = document.getElementById('chkSelectAllAccounts');
    const chkOnlyNew = document.getElementById('chkOnlyNew');

    if (btnSave) {
      btnSave.onclick = () => this.saveCredentialsToServer();
    }

    if (zoneSelector) {
      zoneSelector.addEventListener('change', () => {
        this.renderTable();
        if (chkSelectAll) chkSelectAll.checked = true;
      });
    }

    if (chkSelectAll) {
      chkSelectAll.addEventListener('change', (e) => {
        document.querySelectorAll('.account-item-chk').forEach(chk => {
          chk.checked = e.target.checked;
        });
        this.updateSelectedCount();
      });
    }

    if (chkOnlyNew) {
      chkOnlyNew.addEventListener('change', () => {
        this.renderTable();
        if (chkSelectAll) chkSelectAll.checked = true;
      });
    }

    if (!btnMatch) return;

    // Fetch and Match (Supabase-based)
    btnMatch.addEventListener('click', async () => {
      summaryText.textContent = "⏳ Kinukuha ang data mula Supabase...";
      tableContainer.style.display = 'none';

      try {
        const res = await fetch('/api/match-billing-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });
        const result = await res.json();

        if (result.success) {
          this.matchedRecords = result.matched || [];
          summaryText.innerHTML = `✅ Natagpuan: <strong>${this.matchedRecords.length}</strong> matched account(s) na may email.`;

          if (this.matchedRecords.length > 0) {
            tableContainer.style.display = 'block';
            this.renderTable();
          } else {
            btnSend.disabled = true;
          }
        } else {
          summaryText.textContent = `❌ Error: ${result.error}`;
        }
      } catch (err) {
        summaryText.textContent = `❌ Request Error: ${err.message}`;
      }
    });

    // Send Bills
    btnSend.addEventListener('click', async () => {
      const senderEmail = document.getElementById('senderEmail').value.trim();
      const senderPass = document.getElementById('senderPass').value.trim();

      if (!senderEmail || !senderPass) {
        return alert("Pakilagay ang iyong Sender Gmail at 16-character App Password.");
      }

      // Kunin lamang ang mga naka-check na accounts
      const checkedBoxes = Array.from(document.querySelectorAll('.account-item-chk:checked'));
      const selectedAccMap = new Set(checkedBoxes.map(b => b.getAttribute('data-account')));
      const recordsToSend = this.matchedRecords.filter(item => selectedAccMap.has(item.accountNo));

      if (recordsToSend.length === 0) {
        return alert("Pumili ng kahit isang subscriber na padadalhan ng bill.");
      }

      const proceed = confirm(`Sigurado ka bang nais mong magpadala ng bills sa ${recordsToSend.length} napiling customer(s)?`);
      if (!proceed) return;

      const progressWrapper = document.getElementById('sendingProgressWrapper');
      const progressBar = document.getElementById('emailProgressBar');
      const progressText = document.getElementById('emailProgressText');
      const progressCount = document.getElementById('emailProgressCount');

      if (progressWrapper) {
        progressWrapper.style.display = 'block';
        if (progressBar) progressBar.style.width = '0%';
        if (progressText) progressText.textContent = 'Inihahanda ang pagpapadala...';
        if (progressCount) progressCount.textContent = `0 / ${recordsToSend.length}`;
      }

      btnSend.disabled = true;

      try {
        const res = await fetch('/api/send-billing-emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            senderEmail,
            senderPass,
            records: recordsToSend
          })
        });

        const result = await res.json();

        if (result.success) {
          // Centered Modal Notification
          const modal = document.getElementById('centerSuccessModal');
          const msg = document.getElementById('centerSuccessMessage');
          if (modal && msg) {
            msg.innerHTML = `<strong>${result.message}</strong><br><br>Lahat ng napiling subscriber ay matagumpay na natanggap ang kanilang electronic bill notice.`;
            modal.style.display = 'flex';
          } else {
            alert(result.message);
          }
        } else {
          alert(`❌ Failed: ${result.error}`);
        }
      } catch (e) {
        alert(`❌ Send Error: ${e.message}`);
      } finally {
        btnSend.disabled = false;
      }
    });
  }
};