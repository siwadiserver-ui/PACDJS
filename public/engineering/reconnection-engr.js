// public/engineering/reconnection-engr.js
let poolData = [];
let availablePlumbers = [];
let selectedContextItem = null;

document.addEventListener('DOMContentLoaded', async () => {
  initDefaults();
  await loadReferencePools();
  await loadDataPool();
});

function initDefaults() {
  // Blangko para manual na pipiliin sa date & time picker
  document.getElementById('txtReconDateTime').value = '';
}

// 📦 1. Kuhanin ang Data mula sa Plumbers Pool Database
async function loadReferencePools() {
  try {
    const resP = await fetch('/api/plumbers/list?active=true');
    availablePlumbers = await resP.json();
    renderPlumbersChecklist(availablePlumbers);
  } catch (err) {
    console.error('Error loading plumbers pool:', err);
  }
}

function renderPlumbersChecklist(list) {
  const regContainer = document.getElementById('regularPlumbersGrid');
  const joContainer = document.getElementById('joPlumbersGrid');

  const regular = (list || []).filter(p => (p.CATEGORY || '').toUpperCase() === 'REGULAR');
  const jo = (list || []).filter(p => (p.CATEGORY || '').toUpperCase() !== 'REGULAR');

  regContainer.innerHTML = regular.map(p => `
    <label class="check-label">
      <input type="checkbox" name="subChkPlumber" value="${p.NAME}">
      <span>${p.NAME}</span>
    </label>
  `).join('');

  joContainer.innerHTML = jo.map(p => `
    <label class="check-label">
      <input type="checkbox" name="subChkPlumber" value="${p.NAME}">
      <span>${p.NAME}</span>
    </label>
  `).join('');
}

// 🪟 Sub-Modal Handlers
function openPlumbersSelector() {
  const current = document.getElementById('txtSelectedPlumbers').textContent.trim();
  const selected = current.startsWith('--') ? [] : current.split(',').map(s => s.trim().toUpperCase());

  document.querySelectorAll('input[name="subChkPlumber"]').forEach(chk => {
    chk.checked = selected.includes(chk.value.toUpperCase());
  });
  document.getElementById('plumbersModal').style.display = 'flex';
}

function applyPlumbersSelection() {
  const chosen = Array.from(document.querySelectorAll('input[name="subChkPlumber"]:checked')).map(c => c.value);
  const displayEl = document.getElementById('txtSelectedPlumbers');
  const boxEl = document.getElementById('boxPlumbers');

  if (chosen.length > 0) {
    displayEl.textContent = chosen.join(', ');
    boxEl.classList.remove('placeholder');
    document.getElementById('selFinalStatus').value = 'RECONNECTED';
  } else {
    displayEl.textContent = '-- PLEASE SELECT PLUMBERS --';
    boxEl.classList.add('placeholder');
  }
  closeModal('plumbersModal');
}

// 📋 Table Data Pool Loader
async function loadDataPool() {
  const status = document.getElementById('statusFilter').value; // Default na itong 'ALL'
  const tbody = document.getElementById('tableBody');
  const countLbl = document.getElementById('recordCount');

  try {
    const res = await fetch(`/api/engr/reconnections/list?status=${status}`);
    const json = await res.json();
    if (json.success) {
      // 🔒 Siguruhing naka-sort ayon sa ID (Latest to Oldest)
      poolData = (json.data || []).sort((a, b) => Number(b.ID) - Number(a.ID));
      renderTable(poolData);
      countLbl.textContent = `${poolData.length} Records Found`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: var(--danger);">Error loading data: ${err.message}</td></tr>`;
  }
}

function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: var(--text-sec);">Walang tala sa Reconnection Requests.</td></tr>`;
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');
    const status = row.STATUS || 'PENDING';
    const statusClass = getStatusClass(status);

    tr.innerHTML = `
      <td><strong style="color: var(--danger);">${row.REFERENCE_NUMBER || ''}</strong></td>
      <td>${row.ACCOUNT_NUMBER || ''}</td>
      <td><strong>${row.ACCOUNT_NAME || ''}</strong></td>
      <td>${row.ADDRESS || ''}</td>
      <td>${row.METER_NUMBER || ''}</td>
      <td>${row.READING || '0'}</td>
      <td><strong style="color: var(--success);">${row.OR_NUMBER || 'NO OR'}</strong></td>
      <td>${row.REQUEST_DATE || ''}</td>
      <td><span class="status-badge ${statusClass}">${status}</span></td>
      <td>${row.RECONNECTED_BY || '<em>None</em>'}</td>
      <td>${row.DATE_RECONNECTED || ''}</td>
      <td><strong style="color: var(--primary);">${row.METER_STATUS || ''}</strong></td>
      <td>${row.NEW_METER_NUMBER || '-'}</td>
    `;

    // 🚀 Double-click to open Clean Update Modal
    tr.addEventListener('dblclick', () => {
      openUpdateModal(row);
    });

    // 📋 Right-Click: Context Menu para sa Print at Update
    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      selectedContextItem = row;
      const menu = document.getElementById('customContextMenu');
      menu.style.display = 'block';

      const menuWidth = 180;
      const menuHeight = 85;
      const posX = (e.clientX + menuWidth > window.innerWidth) ? e.clientX - menuWidth : e.clientX;
      const posY = (e.clientY + menuHeight > window.innerHeight) ? e.clientY - menuHeight : e.clientY;

      menu.style.left = `${posX}px`;
      menu.style.top = `${posY}px`;
    });

    tbody.appendChild(tr);
  });
}

function getStatusClass(status) {
  switch ((status || '').toUpperCase()) {
    case 'RECONNECTED': return 'st-reconnected';
    case 'IN PROGRESS': return 'st-inprogress';
    case 'PRINTED': return 'st-inprogress';
    default: return 'st-pending';
  }
}

function filterDataPool(keyword) {
  const q = keyword.trim().toUpperCase();
  if (!q) return renderTable(poolData);

  const matched = poolData.filter(d => 
    (d.REFERENCE_NUMBER && d.REFERENCE_NUMBER.toUpperCase().includes(q)) ||
    (d.ACCOUNT_NAME && d.ACCOUNT_NAME.toUpperCase().includes(q)) ||
    (d.ACCOUNT_NUMBER && d.ACCOUNT_NUMBER.toUpperCase().includes(q)) ||
    (d.OR_NUMBER && d.OR_NUMBER.toUpperCase().includes(q)) ||
    (d.ADDRESS && d.ADDRESS.toUpperCase().includes(q))
  );
  renderTable(matched);
}

// 🪟 Open Clean Modal
function openUpdateModal(row) {
  document.getElementById('modalRecordId').value = row.ID || '';
  document.getElementById('lblRef').textContent = row.REFERENCE_NUMBER || '-';
  document.getElementById('lblAcc').textContent = row.ACCOUNT_NUMBER || '-';
  document.getElementById('lblName').textContent = row.ACCOUNT_NAME || '-';
  document.getElementById('lblOr').textContent = row.OR_NUMBER || 'NO OR';
  document.getElementById('lblMeter').textContent = row.METER_NUMBER || '-';
  document.getElementById('lblReading').textContent = row.READING || '0';
  document.getElementById('lblAddress').textContent = row.ADDRESS || '-';

  // 👤 Kunin ang kasalukuyang naka-login na user
  const userJson = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
  let loggedUserName = 'STAFF';
  if (userJson) {
    try {
      const u = JSON.parse(userJson);
      loggedUserName = (u.FULL_NAME || u.USERNAME || u.username || 'STAFF').toUpperCase();
    } catch(e) {}
  }

  const userBadge = document.getElementById('lblModalLoggedUser');
  if (userBadge) {
    userBadge.textContent = `👤 ENCODER: ${loggedUserName}`;
  }

  const txtUpdEl = document.getElementById('txtUpdatedBy');
  if (txtUpdEl) {
    txtUpdEl.value = (row.UPDATED_BY && row.UPDATED_BY.trim()) ? row.UPDATED_BY : loggedUserName;
  }

  // 🔹 Idinagdag: Received By at Date Requested mula sa Commercial Division
  const elRec = document.getElementById('lblReceivedBy');
  if (elRec) elRec.textContent = row.RECEIVED_BY || 'COMMDIV/STAFF';

  const elReqDate = document.getElementById('lblDateReq');
  if (elReqDate) {
    const d = row.REQUEST_DATE || '';
    const t = row.REQUEST_TIME || '';
    elReqDate.textContent = (d || t) ? `${d} ${t}`.trim() : '-';
  }

  // 1. Plumbers Display
  const pBox = document.getElementById('boxPlumbers');
  const pTxt = document.getElementById('txtSelectedPlumbers');
  if (row.RECONNECTED_BY && row.RECONNECTED_BY.trim()) {
    pTxt.textContent = row.RECONNECTED_BY;
    pBox.classList.remove('placeholder');
  } else {
    pTxt.textContent = '-- PLEASE SELECT PLUMBERS --';
    pBox.classList.add('placeholder');
  }

  // 2. Date & Time Picker Handling (YYYY-MM-DDTHH:mm format)
  if (row.DATE_RECONNECTED && typeof row.DATE_RECONNECTED === 'string') {
    document.getElementById('txtReconDateTime').value = row.DATE_RECONNECTED.replace(' ', 'T').substring(0, 16);
  } else {
    document.getElementById('txtReconDateTime').value = '';
  }

  // 3. Meter Status & New Meter Number
  document.getElementById('selMeterStatus').value = row.METER_STATUS || 'MAGNETIC';
  document.getElementById('txtNewMeterNumber').value = row.NEW_METER_NUMBER || '';

  // 4. Status
  document.getElementById('selFinalStatus').value = (row.STATUS === 'RECONNECTED') ? 'RECONNECTED' : (row.STATUS || 'PENDING');

  document.getElementById('updateModal').style.display = 'flex';
}

function closeModal(modalId) {
  const el = document.getElementById(modalId);
  if (el) el.style.display = 'none';
}

// 💾 Save Accomplishment
async function saveAccomplishment() {
  const id = document.getElementById('modalRecordId').value;
  if (!id) return;

  const plumbers = document.getElementById('txtSelectedPlumbers').textContent.trim();
  const status = document.getElementById('selFinalStatus').value;

  if (status === 'RECONNECTED' && (plumbers.startsWith('--') || !plumbers)) {
    alert('Pakilagay ang Performed By (Plumbers) kapag ang Status ay RECONNECTED.');
    return;
  }

  // I-format ang datetime para sa database ('YYYY-MM-DD HH:mm')
  const dtVal = document.getElementById('txtReconDateTime').value.trim();
  const fullDateTime = dtVal ? dtVal.replace('T', ' ') : '';

// 👤 Kunin kung sino ang naka-login
  const userJson = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
  let loggedUserName = 'STAFF';
  if (userJson) {
    try {
      const u = JSON.parse(userJson);
      loggedUserName = (u.FULL_NAME || u.USERNAME || u.username || 'STAFF').toUpperCase();
    } catch(e) {}
  }

  const payload = {
    id: id,
    reconnectedBy: (plumbers.startsWith('--') ? '' : plumbers),
    dateReconnected: fullDateTime,
    meterStatus: document.getElementById('selMeterStatus').value,
    newMeterNumber: document.getElementById('txtNewMeterNumber').value.trim(),
    plumberRemarks: '',
    updatedBy: loggedUserName, // 👈 Diretsong ipasa ang encoder
    status: status
  };

  try {
    const res = await fetch('/api/engr/reconnections/update-action', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      alert(`✅ ${result.message}`);
      closeModal('updateModal');
      loadDataPool();
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

// 📊 Export to Excel (Engineering Reconnections)
function exportReconnectionsEngrToExcel() {
  if (!poolData || poolData.length === 0) {
    alert('Walang data na mai-export sa kasalukuyang table.');
    return;
  }

  const currentStatus = document.getElementById('statusFilter').value;
  const filename = `Engineering_Reconnections_${currentStatus}_${new Date().toISOString().slice(0, 10)}.csv`;

  // 1. Column Headers para sa Reconnection Table
  const headers = [
    'Reference Number',
    'Account Number',
    'Account Name',
    'Address',
    'Old Meter Number',
    'Reading',
    'OR Number',
    'Date Requested',
    'Status',
    'Reconnected By',
    'Date Reconnected',
    'Meter Status',
    'New Meter Number'
  ];

  // 2. CSV Rows Mapping
  const rows = poolData.map(item => [
    `"${(item.REFERENCE_NUMBER || '').replace(/"/g, '""')}"`,
    `"${(item.ACCOUNT_NUMBER || '').replace(/"/g, '""')}"`,
    `"${(item.ACCOUNT_NAME || '').replace(/"/g, '""')}"`,
    `"${(item.ADDRESS || '').replace(/"/g, '""')}"`,
    `"${(item.METER_NUMBER || '').replace(/"/g, '""')}"`,
    `"${item.READING || '0'}"`,
    `"${(item.OR_NUMBER || 'NO OR').replace(/"/g, '""')}"`,
    `"${item.REQUEST_DATE || ''}"`,
    `"${item.STATUS || 'PENDING'}"`,
    `"${(item.RECONNECTED_BY || '').replace(/"/g, '""')}"`,
    `"${item.DATE_RECONNECTED || ''}"`,
    `"${(item.METER_STATUS || '').replace(/"/g, '""')}"`,
    `"${(item.NEW_METER_NUMBER || '').replace(/"/g, '""')}"`
  ]);

  // 3. UTF-8 BOM encoding para sa maayos na formatting sa Excel
  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// 🖨️ DIRECT PRINT ENGINE (Kopya mula sa Commercial Reconnection)
function triggerPrintForm(ref) {
  if (!ref) return;
  window.open(`/api/commercial/reconnections/print/${encodeURIComponent(ref)}`, '_blank');
}

function triggerDirectPrintFromContext() {
  const menu = document.getElementById('customContextMenu');
  if (menu) menu.style.display = 'none';
  if (!selectedContextItem) return;

  triggerPrintForm(selectedContextItem.REFERENCE_NUMBER);
}

function openSelectedRowModal() {
  const menu = document.getElementById('customContextMenu');
  if (menu) menu.style.display = 'none';
  if (selectedContextItem) {
    openUpdateModal(selectedContextItem);
  }
}

// Isara ang Context Menu kapag nag-click sa labas
document.addEventListener('click', (e) => {
  if (!e.target.closest('#customContextMenu')) {
    const menu = document.getElementById('customContextMenu');
    if (menu) menu.style.display = 'none';
  }
});