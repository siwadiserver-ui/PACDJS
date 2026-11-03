let poolData = [];
let selectedRowId = null;

document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  loadDataPool();
  setupContextMenu();

  // 🔄 DITO ILALAGAY: Auto-fetch mula sa server bawat 5 segundo
  setInterval(() => {
    const isEditing = document.getElementById('editingRecordId')?.value;
    // Tiyaking hindi nag-e-edit ang user para hindi ma-overwrite ang form
    if (!isEditing) {
      loadDataPool();
    }
  }, 10000);
});

function initDefaults() {
  const now = new Date();

  // 🕒 Lokal na Petsa (YYYY-MM-DD)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // 🕒 Lokal na Oras (HH:mm)
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  
  const discDateInput = document.getElementById('discDate');
  const discTimeInput = document.getElementById('discTime');
  
  if (discDateInput) discDateInput.value = `${year}-${month}-${day}`;
  if (discTimeInput) discTimeInput.value = `${hours}:${minutes}`;
}

// 🔍 Auto-fill mula sa Search API (Kapareho ng Reconnection workflow)
async function onAccountEnter() {
  const p1 = (document.getElementById('accPart1')?.value || '').trim();
  const p3 = (document.getElementById('accPart3')?.value || '').trim();

  if (!p1 || !p3) {
    alert('Pakikompleto ang account number.');
    return;
  }

  try {
    const res = await fetch(`/api/disconnection/search-concessionaire?part1=${encodeURIComponent(p1)}&part3=${encodeURIComponent(p3)}`);
    const data = await res.json();

    if (data.success && data.found && data.customer) {
      const c = data.customer;

      // Hatiin ang 3 parts ng Account Number para mapunan ang accPart1, accPart2, at accPart3
      if (c.ACCOUNT_NUMBER && c.ACCOUNT_NUMBER.includes('-')) {
        const parts = c.ACCOUNT_NUMBER.split('-');
        if (parts.length === 3) {
          document.getElementById('accPart1').value = parts[0];
          document.getElementById('accPart2').value = parts[1];
          document.getElementById('accPart3').value = parts[2];
        }
      }

      if (document.getElementById('accountName')) document.getElementById('accountName').value = c.ACCOUNT_NAME || '';
      if (document.getElementById('address')) document.getElementById('address').value = c.ADDRESS || '';
      if (document.getElementById('meterNumber')) document.getElementById('meterNumber').value = c.METER_NUMBER || '';
      if (document.getElementById('meterStatus')) document.getElementById('meterStatus').value = 'MAGNETIC'; // 🎯 I-default sa MAGNETIC
      document.getElementById('reading')?.focus();
    } else {
      alert('Walang natagpuang Concessionaire para sa account na iyan.');
    }
  } catch (e) {
    console.error('Fetch error:', e);
    alert('Error fetching concessionaire: ' + e.message);
  }
}

// 📋 Load Disconnection Records papuntang Data Pool Table
async function loadDataPool() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/disconnection/list');
    const rawData = await res.json();
    
    // 🔒 I-sort mula sa pinakabagong ID (Latest to Oldest)
    poolData = (Array.isArray(rawData) ? rawData : []).sort((a, b) => Number(b.ID) - Number(a.ID));
    renderTable(poolData);
  } catch (err) {
    console.error('Error loading pool:', err);
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--danger);">Error loading data: ${err.message}</td></tr>`;
  }
}

// 🛠️ Formatter para laging 3-part (072-XXX-006 o 072-101-006)
function formatToThreePartAccount(rawAcc) {
  if (!rawAcc) return '';
  const parts = String(rawAcc).split('-').map(p => p.trim());

  if (parts.length >= 3) {
    const b = parts[0].padStart(3, '0');
    const m = parts[1];
    const s = parts[2].padStart(3, '0');
    return `${b}-<span style="color: var(--primary); font-weight: 800;">${m}</span>-${s}`;
  } 
  
  if (parts.length === 2) {
    const b = parts[0].padStart(3, '0');
    const s = parts[1].padStart(3, '0');
    return `${b}-<span style="color: var(--text-sec); font-weight: 800;">XXX</span>-${s}`;
  }

  return rawAcc;
}

function renderTable(data) {
  const filterElem = document.getElementById('statusFilter');
  const filter = filterElem ? filterElem.value : 'ALL';
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  const filtered = (Array.isArray(data) ? data : []).filter(d => {
    if (filter === 'ALL') return true;
    return (d.STATUS || '').toUpperCase() === filter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-sec);">Walang tala sa Data Pool.</td></tr>`;
    return;
  }

  const escapeHTML = str => String(str || '').replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));

  filtered.forEach(row => {
    const tr = document.createElement('tr');
    const dDate = row.DISCONNECTION_DATE ? new Date(row.DISCONNECTION_DATE).toLocaleDateString() : '';

    const formattedAcc = formatToThreePartAccount(row.ACCOUNT_NUMBER);

    tr.innerHTML = `
      <td><strong>#${escapeHTML(row.ID)}</strong></td>
      <td><strong>${formattedAcc}</strong></td>
      <td>${escapeHTML(row.ACCOUNT_NAME || '')}</td>
      <td>${escapeHTML(row.ADDRESS || '')}</td>
      <td>${escapeHTML(row.METER_NUMBER || '')}</td>
      <td>${escapeHTML(row.READING || 0)}</td>
      <td><strong>${escapeHTML(row.METER_STATUS || 'MAGNETIC')}</strong></td>
      <td>${escapeHTML(dDate)}</td>
      <td>${escapeHTML(row.DISCONNECTION_TIME || '')}</td>
      <td>${escapeHTML(row.REMARKS || '')}</td>
    `;

    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectedRowId = row.ID;
      showContextMenu(e.pageX, e.pageY);
    });

    tr.addEventListener('dblclick', () => {
      loadIntoForm(row);
    });

    tbody.appendChild(tr);
  });
}

function filterDataPool(keyword) {
  const q = keyword.trim().toUpperCase();
  if (!q) return renderTable(poolData);

  const matched = poolData.filter(d => 
    (d.ACCOUNT_NUMBER && d.ACCOUNT_NUMBER.toUpperCase().includes(q)) ||
    (d.ACCOUNT_NAME && d.ACCOUNT_NAME.toUpperCase().includes(q)) ||
    (d.METER_NUMBER && d.METER_NUMBER.toUpperCase().includes(q)) ||
    (d.DISCONNECTED_BY && d.DISCONNECTED_BY.toUpperCase().includes(q)) ||
    (d.REMARKS && d.REMARKS.toUpperCase().includes(q))
  );
  renderTable(matched);
}

// 💾 Submit na may kumpletong 3-part Account Number
async function submitDisconnection() {
  const p1 = (document.getElementById('accPart1')?.value || '').trim();
  const p2 = (document.getElementById('accPart2')?.value || '').trim();
  const p3 = (document.getElementById('accPart3')?.value || '').trim();
  
  const accountNo = (p1 && p3) ? `${p1}-${p2 || 'XXX'}-${p3}` : '';
  const editId = document.getElementById('editingRecordId')?.value;

  if (!accountNo || !document.getElementById('accountName')?.value.trim()) {
    alert('Pakilagay ang Account Number at Pangalan.');
    return;
  }

  const payload = {
    id: editId || null,
    account_number: accountNo,
    account_name: document.getElementById('accountName')?.value || '',
    address: document.getElementById('address')?.value || '',
    meter_number: document.getElementById('meterNumber')?.value || '',
    reading: parseFloat(document.getElementById('reading')?.value) || 0,
    meter_status: document.getElementById('meterStatus')?.value || 'MAGNETIC',
    disconnected_by: '', // 🎯 Gawing blangko na lang dahil inalis na sa HTML
    disconnection_date: document.getElementById('discDate')?.value || '',
    disconnection_time: document.getElementById('discTime')?.value || '',
    remarks: document.getElementById('remarks')?.value || '',
    plumber_remarks: document.getElementById('plumberRemarks')?.value || ''
  };

  const endpoint = editId ? '/api/disconnection/update' : '/api/disconnection/create';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      alert('✅ Na-save ang Disconnection record!');
      clearForm();
      loadDataPool();
    } else {
      alert('❌ Error: ' + (result.error || result.message || 'Hindi na-save.'));
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

// 🔄 I-load pabalik sa Form kapag nag-edit
function loadIntoForm(row) {
  if (document.getElementById('editingRecordId')) document.getElementById('editingRecordId').value = row.ID;
  if (document.getElementById('formHeaderTitle')) document.getElementById('formHeaderTitle').textContent = `Editing Record #${row.ID}`;
  if (document.getElementById('btnCancelEdit')) document.getElementById('btnCancelEdit').style.display = 'inline-block';
  if (document.getElementById('btnSubmitForm')) document.getElementById('btnSubmitForm').innerHTML = `<i class='bx bx-check'></i> Update Record`;

  if (row.ACCOUNT_NUMBER && row.ACCOUNT_NUMBER.includes('-')) {
    const parts = row.ACCOUNT_NUMBER.split('-');
    if (parts.length === 3) {
      document.getElementById('accPart1').value = parts[0];
      document.getElementById('accPart2').value = parts[1];
      document.getElementById('accPart3').value = parts[2];
    } else {
      document.getElementById('accPart1').value = parts[0] || '';
      document.getElementById('accPart2').value = 'XXX';
      document.getElementById('accPart3').value = parts[parts.length - 1] || '';
    }
  }

  if (document.getElementById('accountName')) document.getElementById('accountName').value = row.ACCOUNT_NAME || '';
  if (document.getElementById('address')) document.getElementById('address').value = row.ADDRESS || '';
  if (document.getElementById('meterNumber')) document.getElementById('meterNumber').value = row.METER_NUMBER || '';
  if (document.getElementById('reading')) document.getElementById('reading').value = row.READING || 0;
  if (document.getElementById('meterStatus')) document.getElementById('meterStatus').value = row.METER_STATUS || 'MAGNETIC';
  
  if (row.DISCONNECTION_DATE && document.getElementById('discDate')) {
    const d = new Date(row.DISCONNECTION_DATE);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    document.getElementById('discDate').value = `${yr}-${mo}-${dy}`;
  }
  if (document.getElementById('discTime')) document.getElementById('discTime').value = row.DISCONNECTION_TIME || '';
  if (document.getElementById('remarks')) document.getElementById('remarks').value = row.REMARKS || '';
  if (document.getElementById('plumberRemarks')) document.getElementById('plumberRemarks').value = row.PLUMBER_REMARKS || '';
}

// 🧹 Clear form na ibinabalik sa 'XXX' ang part2
function clearForm() {
  if (document.getElementById('editingRecordId')) document.getElementById('editingRecordId').value = '';
  if (document.getElementById('formHeaderTitle')) document.getElementById('formHeaderTitle').textContent = 'Disconnection Entry Details';
  if (document.getElementById('btnCancelEdit')) document.getElementById('btnCancelEdit').style.display = 'none';
  if (document.getElementById('btnSubmitForm')) document.getElementById('btnSubmitForm').innerHTML = `<i class='bx bx-save'></i> Save Entry`;
  
  if (document.getElementById('accPart1')) document.getElementById('accPart1').value = '';
  if (document.getElementById('accPart2')) document.getElementById('accPart2').value = 'XXX';
  if (document.getElementById('accPart3')) document.getElementById('accPart3').value = '';
  if (document.getElementById('accountName')) document.getElementById('accountName').value = '';
  if (document.getElementById('address')) document.getElementById('address').value = '';
  if (document.getElementById('meterNumber')) document.getElementById('meterNumber').value = '';
  if (document.getElementById('reading')) document.getElementById('reading').value = '';
  if (document.getElementById('meterStatus')) document.getElementById('meterStatus').value = 'MAGNETIC';
  if (document.getElementById('disconnectedBy')) document.getElementById('disconnectedBy').value = '';
  if (document.getElementById('remarks')) document.getElementById('remarks').value = '';
  if (document.getElementById('plumberRemarks')) document.getElementById('plumberRemarks').value = '';
  initDefaults();
}

function cancelEditMode() {
  clearForm();
}

function setupContextMenu() {
  const menu = document.getElementById('customContextMenu');
  if (!menu) return;
  document.addEventListener('click', () => menu.style.display = 'none');
}

function showContextMenu(x, y) {
  const menu = document.getElementById('customContextMenu');
  if (!menu) return;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = 'flex';
}

// ⚡ BAGONG DAGDAG: Ipadala ang kandidatong record papuntang Reconnection Module
function triggerSendToReconnection() {
  const menu = document.getElementById('customContextMenu');
  if (menu) menu.style.display = 'none';

  const row = poolData.find(d => d.ID === selectedRowId);
  if (!row) return;

  // I-imbak sa sessionStorage para basahin agad pagbukas ng Reconnection
  const reconCandidate = {
    accountNumber: row.ACCOUNT_NUMBER || '',
    accountName: row.ACCOUNT_NAME || '',
    address: row.ADDRESS || '',
    meterNumber: row.METER_NUMBER || '',
    reading: row.READING || 0,
    meterStatus: row.METER_STATUS || 'MAGNETIC'
  };
  sessionStorage.setItem('recon_prefill', JSON.stringify(reconCandidate));

  // Switch Module papuntang reconnection.html
  if (window.parent && typeof window.parent.loadModule === 'function') {
    window.parent.loadModule('/commercial/reconnection.html');
  } else {
    window.location.href = '/commercial/reconnection.html';
  }
}

function triggerEdit() {
  const row = poolData.find(d => d.ID === selectedRowId);
  if (row) loadIntoForm(row);
}

async function triggerDelete() {
  const menu = document.getElementById('customContextMenu');
  if (menu) menu.style.display = 'none';

  if (!selectedRowId) return;

  // 1. Initial Confirmation
  if (!confirm(`Sigurado ka bang nais mong burahin ang Disconnection Record #${selectedRowId}?`)) return;

  // 2. Security Check (Password Prompt)
  const pass = prompt('🔒 SECURITY CHECK:\nIlagay ang password upang kumpirmahin ang pagbura:');

  if (pass === null) return; // Kinansela ng user

  if (pass !== 'KUMAKALABUKAB' && pass !== 'kumakalabukab') {
    alert('❌ Mali ang password! Kanselado ang pagbura ng record.');
    return;
  }

  // 3. Pagpasa ng ID at Password sa backend
  try {
    const res = await fetch('/api/disconnection/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedRowId, password: pass })
    });
    const result = await res.json();
    if (result.success) {
      alert(`✅ Nabura na ang Disconnection Record #${selectedRowId}.`);
      if (document.getElementById('editingRecordId')?.value == selectedRowId) {
        clearForm();
      }
      loadDataPool();
    } else {
      alert('❌ Error deleting: ' + (result.error || result.message));
    }
  } catch (e) {
    alert('❌ Delete error: ' + e.message);
  }
}