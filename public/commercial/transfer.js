let poolData = [];
let selectedRowId = null;

document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  loadDataPool();
  setupContextMenu();
});

function initDefaults() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  const dateInput = document.getElementById('applicationDate');
  if (dateInput) dateInput.value = `${year}-${month}-${day}`;
}

// 🔍 Auto-fetch kapag pinindot ang Enter sa 3rd Account Box
async function onAccountEnter() {
  const p1 = (document.getElementById('accPart1')?.value || '').trim();
  const p3 = (document.getElementById('accPart3')?.value || '').trim();

  if (!p1 || !p3) {
    alert('Pakikompleto ang account number.');
    return;
  }

  const part1 = p1.padStart(2, '0');
  const part3 = p3.padStart(3, '0');

  try {
    const res = await fetch(`/api/transfer/search-account?p1=${encodeURIComponent(part1)}&p3=${encodeURIComponent(part3)}&q=${encodeURIComponent(`${p1}-${p3}`)}`);
    const results = await res.json();

    if (results && results.length > 0) {
      const match = results[0];
      document.getElementById('fromAccountName').value = match.ACCOUNT_NAME || '';
      document.getElementById('fromAddress').value = match.ADDRESS || '';
      document.getElementById('fromMeterNumber').value = match.METER_NUMBER || '';

      if (match.ACCOUNT_NUMBER && match.ACCOUNT_NUMBER.includes('-')) {
        const parts = match.ACCOUNT_NUMBER.split('-');
        if (parts.length === 3) {
          document.getElementById('accPart1').value = parts[0];
          document.getElementById('accPart2').value = parts[1];
          document.getElementById('accPart3').value = parts[2];
        }
      }

      document.getElementById('toAddress')?.focus();
    } else {
      alert('Walang natagpuang Concessionaire para sa account na iyan.');
      document.getElementById('accPart2').value = 'XXX';
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

// 📋 Load Table Data
async function loadDataPool() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/transfer/list');
    const rawData = await res.json();

    // 🔒 I-sort agad ayon sa ID mula pinakabago hanggang pinakaluma (Latest to Oldest)
    poolData = (Array.isArray(rawData) ? rawData : []).sort((a, b) => Number(b.ID) - Number(a.ID));
    renderTable(poolData);
  } catch (err) {
    console.error('Error loading pool:', err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger);">Error loading data: ${err.message}</td></tr>`;
  }
}

function renderTable(data) {
  const filter = document.getElementById('statusFilter').value;
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  const filtered = (Array.isArray(data) ? data : []).filter(d => {
    if (filter === 'ALL') return true;
    return (d.STATUS || '').toUpperCase() === filter;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-sec);">Walang tala sa Transfer Requests Pool.</td></tr>`;
    return;
  }

  filtered.forEach(row => {
    const tr = document.createElement('tr');
    const status = row.STATUS || 'PENDING';
    const statusClass = getStatusClass(status);

    tr.innerHTML = `
      <td><strong>${row.ACCOUNT_NUMBER || ''}</strong></td>
      <td>${row.ACCOUNT_NAME || ''}</td>
      <td>${row.FROM_ADDRESS || ''}</td>
      <td>${row.TO_ADDRESS || ''}</td>
      <td>${row.REQUIREMENT || ''}</td>
      <td>${row.APPLICATION_DATE || ''}</td>
      <td><span class="status-badge ${statusClass}">${status}</span></td>
      <td>${row.REMARKS || ''}</td>
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

function getStatusClass(status) {
  switch ((status || '').toUpperCase()) {
    case 'PROCESSING': return 'st-processing';
    case 'COMPLETED': return 'st-completed';
    case 'CANCELLED': return 'st-cancelled';
    default: return 'st-pending';
  }
}

function filterDataPool(keyword) {
  const q = keyword.trim().toUpperCase();
  if (!q) return renderTable(poolData);

  const matched = poolData.filter(d => 
    (d.ACCOUNT_NUMBER && d.ACCOUNT_NUMBER.toUpperCase().includes(q)) ||
    (d.ACCOUNT_NAME && d.ACCOUNT_NAME.toUpperCase().includes(q)) ||
    (d.FROM_ADDRESS && d.FROM_ADDRESS.toUpperCase().includes(q)) ||
    (d.TO_ADDRESS && d.TO_ADDRESS.toUpperCase().includes(q)) ||
    (d.REQUIREMENT && d.REQUIREMENT.toUpperCase().includes(q))
  );
  renderTable(matched);
}

// 💾 Submit / Update Transfer
async function submitTransferRequest() {
  const p1 = (document.getElementById('accPart1')?.value || '').trim();
  const p2 = (document.getElementById('accPart2')?.value || 'XXX').trim();
  const p3 = (document.getElementById('accPart3')?.value || '').trim();
  const fullAccount = `${p1}-${p2}-${p3}`;

  const editId = document.getElementById('editingRecordId')?.value;

  const payload = {
    id: editId || null,
    account_number: fullAccount,
    account_name: document.getElementById('fromAccountName').value,
    from_address: document.getElementById('fromAddress').value,
    from_meter_number: document.getElementById('fromMeterNumber').value,
    to_address: document.getElementById('toAddress').value,
    to_contact_number: document.getElementById('toContactNumber').value,
    to_meter_number: document.getElementById('toMeterNumber').value,
    application_date: document.getElementById('applicationDate').value,
    requirement: document.getElementById('requirement').value,
    remarks: document.getElementById('remarks').value,
    status: document.getElementById('status').value
  };

  const endpoint = editId ? '/api/transfer/update' : '/api/transfer/create';

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      alert(`✅ ${result.message}`);
      clearForm();
      loadDataPool();
    } else {
      alert('❌ Error: ' + (result.error || 'Hindi na-save.'));
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

function loadIntoForm(row) {
  document.getElementById('editingRecordId').value = row.ID;
  document.getElementById('formHeaderTitle').textContent = `Edit Transfer Request: ${row.ACCOUNT_NUMBER}`;
  document.getElementById('btnCancelEdit').style.display = 'inline-block';
  document.getElementById('btnSubmitForm').innerHTML = `<i class='bx bx-check'></i> Save Edit`;

  if (row.ACCOUNT_NUMBER && row.ACCOUNT_NUMBER.includes('-')) {
    const parts = row.ACCOUNT_NUMBER.split('-');
    if (parts.length === 3) {
      document.getElementById('accPart1').value = parts[0];
      document.getElementById('accPart2').value = parts[1];
      document.getElementById('accPart3').value = parts[2];
    } else {
      document.getElementById('accPart1').value = row.ACCOUNT_NUMBER;
    }
  } else {
    document.getElementById('accPart1').value = row.ACCOUNT_NUMBER || '';
  }

  document.getElementById('fromAccountName').value = row.ACCOUNT_NAME || '';
  document.getElementById('fromAddress').value = row.FROM_ADDRESS || '';
  document.getElementById('fromMeterNumber').value = row.FROM_METER_NUMBER || '';
  document.getElementById('toAddress').value = row.TO_ADDRESS || '';
  document.getElementById('toContactNumber').value = row.TO_CONTACT_NUMBER || '';
  document.getElementById('toMeterNumber').value = row.TO_METER_NUMBER || '';
  document.getElementById('applicationDate').value = row.APPLICATION_DATE || '';
  
  // 📝 Tumatanggap na ng kahit anong custom o piniling requirement
  document.getElementById('requirement').value = row.REQUIREMENT || 'Proof of Ownership/Brgy. Permit';
  
  document.getElementById('status').value = row.STATUS || 'PENDING';
  document.getElementById('remarks').value = row.REMARKS || '';
}

function clearForm() {
  document.getElementById('editingRecordId').value = '';
  document.getElementById('formHeaderTitle').textContent = 'Account Transfer Request';
  document.getElementById('btnCancelEdit').style.display = 'none';
  document.getElementById('btnSubmitForm').innerHTML = `<i class='bx bx-save'></i> Submit Transfer`;

  document.getElementById('accPart1').value = '';
  document.getElementById('accPart2').value = 'XXX';
  document.getElementById('accPart3').value = '';
  document.getElementById('fromAccountName').value = '';
  document.getElementById('fromAddress').value = '';
  document.getElementById('fromMeterNumber').value = '';
  document.getElementById('toAddress').value = '';
  document.getElementById('toContactNumber').value = '';
  document.getElementById('toMeterNumber').value = '';
  
  // Reset sa default requirement text
  document.getElementById('requirement').value = 'Proof of Ownership/Brgy. Permit';
  document.getElementById('status').value = 'PENDING';
  document.getElementById('remarks').value = '';
  
  initDefaults();
}

function cancelEditMode() {
  clearForm();
}

function setupContextMenu() {
  const menu = document.getElementById('customContextMenu');
  document.addEventListener('click', () => { if (menu) menu.style.display = 'none'; });
}

function showContextMenu(x, y) {
  const menu = document.getElementById('customContextMenu');
  if (!menu) return;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = 'flex';
}

function triggerEdit() {
  const row = poolData.find(d => d.ID === selectedRowId);
  if (row) loadIntoForm(row);
}

async function triggerMarkCompleted() {
  const row = poolData.find(d => d.ID === selectedRowId);
  if (!row) return;

  if (!confirm(`Mark transfer request for ${row.ACCOUNT_NAME} as COMPLETED?`)) return;

  try {
    const res = await fetch('/api/transfer/mark-completed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedRowId })
    });
    const result = await res.json();
    if (result.success) {
      loadDataPool();
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (e) {
    alert('❌ Error: ' + e.message);
  }
}

async function triggerDelete() {
  const row = poolData.find(d => d.ID === selectedRowId);
  if (!row) return;

  // 1. Initial Confirmation
  if (!confirm(`Sigurado ka bang nais mong burahin ang Transfer Request para kay ${row.ACCOUNT_NAME}?`)) return;

  // 2. Security Check (Password Prompt)
  const pass = prompt('🔒 SECURITY CHECK:\nIlagay ang password upang kumpirmahin ang pagbura:');

  if (pass === null) return; // Kinansela ng user

  if (pass !== 'KUMAKALABUKAB' && pass !== 'kumakalabukab') {
    alert('❌ Mali ang password! Kanselado ang pagbura ng record.');
    return;
  }

  // 3. Pagpasa ng ID at Password sa backend
  try {
    const res = await fetch('/api/transfer/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedRowId, password: pass })
    });
    const result = await res.json();
    if (result.success) {
      alert('Transfer request deleted.');
      loadDataPool();
      clearForm();
    } else {
      alert('❌ Error: ' + (result.error || result.message));
    }
  } catch (e) {
    alert('❌ Delete error: ' + e.message);
  }
}

// 📊 Export Transfer Requests to Excel
function exportTransfersToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Hindi ma-load ang Excel library. Pakisuri ang iyong koneksyon.');
    return;
  }

  const filterElem = document.getElementById('statusFilter');
  const filter = filterElem ? filterElem.value : 'ALL';
  const searchVal = (document.getElementById('searchTableInput')?.value || '').trim().toUpperCase();

  // Kuhanin ang kasalukuyang naka-filter o naka-search na records
  let targetData = (Array.isArray(poolData) ? poolData : []).filter(d => {
    const matchesStatus = (filter === 'ALL') || ((d.STATUS || '').toUpperCase() === filter);
    if (!matchesStatus) return false;

    if (!searchVal) return true;
    return (
      (d.ACCOUNT_NUMBER && d.ACCOUNT_NUMBER.toUpperCase().includes(searchVal)) ||
      (d.ACCOUNT_NAME && d.ACCOUNT_NAME.toUpperCase().includes(searchVal)) ||
      (d.FROM_ADDRESS && d.FROM_ADDRESS.toUpperCase().includes(searchVal)) ||
      (d.TO_ADDRESS && d.TO_ADDRESS.toUpperCase().includes(searchVal)) ||
      (d.REQUIREMENT && d.REQUIREMENT.toUpperCase().includes(searchVal))
    );
  });

  if (targetData.length === 0) {
    alert('Walang records na mai-export batay sa kasalukuyang filter/search.');
    return;
  }

  // I-format ang columns na kumpleto sa impormasyon ng transfer
  const exportRows = targetData.map(row => ({
    'Account Number': row.ACCOUNT_NUMBER || '',
    'Account Name': row.ACCOUNT_NAME || '',
    'Current Address (From)': row.FROM_ADDRESS || '',
    'Current Meter #': row.FROM_METER_NUMBER || '',
    'New Address (To)': row.TO_ADDRESS || '',
    'Contact #': row.TO_CONTACT_NUMBER || '',
    'New Meter #': row.TO_METER_NUMBER || '',
    'Requirement': row.REQUIREMENT || '',
    'Application Date': row.APPLICATION_DATE || '',
    'Status': row.STATUS || 'PENDING',
    'Remarks': row.REMARKS || ''
  }));

  // Gumawa ng worksheet at i-adjust ang lapad ng mga columns
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  worksheet['!cols'] = [
    { wch: 18 }, // Account Number
    { wch: 28 }, // Account Name
    { wch: 35 }, // Current Address
    { wch: 16 }, // Current Meter #
    { wch: 35 }, // New Address
    { wch: 15 }, // Contact #
    { wch: 16 }, // New Meter #
    { wch: 32 }, // Requirement
    { wch: 16 }, // Application Date
    { wch: 15 }, // Status
    { wch: 30 }  // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Transfers');

// I-save gamit ang local date sa filename
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(workbook, `Transfer_Requests_${filter}_${todayStr}.xlsx`);
}