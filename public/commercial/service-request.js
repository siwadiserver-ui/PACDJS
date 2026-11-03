let poolCache = [];
let availableRequestDetails = [];
let selectedContextItem = null;
let originalEditItem = null;

window.addEventListener('DOMContentLoaded', async () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  document.getElementById('reqDate').value = `${year}-${month}-${day}`;

  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('reqTime').value = `${hours}:${minutes}`;

  document.querySelectorAll('input[type="text"], textarea').forEach(input => {
    input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });
  });

  await fetchNextRef();
  await loadRequestDetailsOptions();
  await loadReceivedByStaff();
  await loadDataPool();

// 🔄 Auto-refresh bawat 5 segundo
  setInterval(() => {
    const isEditing = document.getElementById('editingRecordId')?.value;
    const searchInput = document.getElementById('searchTableInput');
    const isSearching = searchInput && document.activeElement === searchInput;

    // Huwag mag-refresh kung nag-e-edit o kasalukuyang nagta-type sa search bar
    if (!isEditing && !isSearching) {
      loadDataPool();
    }
  }, 5000);

  // 📥 Suriin kung may ipinasa mula sa Online Complaints
  setTimeout(checkIncomingOnlineComplaint, 300);
});

// Dynamic Load ng Received By Staff (Commercial/Admin Filtered)
async function loadReceivedByStaff() {
  const selectEl = document.getElementById('receivedBy');
  if (!selectEl) return;

  try {
    const res = await fetch('/api/misc/users/active');
    const result = await res.json();

    if (result.success && result.data) {
      const commercialStaff = result.data.filter(u => {
        const div = (u.DIVISION || '').toUpperCase();
        return div === 'COMMERCIAL' || div === 'ADMIN';
      });

      if (commercialStaff.length === 0) {
        selectEl.innerHTML = `<option value="COMMDIV/STAFF">COMMDIV/STAFF</option>`;
        return;
      }

      selectEl.innerHTML = commercialStaff.map(u => {
        const name = (u.FULL_NAME || u.USERNAME).toUpperCase();
        const val = `COMMDIV/${name}`;
        return `<option value="${val}">${val}</option>`;
      }).join('');

      const sessionData = sessionStorage.getItem('currentUser');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData);
        if (currentUser.username) {
          const matched = Array.from(selectEl.options).find(o => 
            o.value.includes(currentUser.username.toUpperCase())
          );
          if (matched) selectEl.value = matched.value;
        }
      }
    }
  } catch (err) {
    console.error('Error loading received by options:', err);
    selectEl.innerHTML = `<option value="COMMDIV/STAFF">COMMDIV/STAFF</option>`;
  }
}

async function loadRequestDetailsOptions() {
  try {
    const res = await fetch('/api/misc/request-details/active');
    const data = await res.json();
    if (data.success) {
      availableRequestDetails = data.data;
      renderDetailsModalGrid(availableRequestDetails);
    }
  } catch (err) {
    console.error('Failed to load request details config:', err);
  }
}

function renderDetailsModalGrid(list) {
  const grid = document.querySelector('.selector-grid');
  if (!grid) return;

  grid.innerHTML = list.map(item => `
    <label class="radio-item">
      <input type="radio" name="reqOpt" value="${item.DETAIL_NAME}">
      <span>${item.DETAIL_NAME}</span>
    </label>
  `).join('');
}

async function fetchNextRef() {
  try {
    const res = await fetch('/api/commercial/service-requests/next-ref');
    const data = await res.json();
    if (data.nextRef) {
      document.getElementById('refNumber').value = data.nextRef;
      document.getElementById('refNumber').classList.remove('duplicate-warning');
    }
  } catch (err) {
    console.error(err);
  }
}

async function handleRefInput(val) {
  if (val.length > 3) {
    const res = await fetch(`/api/commercial/service-requests/check-ref?ref=${encodeURIComponent(val)}`);
    const data = await res.json();
    if (data.exists) {
      document.getElementById('refNumber').classList.add('duplicate-warning');
    } else {
      document.getElementById('refNumber').classList.remove('duplicate-warning');
    }
  }
}

function applyRequestedByPreset(val) {
  if (!val) return;

  if (val === 'ACCOUNT_NAME') {
    const accName = document.getElementById('accountName').value.trim();
    document.getElementById('requestedBy').value = accName || 'CONCERN CITIZEN';
  } else {
    document.getElementById('requestedBy').value = val;
  }

  document.getElementById('requestedByQuickSelect').value = '';
}

async function onAccountEnter() {
  const p1 = document.getElementById('accPart1').value.trim();
  const p3 = document.getElementById('accPart3').value.trim();
  if (!p1 || !p3) {
    alert('Pakilagay ang Part 1 at Part 3 ng Account Number bago mag-Enter.');
    return;
  }

  try {
    const res = await fetch(`/api/commercial/excel/search-customer?part1=${encodeURIComponent(p1)}&part3=${encodeURIComponent(p3)}`);
    const data = await res.json();

    if (data.success && data.found && data.customer) {
      const cust = data.customer;

      if (cust.ACCOUNT_NUMBER && cust.ACCOUNT_NUMBER.includes('-')) {
        const parts = cust.ACCOUNT_NUMBER.split('-');
        if (parts.length === 3) {
          document.getElementById('accPart1').value = parts[0];
          document.getElementById('accPart2').value = parts[1];
          document.getElementById('accPart3').value = parts[2];
        }
      }

      document.getElementById('accountName').value = cust.ACCOUNT_NAME;
      document.getElementById('address').value = cust.ADDRESS || '';
      document.getElementById('meterNumber').value = cust.METER_NUMBER || 'NO METER';
      // I-set ang pangalan mula sa Excel sa text input AT sa unang option ng dropdown
      document.getElementById('requestedBy').value = cust.ACCOUNT_NAME;
      const optOwner = document.getElementById('optOwner');
      if (optOwner) {
        optOwner.value = cust.ACCOUNT_NAME;
        optOwner.textContent = cust.ACCOUNT_NAME;
      }
      document.getElementById('contactNumber').value = 'N/A';

      const todayDate = document.getElementById('reqDate').value;
      const chkRes = await fetch(`/api/commercial/service-requests/check-today?accountName=${encodeURIComponent(cust.ACCOUNT_NAME)}&accountNumber=${encodeURIComponent(cust.ACCOUNT_NUMBER)}&requestDate=${todayDate}`);
      const chkData = await chkRes.json();

      if (chkData.requests && chkData.requests.length > 0) {
        const listStr = chkData.requests.map(r => `• Ref: ${r.REFERENCE_NUMBER} - ${r.REQUEST_DETAILS}`).join('\n');
        const proceed = confirm(`⚠️ Ang concessionaire na si ${cust.ACCOUNT_NAME} ay may existing request na NGAYONG ARAW:\n\n${listStr}\n\nIpagpapatuloy ba bilang BAGONG request?`);
        if (!proceed) {
          document.getElementById('accPart3').value = '';
          document.getElementById('accPart3').focus();
          return;
        }
      }

      document.getElementById('waterMeterReading').focus();
    } else {
      alert('Customer not found. Paki-upload ang updated Concessionaire Excel file.');
    }
  } catch (err) {
    console.error(err);
  }
}

// 📌 2. Submit / Update Handler na may Printing Trigger
async function submitRequest() {
  const editId = document.getElementById('editingRecordId').value;
  const p1 = document.getElementById('accPart1').value.trim();
  const p2 = document.getElementById('accPart2').value.trim();
  const p3 = document.getElementById('accPart3').value.trim();
  const fullAcc = (p1 && p3) ? `${p1}-${p2}-${p3}` : '';

  const reqDetails = document.getElementById('btnRequestDetails').textContent.trim();
  if (reqDetails === 'PLEASE SELECT' || !reqDetails) {
    alert('Mangyaring pumili ng Request Details muna.');
    return;
  }

  const payload = {
    id: editId,
    referenceNumber: document.getElementById('refNumber').value.trim(),
    accountNumber: fullAcc,
    accountName: document.getElementById('accountName').value.trim(),
    address: document.getElementById('address').value.trim(),
    meterNumber: document.getElementById('meterNumber').value.trim(),
    receivedBy: document.getElementById('receivedBy').value,
    requestedBy: document.getElementById('requestedBy').value.trim() || 'CONCERN CITIZEN',
    contactNumber: document.getElementById('contactNumber').value.trim() || 'N/A',
    waterMeterReading: document.getElementById('waterMeterReading').value,
    requestDate: document.getElementById('reqDate').value,
    requestTime: document.getElementById('reqTime').value,
    requestDetails: reqDetails,
    otherDetails: document.getElementById('otherDetails').value.trim()
  };

  if (!payload.referenceNumber || !payload.accountName) {
    alert('Kulang ang mandatory fields (Ref No. o Account Name).');
    return;
  }

  try {
    const endpoint = editId ? '/api/commercial/service-requests/update' : '/api/commercial/service-requests/submit';
    const method = editId ? 'PUT' : 'POST';

    // 🔒 EDIT CHECKING VALIDATION BLOCK
  if (editId && originalEditItem) {
    const origAcc = (originalEditItem.ACCOUNT_NUMBER || '').trim();
    const newAcc = payload.accountNumber.trim();

    const origName = (originalEditItem.ACCOUNT_NAME || '').trim();
    const newName = payload.accountName.trim();

    // 1. Kapag napalitan ang Account Number o Account Name
    if (origAcc !== newAcc || origName !== newName) {
      const confirmAccChange = confirm(
        `⚠️ BABALA SA PAG-EDIT NG RECORD:\n\n` +
        `Napalitan ang Concessionaire Details:\n` +
        `• Dating Account: [${origAcc}] ${origName}\n` +
        `• Bagong Account: [${newAcc}] ${newName}\n\n` +
        `Sigurado ka bang nais mong palitan ang may-ari ng Reference #${payload.referenceNumber}?\n\n` +
        `(Kung ito ay para sa BAGONG request, i-click ang Cancel at mag-Clear Form muna.)`
      );
      if (!confirmAccChange) return;
    } 
    // 2. Standard confirmation kapag ibang detalye lang ang na-edit
    else {
      const confirmEdit = confirm(
        `📝 I-save ang modification para sa Service Request #${payload.referenceNumber}?`
      );
      if (!confirmEdit) return;
    }
  }

    const res = await fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

  const data = await res.json();
    if (data.success) {
      // 🎯 BINAGO: Gamitin ang refNumber mula sa server response
      const activeRef = data.refNumber || payload.referenceNumber;

      // 🖨️ DIRECT PRINT TRIGGER
      triggerPrintForm(activeRef);

      cancelEditMode();
      await loadDataPool();
    } else {
      alert(`Error: ${data.message}`);
    }
  } catch (err) {
    alert('Network/Server Error: ' + err.message);
  }
}

// 📌 3. Printing Engine (Direct Tab Navigation / Dedicated View)
function triggerPrintForm(refNumber) {
  if (!refNumber) return;
  let cleanRef = refNumber.trim().toUpperCase();
  if (cleanRef.startsWith('SR-')) cleanRef = cleanRef.substring(3);

  const printUrl = `/api/commercial/service-requests/print/${encodeURIComponent(cleanRef)}`;
  window.open(printUrl, '_blank');
}

// 📌 4. Data Pool List Management
async function loadDataPool() {
  const status = document.getElementById('statusFilter').value;
  try {
    const res = await fetch(`/api/commercial/service-requests/pool?status=${status}`);
    const data = await res.json();
    if (data.success) {
      poolCache = data.data;

      // 🔍 Panatilihin ang search filter kung may nakasulat sa search input
      const searchKeyword = document.getElementById('searchTableInput')?.value.trim();
      if (searchKeyword) {
        filterDataPool(searchKeyword);
      } else {
        renderDataPool(poolCache);
      }
    }
  } catch (err) {
    console.error(err);
  }
}

// Helper para sa Descending Sort: 26-1000 pababa sa 26-0000
function sortDataPoolDescending(list) {
  return [...list].sort((a, b) => {
    const parseRef = (refStr) => {
      if (!refStr) return 0;
      let clean = refStr.replace(/^SR-/i, '').trim();
      const parts = clean.split('-');
      if (parts.length === 2) {
        const year = parseInt(parts[0], 10) || 0;
        const seq = parseInt(parts[1], 10) || 0;
        return (year * 1000000) + seq;
      }
      return parseInt(clean.replace(/\D/g, ''), 10) || 0;
    };
    return parseRef(b.REFERENCE_NUMBER) - parseRef(a.REFERENCE_NUMBER);
  });
}

function renderDataPool(list) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (!list || list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-sec);">Walang tala sa Data Pool.</td></tr>`;
    return;
  }

  // 1. I-sort mula pinakabagong reference number pababa (latest to oldest)
  const sortedList = sortDataPoolDescending(list);

  sortedList.forEach(item => {
    const isCompleted = (item.STATUS === 'COMPLETED');
    const displayName = (item.ACCOUNT_NAME || '').length > 20 ? item.ACCOUNT_NAME.substring(0, 20) + '...' : (item.ACCOUNT_NAME || '');
    const displayAddr = (item.ADDRESS || '').length > 20 ? item.ADDRESS.substring(0, 20) + '...' : (item.ADDRESS || '');
    const displayReqBy = (item.REQUESTED_BY || '').length > 16 ? item.REQUESTED_BY.substring(0, 16) + '...' : (item.REQUESTED_BY || '');
    const displayDet = (item.REQUEST_DETAILS || '').length > 22 ? item.REQUEST_DETAILS.substring(0, 22) + '...' : (item.REQUEST_DETAILS || '');
    const displaySpecify = (item.OTHER_DETAILS && item.OTHER_DETAILS.trim()) ? item.OTHER_DETAILS : 'N/A';

    // Format Account Number
    let formattedAcc = item.ACCOUNT_NUMBER || '';
    if (formattedAcc && formattedAcc.includes('-')) {
      const parts = formattedAcc.split('-').map(p => p.trim());
      if (parts.length === 3) {
        formattedAcc = `${parts[0].padStart(2, '0')}-<span style="color: var(--primary); font-weight: 800;">${parts[1]}</span>-${parts[2].padStart(3, '0')}`;
      } else if (parts.length === 2) {
        formattedAcc = `${parts[0].padStart(2, '0')}-<span style="color: var(--text-sec); font-weight: 800;">XXX</span>-${parts[1].padStart(3, '0')}`;
      }
    }

    const tr = document.createElement('tr');
    tr.className = isCompleted ? 'completed-row' : '';
    tr.setAttribute('data-id', item.ID);

    tr.innerHTML = `
      <td style="width: 90px; font-weight: 700; color: var(--danger);">${item.REFERENCE_NUMBER}</td>
      <td style="width: 105px; max-width: 105px; white-space: nowrap;"><strong>${formattedAcc}</strong></td>
      <td style="max-width: 160px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600;" title="${item.ACCOUNT_NAME || ''}">${displayName}</td>
      <td style="max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.ADDRESS || ''}">${displayAddr}</td>
      <td style="max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${item.REQUESTED_BY || ''}">${displayReqBy}</td>
      <td style="width: 95px;">${item.REQUEST_DATE || ''}</td>
      <td>${displayDet}</td>
      <td style="width: 130px;"><strong>${item.RECEIVED_BY || 'COMMDIV/STAFF'}</strong></td>
      <td style="color: var(--text-sec);" title="${item.OTHER_DETAILS || ''}">${displaySpecify}</td>
    `;

    // Right-Click Context Menu (Edit/Print/Delete)
    tr.addEventListener('contextmenu', (e) => handleRowContextMenu(e, item.ID));

    // Double Click para sa View Modal
    tr.addEventListener('dblclick', () => openViewModal(item));

    tbody.appendChild(tr);
  });
}

function openViewModal(item) {
  document.getElementById('vRef').textContent = item.REFERENCE_NUMBER || '-';
  document.getElementById('vAcc').textContent = item.ACCOUNT_NUMBER || '-';
  document.getElementById('vName').textContent = item.ACCOUNT_NAME || '-';
  document.getElementById('vDetails').textContent = item.REQUEST_DETAILS || '-';
  document.getElementById('vAddress').textContent = item.ADDRESS || '-';
  document.getElementById('vSpecify').textContent = (item.OTHER_DETAILS && item.OTHER_DETAILS.trim()) ? item.OTHER_DETAILS : 'N/A';

  // 🔹 Idinagdag: Requested By
  const elReqBy = document.getElementById('vRequestedBy');
  if (elReqBy) elReqBy.textContent = item.REQUESTED_BY || 'CONCERN CITIZEN';

  // 🔹 Received By at Date/Time mula sa Commercial
  const elRec = document.getElementById('vReceivedBy');
  if (elRec) elRec.textContent = item.RECEIVED_BY || 'COMMDIV/STAFF';

  const elReqDt = document.getElementById('vReqDateTime');
  if (elReqDt) {
    const d = item.REQUEST_DATE || '';
    const t = item.REQUEST_TIME || '';
    elReqDt.textContent = (d || t) ? `${d} ${t}`.trim() : '-';
  }

  // Engineering Accomplishment Data
  document.getElementById('vPlumbers').textContent = item.COMPLETED_BY || 'None / Not Assigned Yet';
  document.getElementById('vAction').textContent = item.ACTION_TAKEN || 'None / Pending Action';
  document.getElementById('vMaterials').textContent = item.MATERIALS || 'WALA';

  document.getElementById('vCompDate').value = item.COMPLETION_DATE || 'Pending';
  document.getElementById('vStatus').value = item.STATUS || 'PENDING';
  document.getElementById('vRemarks').value = item.PLUMBER_REMARKS || 'No remarks recorded.';
  
  const elUpd = document.getElementById('vUpdatedBy');
  if (elUpd) {
    elUpd.value = item.UPDATED_BY || 'NOT YET UPDATED';
  }

  const modal = document.getElementById('viewModal');
  if (modal) modal.classList.remove('hidden');
}

function closeViewModal() {
  const modal = document.getElementById('viewModal');
  if (modal) modal.classList.add('hidden');
}

function handleRowContextMenu(e, id) {
  e.preventDefault();
  selectedContextItem = poolCache.find(i => Number(i.ID) === Number(id));
  if (!selectedContextItem) return;

  const menu = document.getElementById('customContextMenu');
  menu.style.display = 'flex';
  menu.style.left = `${e.clientX}px`;
  menu.style.top = `${e.clientY}px`;
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('#customContextMenu')) {
    const menu = document.getElementById('customContextMenu');
    if (menu) menu.style.display = 'none';
  }
});

function triggerEditFromContext() {
  const menu = document.getElementById('customContextMenu');
  if (menu) menu.style.display = 'none';
  if (!selectedContextItem) return;

  // 🔒 I-save ang orihinal na data bago magsimula ang edit
  originalEditItem = { ...selectedContextItem };

  const item = selectedContextItem;
  const editIdEl = document.getElementById('editingRecordId');
  if (editIdEl) editIdEl.value = item.ID;

  const refEl = document.getElementById('refNumber');
  if (refEl) refEl.value = item.REFERENCE_NUMBER;

  if (item.ACCOUNT_NUMBER && item.ACCOUNT_NUMBER.includes('-')) {
    const parts = item.ACCOUNT_NUMBER.split('-');
    if (parts.length === 3) {
      document.getElementById('accPart1').value = parts[0];
      document.getElementById('accPart2').value = parts[1];
      document.getElementById('accPart3').value = parts[2];
    }
  }

  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val || '';
  };

  setVal('accountName', item.ACCOUNT_NAME);
  setVal('address', item.ADDRESS);
  setVal('meterNumber', item.METER_NUMBER);
  setVal('receivedBy', item.RECEIVED_BY);
  setVal('requestedBy', item.REQUESTED_BY);
  setVal('contactNumber', item.CONTACT_NUMBER || 'N/A');
  setVal('waterMeterReading', item.WATER_METER_READING);
  setVal('otherDetails', item.OTHER_DETAILS || 'N/A');

  const btnDetails = document.getElementById('btnRequestDetails');
  if (btnDetails) btnDetails.textContent = item.REQUEST_DETAILS || 'PLEASE SELECT';

  if (item.REQUEST_DATE) setVal('reqDate', item.REQUEST_DATE);
  if (item.REQUEST_TIME) setVal('reqTime', item.REQUEST_TIME);

  const panel = document.querySelector('.panel-card');
  if (panel) panel.classList.add('edit-mode-active');

  const headerTitle = document.getElementById('formHeaderTitle');
  if (headerTitle) headerTitle.textContent = `✏️ EDITING REF: ${item.REFERENCE_NUMBER}`;

  const btnSubmit = document.getElementById('btnSubmitForm');
  if (btnSubmit) {
    btnSubmit.innerHTML = "<i class='bx bx-printer'></i> Update / Print";
    btnSubmit.classList.remove('btn-submit-main');
    btnSubmit.style.backgroundColor = 'var(--warning)';
    btnSubmit.style.color = '#000';
  }

  const btnCancel = document.getElementById('btnCancelEdit');
  if (btnCancel) btnCancel.style.display = 'inline-flex';
}

function cancelEditMode() {
  clearForm();
  originalEditItem = null; // 🔒 I-reset ang original item cache
  
  const panel = document.querySelector('.panel-card');
  if (panel) panel.classList.remove('edit-mode-active');

  const headerTitle = document.getElementById('formHeaderTitle');
  if (headerTitle) headerTitle.textContent = 'Always Check The Reference Number';

  const btnSubmit = document.getElementById('btnSubmitForm');
  if (btnSubmit) {
    btnSubmit.innerHTML = "<i class='bx bx-printer'></i> Submit / Print";
    btnSubmit.classList.add('btn-submit-main');
    btnSubmit.removeAttribute('style');
  }

  const btnCancel = document.getElementById('btnCancelEdit');
  if (btnCancel) btnCancel.style.display = 'none';

  const editIdEl = document.getElementById('editingRecordId');
  if (editIdEl) editIdEl.value = '';

  fetchNextRef();
}

async function triggerDeleteFromContext() {
  const menu = document.getElementById('customContextMenu');
  if (menu) menu.style.display = 'none';
  if (!selectedContextItem) return;

  const item = selectedContextItem;

  // 1. Initial Confirmation
  const proceed = confirm(`⚠️ BABALA: Sigurado ka bang nais mong BURAHIN ang Service Request?\n\n• Ref No: ${item.REFERENCE_NUMBER}\n• Account: ${item.ACCOUNT_NAME}\n\nMABUBURA ITO NANG PERMANENTE SA DATABASE.`);
  if (!proceed) return;

  // 2. Security Check (Password Prompt)
  const pass = prompt('🔒 SECURITY CHECK:\nIlagay ang password upang kumpirmahin ang pagbura:');

  if (pass === null) return; // Kinansela ng user

  if (pass !== 'KUMAKALABUKAB' && pass !== 'kumakalabukab') {
    alert('❌ Mali ang password! Kanselado ang pagbura ng record.');
    return;
  }

  // 3. Pagpasa ng ID at Password sa backend
  try {
    const res = await fetch(`/api/commercial/service-requests/delete/${item.ID}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pass })
    });
    const data = await res.json();

    if (data.success) {
      alert(`✅ Nabura na ang record at Ref #${item.REFERENCE_NUMBER}.`);
      if (document.getElementById('editingRecordId').value == item.ID) {
        cancelEditMode();
      }
      await loadDataPool();
      await fetchNextRef();
    } else {
      alert('Delete Error: ' + (data.error || data.message));
    }
  } catch (err) {
    alert('Server Error: ' + err.message);
  }
}

function filterDataPool(keyword) {
  const kw = keyword.toLowerCase();
  const filtered = poolCache.filter(item => Object.values(item).some(val => String(val).toLowerCase().includes(kw)));
  renderDataPool(filtered);
}

function openDetailsSelector() {
  document.getElementById('detailsModal').classList.remove('hidden');
}

function closeDetailsSelector() {
  document.getElementById('detailsModal').classList.add('hidden');
}

function applyDetailsSelection() {
  const sel = document.querySelector('input[name="reqOpt"]:checked');
  if (sel) {
    document.getElementById('btnRequestDetails').textContent = sel.value;
    
    const otherDetailsEl = document.getElementById('otherDetails');
    const curVal = (otherDetailsEl.value || '').trim();

    // Kung dating blangko o 'N/A' lang ang laman, gawing 'N/A' kapag hindi OTHERS.
    // Pero kung may laman na reklamo (tulad ng [ONLINE COMPLAINT]), HUWAG buburahin!
    if (sel.value !== 'OTHERS') {
      if (!curVal || curVal === 'N/A') {
        otherDetailsEl.value = 'N/A';
      }
    } else {
      if (curVal === 'N/A') {
        otherDetailsEl.value = '';
      }
      otherDetailsEl.focus();
    }
  }
  closeDetailsSelector();
}

function clearForm() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  document.getElementById('reqDate').value = `${year}-${month}-${day}`;
  document.getElementById('reqTime').value = `${hours}:${minutes}`;

  document.getElementById('accPart1').value = '';
  document.getElementById('accPart2').value = 'XXX';
  document.getElementById('accPart3').value = '';
  document.getElementById('accountName').value = '';
  document.getElementById('address').value = '';
  document.getElementById('meterNumber').value = '';
  document.getElementById('requestedBy').value = 'CONCERN CITIZEN';
  document.getElementById('contactNumber').value = 'N/A';
  document.getElementById('waterMeterReading').value = '';
  document.getElementById('btnRequestDetails').textContent = 'PLEASE SELECT';
  document.getElementById('otherDetails').value = 'N/A';
  document.getElementById('accPart1').focus();
}

function triggerDirectPrintFromContext() {
  const menu = document.getElementById('customContextMenu');
  if (menu) menu.style.display = 'none';
  if (!selectedContextItem) return;

  triggerPrintForm(selectedContextItem.REFERENCE_NUMBER);
}

// 📊 5. Export to Excel (CSV Format compatible with MS Excel)
function exportServiceRequestsToExcel() {
  if (!poolCache || poolCache.length === 0) {
    alert('Walang data na mai-export sa kasalukuyang table.');
    return;
  }

  const currentStatus = document.getElementById('statusFilter').value;
  const filename = `Service_Requests_${currentStatus}_${new Date().toISOString().slice(0, 10)}.csv`;

  // 1. Table Headers
  const headers = [
    'Reference Number',
    'Account Number',
    'Account Name',
    'Address',
    'Meter Number',
    'Received By',
    'Requested By',
    'Contact Number',
    'Reading',
    'Request Date',
    'Request Time',
    'Request Details',
    'Specify / Other Details',
    'Status',
    'Completed By',
    'Action Taken',
    'Materials Used',
    'Completion Date',
    'Plumber Remarks',
    'Updated By'
  ];

  // 2. Data Rows Parsing
  const rows = poolCache.map(item => [
    `"${(item.REFERENCE_NUMBER || '').replace(/"/g, '""')}"`,
    `"${(item.ACCOUNT_NUMBER || '').replace(/"/g, '""')}"`,
    `"${(item.ACCOUNT_NAME || '').replace(/"/g, '""')}"`,
    `"${(item.ADDRESS || '').replace(/"/g, '""')}"`,
    `"${(item.METER_NUMBER || '').replace(/"/g, '""')}"`,
    `"${(item.RECEIVED_BY || '').replace(/"/g, '""')}"`,
    `"${(item.REQUESTED_BY || '').replace(/"/g, '""')}"`,
    `"${(item.CONTACT_NUMBER || '').replace(/"/g, '""')}"`,
    `"${item.WATER_METER_READING || ''}"`,
    `"${item.REQUEST_DATE || ''}"`,
    `"${item.REQUEST_TIME || ''}"`,
    `"${(item.REQUEST_DETAILS || '').replace(/"/g, '""')}"`,
    `"${(item.OTHER_DETAILS || '').replace(/"/g, '""')}"`,
    `"${item.STATUS || 'PENDING'}"`,
    `"${(item.COMPLETED_BY || '').replace(/"/g, '""')}"`,
    `"${(item.ACTION_TAKEN || '').replace(/"/g, '""')}"`,
    `"${(item.MATERIALS || '').replace(/"/g, '""')}"`,
    `"${item.COMPLETION_DATE || ''}"`,
    `"${(item.PLUMBER_REMARKS || '').replace(/"/g, '""')}"`,
    `"${(item.UPDATED_BY || '').replace(/"/g, '""')}"`
  ]);

  // 3. UTF-8 BOM (\uFEFF) para mabasa nang maayos ng MS Excel ang mga special characters
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

// ============================================================
// 📥 AUTO-FILL MULA SA ONLINE COMPLAINTS
// ============================================================
async function checkIncomingOnlineComplaint() {
  const rawData = localStorage.getItem('pendingComplaintForSR');
  if (!rawData) return;

  try {
    const complaint = JSON.parse(rawData);
    localStorage.removeItem('pendingComplaintForSR'); // Linisin agad para hindi mag-ulit

    // 1. I-fill ang Account Number boxes kung mayroong valid account number
    let cleanAcc = (complaint.account_no || '').trim().replace(/[\s\-\–]/g, '');
    if (cleanAcc.length === 9) {
      document.getElementById('accPart1').value = cleanAcc.slice(0, 3);
      document.getElementById('accPart2').value = cleanAcc.slice(3, 6);
      document.getElementById('accPart3').value = cleanAcc.slice(6, 9);
      
      // Auto-trigger customer search mula sa database
      await onAccountEnter();
    } else if (complaint.account_no && complaint.account_no.includes('-')) {
      const parts = complaint.account_no.split('-');
      if (parts.length === 3) {
        document.getElementById('accPart1').value = parts[0];
        document.getElementById('accPart2').value = parts[1];
        document.getElementById('accPart3').value = parts[2];
        await onAccountEnter();
      }
    }

    // 2. I-fill ang Concessionaire Info kung walang na-auto search o fallback
    if (!document.getElementById('accountName').value) {
      document.getElementById('accountName').value = (complaint.account_name || '').toUpperCase();
    }

    // 3. I-fill ang Contact Number at Requested By
    if (complaint.contact_no) {
      document.getElementById('contactNumber').value = complaint.contact_no;
    }
    if (complaint.account_name) {
      document.getElementById('requestedBy').value = complaint.account_name.toUpperCase();
    }

    // 4. Ilagay ang mismong reklamo sa SPECIFY textarea
    const refTag = complaint.reference_no ? `[ONLINE COMPLAINT: ${complaint.reference_no}] ` : '';
    document.getElementById('otherDetails').value = `${refTag}${complaint.complaint_details || ''}`.toUpperCase();

    // 5. I-focus ang Request Details button para pumili ang staff ng tamang kategorya
    const btnReq = document.getElementById('btnRequestDetails');
    if (btnReq) {
      btnReq.style.boxShadow = '0 0 10px rgba(2, 132, 199, 0.7)';
      btnReq.focus();
    }

    alert(`📥 Na-import ang reklamo ni:\n👤 ${complaint.account_name}\n\nPakipili ang "Request Details" kategorya bago i-submit ang Service Request.`);

  } catch (err) {
    console.error('Error importing complaint to SR:', err);
  }
}