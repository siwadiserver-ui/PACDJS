let poolData = [];
let availablePlumbers = [];
let availableActions = [];
let availableMaterials = [];
let selectedContextItem = null;

document.addEventListener('DOMContentLoaded', async () => {
  initDefaults();
  await loadReferencePools();
  await loadDataPool();
});

function initDefaults() {
  document.getElementById('txtCompletionDate').value = '';
}

// 📦 1. Kuhanin ang Data mula sa Plumbers, Actions, at Materials Databases
async function loadReferencePools() {
  try {
    // 1. Plumbers Pool
    const resP = await fetch('/api/plumbers/list?active=true');
    availablePlumbers = await resP.json();
    renderPlumbersChecklist(availablePlumbers);

    // 2. Request Actions Pool
    const resA = await fetch('/api/request-actions/active');
    const jsonA = await resA.json();
    if (jsonA.success) {
      availableActions = jsonA.data;
      renderActionsChecklist(availableActions);
    }

    // 3. Materials Pool
    const resM = await fetch('/api/materials/active');
    const jsonM = await resM.json();
    if (jsonM.success) {
      availableMaterials = jsonM.data.filter(m => m.MATERIAL_NAME !== 'WALA' && m.MATERIAL_NAME !== 'MERON');
      renderMaterialsChecklist(availableMaterials);
    }
  } catch (err) {
    console.error('Error loading reference pools:', err);
  }
}

// 🎨 Render Split Plumbers Checklists (REGULAR vs JO)
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

function renderActionsChecklist(list) {
  const container = document.getElementById('actionsGrid');
  container.innerHTML = (list || []).map(a => `
    <label class="check-label">
      <input type="checkbox" name="subChkAction" value="${a.ACTION_NAME}">
      <span>${a.ACTION_NAME}</span>
    </label>
  `).join('');
}

function renderMaterialsChecklist(list) {
  const container = document.getElementById('materialsGrid');
  container.innerHTML = (list || []).map((m, idx) => `
    <div class="check-label" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
      <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; flex: 1;">
        <input type="checkbox" name="subChkMaterial" value="${m.MATERIAL_NAME}" id="chkMat_${idx}">
        <span>${m.MATERIAL_NAME}</span>
      </label>
      <input type="number" min="1" value="1" class="material-qty-input" id="qtyMat_${idx}" title="Quantity">
    </div>
  `).join('');
}

// 🪟 Sub-Modal Openers & Confirmations
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
    document.getElementById('selFinalStatus').value = 'COMPLETED';
  } else {
    displayEl.textContent = '-- PLEASE SELECT PLUMBERS --';
    boxEl.classList.add('placeholder');
  }
  closeModal('plumbersModal');
}

function openActionsSelector() {
  const current = document.getElementById('txtSelectedActions').textContent.trim();
  const selected = current.startsWith('--') ? [] : current.split(',').map(s => s.trim().toUpperCase());

  document.querySelectorAll('input[name="subChkAction"]').forEach(chk => {
    chk.checked = selected.includes(chk.value.toUpperCase());
  });
  document.getElementById('actionsModal').style.display = 'flex';
}

function applyActionsSelection() {
  const chosen = Array.from(document.querySelectorAll('input[name="subChkAction"]:checked')).map(c => c.value);
  const displayEl = document.getElementById('txtSelectedActions');
  const boxEl = document.getElementById('boxActions');

  if (chosen.length > 0) {
    displayEl.textContent = chosen.join(', ');
    boxEl.classList.remove('placeholder');
  } else {
    displayEl.textContent = '-- PLEASE SELECT ACTION(S) --';
    boxEl.classList.add('placeholder');
  }
  closeModal('actionsModal');
}

function openMaterialsSelector() {
  const current = document.getElementById('txtSelectedMaterials').textContent.trim();
  const selected = (current === 'WALA' || current.startsWith('--')) ? [] : current.split(',').map(s => s.trim().toUpperCase());

  document.querySelectorAll('input[name="subChkMaterial"]').forEach(chk => {
    chk.checked = selected.includes(chk.value.toUpperCase());
  });
  document.getElementById('materialsModal').style.display = 'flex';
}

function setMaterialsNone() {
  document.querySelectorAll('input[name="subChkMaterial"]').forEach(chk => chk.checked = false);
  document.getElementById('txtSelectedMaterials').textContent = 'WALA';
  document.getElementById('boxMaterials').classList.remove('placeholder');
  closeModal('materialsModal');
}

function applyMaterialsSelection() {
  const checkedBoxes = Array.from(document.querySelectorAll('input[name="subChkMaterial"]:checked'));
  const displayEl = document.getElementById('txtSelectedMaterials');
  const boxEl = document.getElementById('boxMaterials');

  const chosen = checkedBoxes.map(chk => {
    // Kukunin ang katapat nitong quantity input gamit ang index
    const idx = chk.id.split('_')[1];
    const qtyInput = document.getElementById(`qtyMat_${idx}`);
    const qty = (qtyInput && qtyInput.value && parseInt(qtyInput.value) > 0) ? parseInt(qtyInput.value) : 1;
    return `${qty} ${chk.value}`;
  });

  if (chosen.length > 0) {
    displayEl.textContent = chosen.join(', ');
  } else {
    displayEl.textContent = 'WALA';
  }
  boxEl.classList.remove('placeholder');
  closeModal('materialsModal');
}

// 📋 Table Data Pool Loader
async function loadDataPool() {
  const status = document.getElementById('statusFilter').value;
  const tbody = document.getElementById('tableBody');
  const countLbl = document.getElementById('recordCount');

  try {
    const res = await fetch(`/api/engr/service-requests/list?status=${status}`);
    const json = await res.json();
    if (json.success) {
      poolData = json.data;
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
    tbody.innerHTML = `<tr><td colspan="13" style="text-align: center; color: var(--text-sec);">Walang tala sa Service Requests.</td></tr>`;
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');
    const status = (row.STATUS || 'PENDING').toUpperCase();
    const statusClass = getStatusClass(status);

    // ✂️ PAIKLIIN ANG ACCOUNT NAME (hanggang 22 characters)
    const rawName = row.ACCOUNT_NAME || '';
    const displayName = rawName.length > 22 ? rawName.substring(0, 22) + '...' : rawName;

    // ✂️ PAIKLIIN ANG ADDRESS (hanggang 25 characters)
    const rawAddr = row.ADDRESS || '';
    const displayAddr = rawAddr.length > 25 ? rawAddr.substring(0, 25) + '...' : rawAddr;

    // ✂️ PAIKLIIN ANG REQUEST DETAILS (hanggang 20 characters)
    const rawDetails = row.REQUEST_DETAILS || '';
    const displayDetails = rawDetails.length > 20 ? rawDetails.substring(0, 20) + '...' : rawDetails;

    // ✂️ PAIKLIIN ANG SPECIFY / OTHER DETAILS (hanggang 18 characters)
    const rawSpecify = row.OTHER_DETAILS || 'N/A';
    const displaySpecify = rawSpecify.length > 18 ? rawSpecify.substring(0, 18) + '...' : rawSpecify;

    tr.innerHTML = `
      <td><strong style="color: var(--danger);">${row.REFERENCE_NUMBER || ''}</strong></td>
      <td>${row.ACCOUNT_NUMBER || ''}</td>
      <td title="${rawName}"><strong>${displayName}</strong></td>
      <td title="${rawAddr}">${displayAddr}</td>
      <td>${row.REQUEST_DATE || ''}</td>
      <td title="${rawDetails}"><strong style="color: var(--primary);">${displayDetails}</strong></td>
      <td title="${rawSpecify}">${displaySpecify}</td>
      <td><span class="status-badge ${statusClass}">${status}</span></td>
      <td>${row.COMPLETED_BY || '<em>None</em>'}</td>
      <td>${row.ACTION_TAKEN || '<em>None</em>'}</td>
      <td>${row.MATERIALS || 'WALA'}</td>
      <td>${row.COMPLETION_DATE || ''}</td>
      <td>${row.PLUMBER_REMARKS || ''}</td>
    `;

    // Context Menu & Double Click Handlers
    tr.addEventListener('contextmenu', (e) => handleContextMenu(e, row));
    tr.addEventListener('dblclick', () => openUpdateModal(row));

    tbody.appendChild(tr);
  });
}

function getStatusClass(status) {
  switch ((status || '').toUpperCase()) {
    case 'COMPLETED': return 'st-completed';
    case 'IN PROGRESS': return 'st-inprogress';
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
    (d.ADDRESS && d.ADDRESS.toUpperCase().includes(q)) ||
    (d.REQUEST_DETAILS && d.REQUEST_DETAILS.toUpperCase().includes(q)) ||
    (d.OTHER_DETAILS && d.OTHER_DETAILS.toUpperCase().includes(q))
  );
  renderTable(matched);
}

// 🪟 Open Clean Modal
function openUpdateModal(row) {
  document.getElementById('modalRecordId').value = row.ID || '';
  document.getElementById('lblRef').textContent = row.REFERENCE_NUMBER || '-';
  document.getElementById('lblAcc').textContent = row.ACCOUNT_NUMBER || '-';
  document.getElementById('lblName').textContent = row.ACCOUNT_NAME || '-';
  document.getElementById('lblDetails').textContent = row.REQUEST_DETAILS || '-';
  document.getElementById('lblAddress').textContent = row.ADDRESS || '-';
  document.getElementById('lblSpecify').textContent = (row.OTHER_DETAILS && row.OTHER_DETAILS.trim()) ? row.OTHER_DETAILS : 'N/A';

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

  // 👤 I-display sa input box: kung may dating nag-update, yun ang ipakita; kung wala pa, ang naka-login na user
  const txtUpdEl = document.getElementById('txtUpdatedBy');
  if (txtUpdEl) {
    txtUpdEl.value = (row.UPDATED_BY && row.UPDATED_BY.trim()) ? row.UPDATED_BY : loggedUserName;
  }

  // 🔹 Idinagdag: Received By at Date Requested mula sa Commercial
  const elRec = document.getElementById('lblReceivedBy');
  if (elRec) elRec.textContent = row.RECEIVED_BY || 'COMMDIV/STAFF';

  const elDate = document.getElementById('lblDateReq');
  if (elDate) elDate.textContent = row.REQUEST_DATE || '-';

  // 1. Plumbers Display
  const pBox = document.getElementById('boxPlumbers');
  const pTxt = document.getElementById('txtSelectedPlumbers');
  if (row.COMPLETED_BY && row.COMPLETED_BY.trim()) {
    pTxt.textContent = row.COMPLETED_BY;
    pBox.classList.remove('placeholder');
  } else {
    pTxt.textContent = '-- PLEASE SELECT PLUMBERS --';
    pBox.classList.add('placeholder');
  }

  // 2. Actions Display
  const aBox = document.getElementById('boxActions');
  const aTxt = document.getElementById('txtSelectedActions');
  if (row.ACTION_TAKEN && row.ACTION_TAKEN.trim()) {
    aTxt.textContent = row.ACTION_TAKEN;
    aBox.classList.remove('placeholder');
  } else {
    aTxt.textContent = '-- PLEASE SELECT ACTION(S) --';
    aBox.classList.add('placeholder');
  }

  // 3. Materials Display
  const mTxt = document.getElementById('txtSelectedMaterials');
  mTxt.textContent = (row.MATERIALS && row.MATERIALS.trim()) ? row.MATERIALS : 'WALA';

  // 4. Date & Time Picker Handling (YYYY-MM-DDTHH:mm format)
  if (row.COMPLETION_DATE && typeof row.COMPLETION_DATE === 'string') {
    document.getElementById('txtCompletionDate').value = row.COMPLETION_DATE.replace(' ', 'T').substring(0, 16);
  } else {
    document.getElementById('txtCompletionDate').value = '';
  }

  document.getElementById('selFinalStatus').value = row.STATUS ? row.STATUS : 'COMPLETED';
  document.getElementById('txtPlumberRemarks').value = row.PLUMBER_REMARKS || row.COMMENT || '';

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
  if (plumbers.startsWith('--') || !plumbers) {
    alert('Pumili ng kahit isang nakatalagang Tubero (Completed By).');
    return;
  }

  const actions = document.getElementById('txtSelectedActions').textContent.trim();
  if (actions.startsWith('--') || !actions) {
    alert('Pumili ng kahit isang Action Taken.');
    return;
  }

  const materials = document.getElementById('txtSelectedMaterials').textContent.trim();
  const status = document.getElementById('selFinalStatus').value;
  let completionDate = document.getElementById('txtCompletionDate').value;
  if (completionDate) {
    completionDate = completionDate.replace('T', ' ') + ':00';
  }

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
    completedBy: plumbers,
    actionTaken: actions,
    materials: materials,
    completionDate: completionDate,
    comment: document.getElementById('txtPlumberRemarks').value,
    updatedBy: loggedUserName, // 👈 Diretsong ipasa ang loggedUserName variable
    status: status
  };

  try {
    const res = await fetch('/api/engr/service-requests/update-action', {
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

// 📊 Export to Excel (Engineering Service Requests)
function exportServiceRequestsEngrToExcel() {
  if (!poolData || poolData.length === 0) {
    alert('Walang data na mai-export sa kasalukuyang table.');
    return;
  }

  const currentStatus = document.getElementById('statusFilter').value;
  const filename = `Engineering_Service_Requests_${currentStatus}_${new Date().toISOString().slice(0, 10)}.csv`;

  // 1. Column Headers
  const headers = [
    'Reference Number',
    'Account Number',
    'Account Name',
    'Address',
    'Request Details',
    'Specify / Other Details',
    'Date Requested',
    'Status',
    'Completed By',
    'Action Taken',
    'Materials Used',
    'Completion Date',
    'Plumber Remarks'
  ];

  // 2. CSV Rows Mapping
  const rows = poolData.map(item => [
    `"${(item.REFERENCE_NUMBER || '').replace(/"/g, '""')}"`,
    `"${(item.ACCOUNT_NUMBER || '').replace(/"/g, '""')}"`,
    `"${(item.ACCOUNT_NAME || '').replace(/"/g, '""')}"`,
    `"${(item.ADDRESS || '').replace(/"/g, '""')}"`,
    `"${(item.REQUEST_DETAILS || '').replace(/"/g, '""')}"`,
    `"${(item.OTHER_DETAILS || 'N/A').replace(/"/g, '""')}"`,
    `"${item.REQUEST_DATE || ''}"`,
    `"${item.STATUS || 'PENDING'}"`,
    `"${(item.COMPLETED_BY || '').replace(/"/g, '""')}"`,
    `"${(item.ACTION_TAKEN || '').replace(/"/g, '""')}"`,
    `"${(item.MATERIALS || 'WALA').replace(/"/g, '""')}"`,
    `"${item.COMPLETION_DATE || ''}"`,
    `"${(item.PLUMBER_REMARKS || '').replace(/"/g, '""')}"`
  ]);

  // 3. UTF-8 BOM encoding para sa maayos na rendering sa MS Excel
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

// 🖱️ Right-Click Context Menu Handler
function handleContextMenu(e, row) {
  e.preventDefault();
  selectedContextItem = row;

  const menu = document.getElementById('customContextMenu');
  if (!menu) return;

  // I-posisyon ang context menu sa coordinates ng mouse click
  menu.style.display = 'block';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;

  // Huwag hayaang lumagpas sa screen viewport
  const rect = menu.getBoundingClientRect();
  if (rect.right > window.innerWidth) {
    menu.style.left = `${window.innerWidth - rect.width - 10}px`;
  }
  if (rect.bottom > window.innerHeight) {
    menu.style.top = `${window.innerHeight - rect.height - 10}px`;
  }
}

// 🖨️ DIRECT PRINT ENGINE (Eksaktong gaya sa Commercial Service Request)
function triggerPrintForm(refNumber) {
  if (!refNumber) return;
  let cleanRef = refNumber.trim().toUpperCase();
  if (cleanRef.startsWith('SR-')) cleanRef = cleanRef.substring(3);

  const printUrl = `/api/commercial/service-requests/print/${encodeURIComponent(cleanRef)}`;
  window.open(printUrl, '_blank');
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

// Isara ang menu kapag nag-click kahit saan sa screen
document.addEventListener('click', (e) => {
  if (!e.target.closest('#customContextMenu')) {
    const menu = document.getElementById('customContextMenu');
    if (menu) menu.style.display = 'none';
  }
});

// 🖨️ Buksan ang A6 Print Accomplishment Window
function triggerPrintAccomplishmentModal() {
  const refNumber = document.getElementById('lblRef').textContent.trim();
  if (!refNumber || refNumber === '-') {
    alert('Walang aktibong Reference Number na napili.');
    return;
  }

  let cleanRef = refNumber.toUpperCase();
  if (cleanRef.startsWith('SR-')) cleanRef = cleanRef.substring(3);

  const printUrl = `/api/engr/service-requests/print-accomplishment/${encodeURIComponent(cleanRef)}`;
  window.open(printUrl, '_blank');
}