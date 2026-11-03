let poolData = [];
let selectedRowId = null;

document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  loadDataPool();
  setFormReadOnly(true);
  setupContextMenu();
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

  const dateEl = document.getElementById('transferDate');
  const timeEl = document.getElementById('transferTime');
  if (dateEl) dateEl.value = `${year}-${month}-${day}`;
  if (timeEl) timeEl.value = `${hours}:${minutes}`;
}

function setFormReadOnly(isReadOnly = true) {
  // Tinanggal na rito ang 'governmentId'
  const inputs = ['appNumber', 'applicantName', 'address', 'contactNumber', 'accountReference', 'requirementsPassed', 'orNumber', 'deposit', 'custDeposit', 'meterFee', 'transferDate', 'transferTime', 'remarks'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = isReadOnly;
  });
  const title = document.getElementById('formHeaderTitle');
  if (title) {
    title.textContent = isReadOnly ? 'New Connection Processing (Read-Only)' : 'Edit New Connection Record (Editable)';
  }
}

async function loadDataPool() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/nsc/list');
    const rawData = await res.json();
    
    // 🔒 I-sort mula sa pinakabago hanggang sa pinakaluma (Latest to Oldest)
    poolData = (Array.isArray(rawData) ? rawData : []).sort((a, b) => Number(b.ID) - Number(a.ID));
    renderTable(poolData);
  } catch (err) {
    console.error('Error loading pool:', err);
    tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: var(--danger);">Error loading data: ${err.message}</td></tr>`;
  }
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
    tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: var(--text-sec);">Walang tala sa Connections List.</td></tr>`;
    return;
  }

  filtered.forEach(row => {
    const tr = document.createElement('tr');
    const status = (row.STATUS || 'PENDING').toUpperCase();
    const statusClass = getStatusClass(status);

    // Dynamic Row Class para sa Visual Highlights
    if (status === 'COMPLETED' || status === 'INSTALLED') {
      tr.className = 'row-installed';
    } else if (status === 'SENT TO ENGINEERING') {
      tr.className = 'row-sent';
    } else if (status === 'BACKED FROM ENGINEERING' || (row.PLUMBER_REMARKS && status === 'PAID')) {
      tr.className = 'row-backed';
    } else if (status === 'PAID') {
      tr.className = 'row-paid';
    }

    let displayRemarks = row.REMARKS || '';
    if (row.PLUMBER_REMARKS && status === 'PAID') {
      displayRemarks = `⚠️ Backed: ${row.PLUMBER_REMARKS}`;
    } else if (!displayRemarks && row.PLUMBER_REMARKS) {
      displayRemarks = `Engr Note: ${row.PLUMBER_REMARKS}`;
    }

    const dtStr = `${row.TRANSFER_DATE || ''} ${row.TRANSFER_TIME || ''}`.trim();

    // 13 Columns eksakto sa table header ng HTML (kasama na ang Acct Ref)
    tr.innerHTML = `
      <td><strong>${row.APPLICATION_NUMBER || ''}</strong></td>
      <td>${row.APPLICANT_NAME || ''}</td>
      <td>${row.ADDRESS || ''}</td>
      <td>${row.CONTACT_NUMBER || ''}</td>
      <td><strong>${row.ACCOUNT_REFERENCE || '-'}</strong></td>
      <td style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.REQUIREMENTS_PASSED || ''}">
        ${row.REQUIREMENTS_PASSED || '-'}
      </td>
      <td><strong>${row.OR_NUMBER || '-'}</strong></td>
      <td>₱${row.DEPOSIT || '6000'}</td>
      <td>₱${row.CUSTOMERS_DEPOSIT || '400'}</td>
      <td>₱${row.METER_MAINTENANCE_FEE || '500'}</td>
      <td>${dtStr || '-'}</td>
      <td>${displayRemarks}</td>
      <td><span class="status-badge ${statusClass}">${status}</span></td>
    `;

    // Right-Click Context Menu
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectedRowId = row.ID;
      loadIntoForm(row, true);
      showContextMenu(e.pageX, e.pageY);
    });

    // Dobol Click: Buksan ang Engineering Modal
    tr.addEventListener('dblclick', () => {
      selectedRowId = row.ID;
      viewInstallationDetails(row.APPLICATION_NUMBER);
    });

    tbody.appendChild(tr);
  });
}

function getStatusClass(status) {
  switch ((status || '').toUpperCase()) {
    case 'COMPLETED':
    case 'INSTALLED': return 'st-sent';
    case 'PAID': return 'st-paid';
    case 'SENT TO ENGINEERING': return 'st-sent';
    case 'BACKED FROM ENGINEERING': return 'st-backed';
    default: return 'st-pending';
  }
}

function filterDataPool(keyword) {
  const q = keyword.trim().toUpperCase();
  if (!q) return renderTable(poolData);

  const matched = poolData.filter(d => 
    (d.APPLICATION_NUMBER && d.APPLICATION_NUMBER.toUpperCase().includes(q)) ||
    (d.APPLICANT_NAME && d.APPLICANT_NAME.toUpperCase().includes(q)) ||
    (d.ADDRESS && d.ADDRESS.toUpperCase().includes(q)) ||
    (d.ACCOUNT_REFERENCE && d.ACCOUNT_REFERENCE.toUpperCase().includes(q)) ||
    (d.OR_NUMBER && d.OR_NUMBER.toUpperCase().includes(q))
  );
  renderTable(matched);
}

function loadIntoForm(row, readOnly = true) {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  const todayStr = `${year}-${month}-${day}`;
  const timeStr = `${hours}:${minutes}`;

  document.getElementById('editingRecordId').value = row.ID;
  document.getElementById('appNumber').value = row.APPLICATION_NUMBER || '';
  document.getElementById('applicantName').value = row.APPLICANT_NAME || '';
  document.getElementById('address').value = row.ADDRESS || '';
  document.getElementById('contactNumber').value = row.CONTACT_NUMBER || '';
  document.getElementById('accountReference').value = row.ACCOUNT_REFERENCE || '';
  document.getElementById('requirementsPassed').value = row.REQUIREMENTS_PASSED || '';
  document.getElementById('orNumber').value = row.OR_NUMBER || '';
  document.getElementById('deposit').value = row.DEPOSIT || '6000';
  document.getElementById('custDeposit').value = row.CUSTOMERS_DEPOSIT || '400';
  document.getElementById('meterFee').value = row.METER_MAINTENANCE_FEE || '500';
  
  document.getElementById('transferDate').value = row.TRANSFER_DATE ? row.TRANSFER_DATE : todayStr;
  document.getElementById('transferTime').value = row.TRANSFER_TIME ? row.TRANSFER_TIME : timeStr;
  
  let commRemark = row.REMARKS || '';
  if (row.PLUMBER_REMARKS && row.STATUS === 'PAID') {
    commRemark = `Backed from Engineering: ${row.PLUMBER_REMARKS}`;
  }
  document.getElementById('remarks').value = commRemark;

  setFormReadOnly(readOnly);
}

async function saveRecord() {
  const editId = document.getElementById('editingRecordId')?.value;
  if (!editId) {
    alert('Pumili muna ng record mula sa listahan bago mag-save.');
    return;
  }

  const payload = {
    id: editId,
    application_number: document.getElementById('appNumber')?.value || '',
    applicant_name: document.getElementById('applicantName')?.value || '',
    address: document.getElementById('address')?.value || '',
    contact_number: document.getElementById('contactNumber')?.value || '',
    account_reference: document.getElementById('accountReference')?.value || '',
    requirements_passed: document.getElementById('requirementsPassed')?.value || '',
    or_number: document.getElementById('orNumber')?.value || '',
    deposit: document.getElementById('deposit')?.value || '6000',
    customers_deposit: document.getElementById('custDeposit')?.value || '400',
    meter_maintenance_fee: document.getElementById('meterFee')?.value || '500',
    transfer_date: document.getElementById('transferDate')?.value || '',
    transfer_time: document.getElementById('transferTime')?.value || '',
    remarks: document.getElementById('remarks')?.value || ''
  };

  try {
    const res = await fetch('/api/nsc/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      alert(`✅ ${result.message}`);
      loadDataPool();
      setFormReadOnly(true);
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

async function sendSelectedToEngineering(id = null) {
  const targetId = id || document.getElementById('editingRecordId')?.value || selectedRowId;
  if (!targetId) {
    alert('Pumili muna ng record bago ipadala sa Engineering.');
    return;
  }

  const row = poolData.find(d => d.ID === targetId);
  if (!row) return;

  const currentStatus = (row.STATUS || '').trim().toUpperCase();

  // 🛑 Client-side check bago mag-prompt
  if (currentStatus === 'SENT TO ENGINEERING') {
    alert(`⚠️ Ang Application ${row.APPLICATION_NUMBER} ay NAIPADALA NA sa Engineering!`);
    return;
  }

  if (currentStatus === 'INSTALLED' || currentStatus === 'COMPLETED') {
    alert(`⚠️ Tapos na o Installed na ang Application ${row.APPLICATION_NUMBER}. Bawal na itong ipadala muli.`);
    return;
  }

  if (!confirm(`Ipadala ba ang application ${row.APPLICATION_NUMBER} sa Engineering Division?`)) return;

  try {
    const res = await fetch('/api/nsc/send-to-engineering', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: targetId,
        application_number: row.APPLICATION_NUMBER,
        account_reference: document.getElementById('accountReference')?.value || row.ACCOUNT_REFERENCE || ''
      })
    });
    const result = await res.json();
    if (result.success) {
      alert('🎉 ' + result.message);
      loadDataPool();
      clearForm();
    } else {
      alert('❌ ' + result.error);
    }
  } catch (e) {
    alert('❌ Error: ' + e.message);
  }
}

// View Details Modal Function
async function viewInstallationDetails(appNo) {
  try {
    const res = await fetch(`/api/nsc/installation-details/${encodeURIComponent(appNo)}`);
    const r = await res.json();
    if (r.error) throw new Error(r.error);

    // 📅 Ligtas na pag-format ng Installation Date para sa display
    let displayInstDate = 'Pending';
    if (r.INSTALLATION_DATE && String(r.INSTALLATION_DATE).trim()) {
      try {
        const d = new Date(r.INSTALLATION_DATE);
        if (!isNaN(d.getTime())) {
          displayInstDate = d.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          });
        } else {
          displayInstDate = String(r.INSTALLATION_DATE);
        }
      } catch (e) {
        displayInstDate = String(r.INSTALLATION_DATE);
      }
    }

    const modalContent = document.getElementById('modalContent');
    modalContent.innerHTML = `
      <div style="background: #f0f7ff; padding: 12px 14px; border-radius: 8px; border: 1px solid #cce4ff; display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 0.85rem;">
        <div><strong style="color: var(--text-sec);">App #:</strong> <span style="color: var(--danger); font-weight: 700;">${r.APPLICATION_NUMBER || '-'}</span></div>
        <div><strong style="color: var(--text-sec);">OR #:</strong> <span style="color: var(--success); font-weight: 700;">${r.OR_NUMBER || 'NO OR'}</span></div>
        <div><strong style="color: var(--text-sec);">Applicant:</strong> <span style="font-weight: 700;">${r.APPLICANT_NAME || '-'}</span></div>
        <div><strong style="color: var(--text-sec);">Acct Ref:</strong> <span style="font-weight: 700;">${r.ACCOUNT_REFERENCE || 'N/A'}</span></div>
        <div><strong style="color: var(--text-sec);">Contact:</strong> <span>${r.CONTACT_NUMBER || 'N/A'}</span></div>
        <div><strong style="color: var(--text-sec);">Status:</strong> <span class="status-badge ${getStatusClass(r.STATUS)}">${r.STATUS || 'PENDING'}</span></div>
        <div style="grid-column: span 2;"><strong style="color: var(--text-sec);">Address:</strong> <span>${r.ADDRESS || 'N/A'}</span></div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 10px;">
        <label style="font-weight: 700; color: var(--text-sec); font-size: 0.83rem;">👥 Assigned Plumbers / Crew:</label>
        <div style="background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); font-weight: 700; color: var(--text-main); font-size: 0.88rem;">${r.ASSIGNED_PLUMBERS || 'None / Not Assigned Yet'}</div>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 6px;">
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="font-weight: 700; color: var(--text-sec); font-size: 0.83rem;">📅 Date Installed:</label>
          <div style="background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); font-weight: 600; font-size: 0.88rem;">${displayInstDate}</div>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          <label style="font-weight: 700; color: var(--text-sec); font-size: 0.83rem;">👤 Updated By (Engr):</label>
          <div style="background: #f8fafc; padding: 8px 12px; border-radius: 6px; border: 1px solid var(--border-color); font-weight: 800; font-size: 0.88rem; color: var(--primary);">${r.UPDATED_BY || 'NOT YET UPDATED'}</div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
        <label style="font-weight: 700; color: var(--text-sec); font-size: 0.83rem;">📦 Installed Materials Used:</label>
        <textarea rows="3" readonly style="width:100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: #f8fafc; font-size: 0.85rem; outline: none; font-weight: 600;">${r.INSTALLED_MATERIALS || 'None / No materials recorded'}</textarea>
      </div>

      <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 6px;">
        <label style="font-weight: 700; color: var(--text-sec); font-size: 0.83rem;">📝 Engineering / Plumber Remarks:</label>
        <textarea rows="2" readonly style="width:100%; padding: 8px; border-radius: 6px; border: 1px solid var(--border-color); background: #f8fafc; font-size: 0.85rem; outline: none;">${r.PLUMBER_REMARKS || 'No remarks recorded.'}</textarea>
      </div>
    `;
    document.getElementById('installationModal').style.display = 'flex';
  } catch (err) {
    alert('❌ Error loading installation details: ' + err.message);
  }
}

function closeModal() {
  document.getElementById('installationModal').style.display = 'none';
}

function clearForm() {
  document.getElementById('editingRecordId').value = '';
  const inputs = ['appNumber', 'applicantName', 'address', 'contactNumber', 'accountReference', 'requirementsPassed', 'orNumber', 'remarks'];
  inputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('deposit').value = '6000';
  document.getElementById('custDeposit').value = '400';
  document.getElementById('meterFee').value = '500';
  initDefaults();
  setFormReadOnly(true);
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
  if (row) loadIntoForm(row, false);
}

function triggerSendToEngr() {
  sendSelectedToEngineering(selectedRowId);
}

function triggerViewInstallation() {
  const row = poolData.find(d => d.ID === selectedRowId);
  if (row) viewInstallationDetails(row.APPLICATION_NUMBER);
}

async function triggerDelete() {
  const row = poolData.find(d => d.ID === selectedRowId);
  if (!row) return;

  // 1. Unang babala / Confirmation
  if (!confirm(`CRITICAL WARNING: Tanggalin ang record para sa Application # ${row.APPLICATION_NUMBER}?`)) return;

  // 2. Security Check (Password Prompt)
  const pass = prompt('🔒 SECURITY CHECK:\nIlagay ang password upang kumpirmahin ang pagbura:');

  if (pass === null) {
    // Kinansela ng user ang prompt
    return;
  }

  if (pass !== 'KUMAKALABUKAB' && pass !== 'kumakalabukab') {
    alert('❌ Mali ang password! Kanselado ang pagbura ng record.');
    return;
  }

  // 3. Pagpapatuloy sa pagbura kapag tumugma ang password
  try {
    const res = await fetch('/api/nsc/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedRowId })
    });
    const result = await res.json();
    if (result.success) {
      alert('✅ Record deleted.');
      loadDataPool();
      clearForm();
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (e) {
    alert('❌ Delete error: ' + e.message);
  }
}

// 📊 Export New Service Connections to Excel
function exportNSCToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Hindi ma-load ang Excel library. Pakisuri ang iyong koneksyon.');
    return;
  }

  const filterElem = document.getElementById('statusFilter');
  const filter = filterElem ? filterElem.value : 'ALL';
  const searchVal = (document.getElementById('searchTableInput')?.value || '').trim().toUpperCase();

  // Kuhanin ang kasalukuyang naka-filter o naka-search na mga tala
  let targetData = (Array.isArray(poolData) ? poolData : []).filter(d => {
    const matchesStatus = (filter === 'ALL') || ((d.STATUS || '').toUpperCase() === filter);
    if (!matchesStatus) return false;

    if (!searchVal) return true;
    return (
      (d.APPLICATION_NUMBER && d.APPLICATION_NUMBER.toUpperCase().includes(searchVal)) ||
      (d.APPLICANT_NAME && d.APPLICANT_NAME.toUpperCase().includes(searchVal)) ||
      (d.ADDRESS && d.ADDRESS.toUpperCase().includes(searchVal)) ||
      (d.ACCOUNT_REFERENCE && d.ACCOUNT_REFERENCE.toUpperCase().includes(searchVal)) ||
      (d.OR_NUMBER && d.OR_NUMBER.toUpperCase().includes(searchVal))
    );
  });

  if (targetData.length === 0) {
    alert('Walang records na mai-export batay sa kasalukuyang filter/search.');
    return;
  }

  // I-format ang columns na tugma sa columns ng table
const exportRows = targetData.map(row => {
    const dtStr = `${row.TRANSFER_DATE || ''} ${row.TRANSFER_TIME || ''}`.trim();
    return {
      'App #': row.APPLICATION_NUMBER || '',
      'Applicant Name': row.APPLICANT_NAME || '',
      'Address': row.ADDRESS || '',
      'Contact #': row.CONTACT_NUMBER || '',
      'Acct Ref': row.ACCOUNT_REFERENCE || '',
      'Requirements': row.REQUIREMENTS_PASSED || '',
      'OR Number': row.OR_NUMBER || '',
      'Deposit': parseFloat(row.DEPOSIT) || 0,
      'Cust. Deposit': parseFloat(row.CUSTOMERS_DEPOSIT) || 0,
      'Meter Fee': parseFloat(row.METER_MAINTENANCE_FEE) || 0,
      'Transfer Date/Time': dtStr,
      'Remarks': row.REMARKS || '',
      'Plumber Remarks': row.PLUMBER_REMARKS || '',
      'Updated By': row.UPDATED_BY || '',
      'Status': row.STATUS || 'PENDING'
    };
  });

  // Gumawa ng worksheet at i-adjust ang lapad ng mga columns
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  worksheet['!cols'] = [
      { wch: 16 }, // App #
      { wch: 28 }, // Applicant Name
      { wch: 35 }, // Address
      { wch: 15 }, // Contact #
      { wch: 16 }, // Acct Ref
      { wch: 25 }, // Requirements
      { wch: 15 }, // OR Number
      { wch: 12 }, // Deposit
      { wch: 14 }, // Cust Deposit
      { wch: 12 }, // Meter Fee
      { wch: 20 }, // Transfer Date/Time
      { wch: 25 }, // Remarks
      { wch: 25 }, // Plumber Remarks
      { wch: 20 }, // Updated By
      { wch: 16 }  // Status
    ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'NSC Records');

// I-save gamit ang local date sa filename
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(workbook, `New_Service_Connections_${filter}_${todayStr}.xlsx`);
}