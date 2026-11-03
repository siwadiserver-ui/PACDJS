let poolCache = [];
let selectedContextItem = null;
let originalEditItem = null;

window.addEventListener('DOMContentLoaded', async () => {
  const now = new Date();

  // 🕒 Kunin ang lokal na petsa (YYYY-MM-DD)
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  document.getElementById('reqDate').value = `${year}-${month}-${day}`;

  // 🕒 Kunin ang lokal na oras (HH:mm)
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  document.getElementById('reqTime').value = `${hours}:${minutes}`;

  document.querySelectorAll('input[type="text"], textarea').forEach(input => {
    input.addEventListener('input', () => { input.value = input.value.toUpperCase(); });
  });

  await fetchNextRef();
  await loadStaffOptions();
  await loadDataPool();

  checkPrefillFromDisconnection();
});

// Dynamic Load ng Received By Staff (Auto-select ng Logged-in User)
async function loadStaffOptions() {
  const selectEl = document.getElementById('receivedBy');
  if (!selectEl) return;

  try {
    const res = await fetch('/api/misc/users/active');
    const result = await res.json();
    
    if (result.success && result.data) {
      const staff = result.data.filter(u => {
        const d = (u.DIVISION || '').toUpperCase();
        return d === 'COMMERCIAL' || d === 'ADMIN';
      });

      if (staff.length === 0) {
        selectEl.innerHTML = `<option value="COMMDIV/STAFF">COMMDIV/STAFF</option>`;
        return;
      }

      // 1. I-populate ang dropdown options
      selectEl.innerHTML = staff.map(u => {
        const name = (u.FULL_NAME || u.USERNAME).toUpperCase();
        const val = `COMMDIV/${name}`;
        return `<option value="${val}">${val}</option>`;
      }).join('');

      // 2. 🎯 AUTOMATIC SELECTION PARA SA CURRENT LOGGED-IN USER
      const sessionData = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
      if (sessionData) {
        const currentUser = JSON.parse(sessionData);
        const currentName = (currentUser.FULL_NAME || currentUser.username || currentUser.USERNAME || '').toUpperCase();

        if (currentName) {
          const matched = Array.from(selectEl.options).find(o => 
            o.value.toUpperCase().includes(currentName)
          );
          if (matched) {
            selectEl.value = matched.value;
          }
        }
      }
    }
  } catch (e) {
    console.error('Error loading received by options:', e);
    selectEl.innerHTML = `<option value="COMMDIV/STAFF">COMMDIV/STAFF</option>`;
  }
}

async function fetchNextRef() {
  try {
    const res = await fetch('/api/commercial/reconnections/next-ref');
    const data = await res.json();
    if (data.nextRef) document.getElementById('refNumber').value = data.nextRef;
  } catch (e) { console.error(e); }
}

async function onAccountEnter() {
  const p1 = document.getElementById('accPart1').value.trim();
  const p3 = document.getElementById('accPart3').value.trim();
  if (!p1 || !p3) return;

  try {
    const res = await fetch(`/api/commercial/excel/search-customer?part1=${encodeURIComponent(p1)}&part3=${encodeURIComponent(p3)}`);
    const data = await res.json();

    if (data.success && data.found && data.customer) {
      const c = data.customer;
      if (c.ACCOUNT_NUMBER && c.ACCOUNT_NUMBER.includes('-')) {
        const parts = c.ACCOUNT_NUMBER.split('-');
        if (parts.length === 3) {
          document.getElementById('accPart1').value = parts[0];
          document.getElementById('accPart2').value = parts[1];
          document.getElementById('accPart3').value = parts[2];
        }
      }

      document.getElementById('accountName').value = c.ACCOUNT_NAME;
      document.getElementById('address').value = c.ADDRESS || '';
      document.getElementById('meterNumber').value = c.METER_NUMBER || 'NO METER';
      document.getElementById('paidBy').value = c.ACCOUNT_NAME;

      // 30-Day Duplicate Check
      const dupRes = await fetch(`/api/commercial/reconnections/check-duplicate?accountNumber=${encodeURIComponent(c.ACCOUNT_NUMBER)}&accountName=${encodeURIComponent(c.ACCOUNT_NAME)}`);
      const dup = await dupRes.json();
      if (dup.exists) {
        const cont = confirm(`⚠️ Concessionaire ${c.ACCOUNT_NAME} has existing Recon Request #${dup.data.REFERENCE_NUMBER} on ${dup.data.REQUEST_DATE}.\n\nProceed anyway?`);
        if (!cont) return;
      }

      document.getElementById('orNumber').focus();
    }
  } catch (e) { console.error(e); }
}

async function submitReconRequest() {
  const editId = document.getElementById('editingRecordId').value;
  const p1 = document.getElementById('accPart1').value.trim();
  const p2 = document.getElementById('accPart2').value.trim();
  const p3 = document.getElementById('accPart3').value.trim();

  const payload = {
    id: editId,
    referenceNumber: document.getElementById('refNumber').value.trim(),
    accountNumber: (p1 && p3) ? `${p1}-${p2}-${p3}` : '',
    accountName: document.getElementById('accountName').value.trim(),
    address: document.getElementById('address').value.trim(),
    meterNumber: document.getElementById('meterNumber').value.trim(),
    reading: document.getElementById('reading').value,
    orNumber: document.getElementById('orNumber').value.trim(),
    paidBy: document.getElementById('paidBy').value.trim(),
    reconFee: document.getElementById('reconFee').value,
    cdFee: document.getElementById('cdFee').value,
    materialsFee: document.getElementById('materialsFee').value,
    othersFee: document.getElementById('othersFee').value,
    meterStatus: document.getElementById('meterStatus').value,
    receivedBy: document.getElementById('receivedBy').value,
    requestDate: document.getElementById('reqDate').value,
    requestTime: document.getElementById('reqTime').value
  };

if (!payload.referenceNumber || !payload.accountName) {
    alert('Kulang ang required fields (Ref No. o Name).');
    return;
  }

  // ⚠️ Babala kung walang laman o zero ang Reading, OR Number, Recon Fee, o CD Fee
  const missingFields = [];

  const meterReading = parseFloat(payload.reading);
  if (isNaN(meterReading) || payload.reading === '' || payload.reading === null) {
    missingFields.push('• Reading (Walang inilagay na reading)');
  }

  if (!payload.orNumber) {
    missingFields.push('• OR Number');
  }

  const reconAmount = parseFloat(payload.reconFee) || 0;
  if (reconAmount <= 0) {
    missingFields.push('• Recon Fee (Walang halaga / 0.00)');
  }

  const cdAmount = parseFloat(payload.cdFee) || 0;
  if (cdAmount <= 0) {
    missingFields.push('• CD Fee (Walang halaga / 0.00)');
  }

  if (missingFields.length > 0) {
    const confirmProceed = confirm(
      `⚠️ OOOOOPS!\n\n` +
      `Napansin na hindi napunan o kulang ang mga sumusunod:\n` +
      missingFields.join('\n') + `\n\n` +
      `Sigurado ka bang nais mong ituloy ang pag-save nang walang kumpletong detalye?`
    );
    if (!confirmProceed) {
      // Itutok ang cursor sa unang kulang na field
      if (isNaN(meterReading) || payload.reading === '' || payload.reading === null) {
        document.getElementById('reading')?.focus();
      } else if (!payload.orNumber) {
        document.getElementById('orNumber')?.focus();
      } else if (reconAmount <= 0) {
        document.getElementById('reconFee')?.focus();
      } else {
        document.getElementById('cdFee')?.focus();
      }
      return;
    }
  }

  // 🔒 EDIT CHECKING & CONFIRMATION BLOCK
  if (editId && originalEditItem) {
    const origAcc = (originalEditItem.ACCOUNT_NUMBER || '').trim();
    const newAcc = payload.accountNumber.trim();

    const origName = (originalEditItem.ACCOUNT_NAME || '').trim();
    const newName = payload.accountName.trim();

    // 1. Kapag napalitan ang Account Number o Account Name
    if (origAcc !== newAcc || origName !== newName) {
      const confirmAccChange = confirm(
        `⚠️ BABALA SA PAG-EDIT NG RECONNECTION:\n\n` +
        `Napalitan ang Concessionaire Details:\n` +
        `• Dating Account: [${origAcc}] ${origName}\n` +
        `• Bagong Account: [${newAcc}] ${newName}\n\n` +
        `Sigurado ka bang nais mong palitan ang may-ari ng Reference #${payload.referenceNumber}?\n\n` +
        `(Kung ito ay para sa BAGONG request, i-click ang Cancel at pindutin ang Clear Form.)`
      );
      if (!confirmAccChange) return;
    } 
    // 2. Standard confirmation kapag ibang detalye lang (fees, reading, status, atbp.) ang binago
    else {
      const confirmEdit = confirm(
        `📝 I-save ang mga pagbabago para sa Reconnection Request #${payload.referenceNumber}?`
      );
      if (!confirmEdit) return;
    }
  }

  const endpoint = editId ? '/api/commercial/reconnections/update' : '/api/commercial/reconnections/submit';
  const method = editId ? 'PUT' : 'POST';

  try {
    const res = await fetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      // Gamitin ang refNumber mula sa tugon ng server
      const printedRef = result.refNumber || payload.referenceNumber;
      triggerPrintForm(printedRef);
      cancelEditMode();
      await loadDataPool();
    } else {
      alert('Error: ' + result.message);
    }
  } catch (e) {
    alert('Server Error: ' + e.message);
  }
}

function triggerPrintForm(ref) {
  window.open(`/api/commercial/reconnections/print/${encodeURIComponent(ref)}`, '_blank');
}

// 📋 Table Data Pool Loader (Commercial)
async function loadDataPool() {
  const status = document.getElementById('statusFilter').value;
  try {
    const res = await fetch(`/api/commercial/reconnections/pool?status=${status}`);
    const data = await res.json();
    if (data.success) {
      // 🔒 I-sort agad ayon sa ID (Latest to Oldest)
      poolCache = (data.data || []).sort((a, b) => Number(b.ID) - Number(a.ID));
      renderDataPool(poolCache);
    }
  } catch (e) { 
    console.error(e); 
  }
}

function renderDataPool(list) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-sec);">Walang tala sa Data Pool.</td></tr>`;
    return;
  }

  list.forEach(item => {
    const isReconnected = (item.STATUS || '').toUpperCase() === 'RECONNECTED';
    const isNoOr = (!item.OR_NUMBER || !item.OR_NUMBER.trim());
    
    // Priority: Kung reconnected na, berde. Kung walang OR at pending, pula.
    let rowClass = '';
    if (isReconnected) {
      rowClass = 'reconnected-row';
    } else if (isNoOr) {
      rowClass = 'no-or';
    }

    const displayAddr = (item.ADDRESS || '').length > 30 ? item.ADDRESS.substring(0, 30) + '...' : (item.ADDRESS || '');

    const tr = document.createElement('tr');
    tr.className = rowClass;

    tr.innerHTML = `
      <td style="font-weight: 700; color: ${isReconnected ? '#2b8a3e' : 'var(--danger)'};">${item.REFERENCE_NUMBER}</td>
      <td>${item.ACCOUNT_NUMBER || ''}</td>
      <td>${item.ACCOUNT_NAME || ''}</td>
      <td>${displayAddr}</td>
      <td>${item.METER_NUMBER || ''}</td>
      <td>${item.OR_NUMBER || 'NO OR'}</td>
      <td>${item.METER_STATUS || ''}</td>
      <td>${item.RECEIVED_BY || ''}</td>
      <td>${item.REQUEST_DATE || ''}</td>
    `;

    // Right-Click Context Menu[cite: 10, 13]
    tr.addEventListener('contextmenu', (e) => handleRowContextMenu(e, item.ID));

    // 🚀 DOBOL CLICK: Open Read-Only Reconnection Accomplishment Modal
    tr.addEventListener('dblclick', () => openViewReconModal(item));

    tbody.appendChild(tr);
  });
}

// 🪟 View-Only Modal Functions (Read-Only)
function openViewReconModal(item) {
  const setInputVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  };

  const setTextVal = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTextVal('vrRef', item.REFERENCE_NUMBER || '-');
  setTextVal('vrAcc', item.ACCOUNT_NUMBER || '-');
  setTextVal('vrName', item.ACCOUNT_NAME || '-');
  setTextVal('vrOr', item.OR_NUMBER || 'NO OR');
  setTextVal('vrMeter', item.METER_NUMBER || '-');
  setTextVal('vrReading', item.READING || '0');
  setTextVal('vrAddress', item.ADDRESS || '-');

  const elRec = document.getElementById('vrReceivedBy');
  if (elRec) elRec.textContent = item.RECEIVED_BY || 'COMMDIV/STAFF';

  const elDate = document.getElementById('vrReqDate');
  if (elDate) {
    const d = item.REQUEST_DATE || '';
    const t = item.REQUEST_TIME || '';
    elDate.textContent = (d || t) ? `${d} ${t}`.trim() : '-';
  }

  // Engineering Accomplishment Data
  setTextVal('vrPlumbers', item.RECONNECTED_BY || 'None / Not Assigned Yet');
  setInputVal('vrReconDate', item.DATE_RECONNECTED || 'Pending');
  setInputVal('vrMeterStatus', item.METER_STATUS || 'MAGNETIC');
  setInputVal('vrNewMeter', item.NEW_METER_NUMBER || '-');
  setInputVal('vrStatus', item.STATUS || 'PENDING');
  setInputVal('vrUpdatedBy', item.UPDATED_BY || 'NOT YET UPDATED');

  const modal = document.getElementById('viewReconModal');
  if (modal) modal.classList.remove('hidden');
}

function closeViewReconModal() {
  const modal = document.getElementById('viewReconModal');
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
    document.getElementById('customContextMenu').style.display = 'none';
  }
});

function triggerDirectPrint() {
  document.getElementById('customContextMenu').style.display = 'none';
  if (selectedContextItem) triggerPrintForm(selectedContextItem.REFERENCE_NUMBER);
}

function triggerEdit() {
  document.getElementById('customContextMenu').style.display = 'none';
  if (!selectedContextItem) return;

  // 🔒 I-save ang kopya ng orihinal na data bago baguhin
  originalEditItem = { ...selectedContextItem };

  const it = selectedContextItem;
  document.getElementById('editingRecordId').value = it.ID;
  document.getElementById('refNumber').value = it.REFERENCE_NUMBER;

  if (it.ACCOUNT_NUMBER && it.ACCOUNT_NUMBER.includes('-')) {
    const p = it.ACCOUNT_NUMBER.split('-');
    if (p.length === 3) {
      document.getElementById('accPart1').value = p[0];
      document.getElementById('accPart2').value = p[1];
      document.getElementById('accPart3').value = p[2];
    }
  }

  document.getElementById('accountName').value = it.ACCOUNT_NAME || '';
  document.getElementById('address').value = it.ADDRESS || '';
  document.getElementById('meterNumber').value = it.METER_NUMBER || '';
  document.getElementById('reading').value = it.READING || '';
  document.getElementById('orNumber').value = it.OR_NUMBER || '';
  document.getElementById('paidBy').value = it.PAID_BY || '';
  document.getElementById('reconFee').value = it.RECON_FEE || '';
  document.getElementById('cdFee').value = it.CD_FEE || '';
  document.getElementById('materialsFee').value = it.MATERIALS_FEE || '';
  document.getElementById('othersFee').value = it.OTHERS_FEE || '';
  document.getElementById('meterStatus').value = it.METER_STATUS || 'MAGNETIC';
  document.getElementById('receivedBy').value = it.RECEIVED_BY || '';
  document.getElementById('reqDate').value = it.REQUEST_DATE || '';
  document.getElementById('reqTime').value = it.REQUEST_TIME || '';

  document.getElementById('btnSubmitForm').innerHTML = "<i class='bx bx-printer'></i> Update / Print";
  document.getElementById('btnCancelEdit').style.display = 'inline-flex';
}

function cancelEditMode() {
  clearForm();
  originalEditItem = null; // 🔒 I-reset ang original item cache
  document.getElementById('editingRecordId').value = '';
  document.getElementById('btnSubmitForm').innerHTML = "<i class='bx bx-printer'></i> Submit / Print";
  document.getElementById('btnCancelEdit').style.display = 'none';
  fetchNextRef();
}

async function triggerDelete() {
  document.getElementById('customContextMenu').style.display = 'none';
  if (!selectedContextItem) return;

  // 1. Initial Confirmation Prompt
  if (!confirm(`Sigurado ka bang buburahin ang Reconnection #${selectedContextItem.REFERENCE_NUMBER}?`)) return;

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

  // 3. Pagpapatuloy sa pagbura kapag tama ang password
  try {
    const res = await fetch(`/api/commercial/reconnections/delete/${selectedContextItem.ID}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      alert(`✅ Reconnection #${selectedContextItem.REFERENCE_NUMBER} deleted.`);
      cancelEditMode();
      await loadDataPool();
    } else {
      alert('Delete Error: ' + data.message);
    }
  } catch (e) { 
    alert('Server Error: ' + e.message); 
  }
}

function clearForm() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');

  // I-reset ang petsa at oras sa kasalukuyan
  document.getElementById('reqDate').value = `${year}-${month}-${day}`;
  document.getElementById('reqTime').value = `${hours}:${minutes}`;

  document.getElementById('accPart1').value = '';
  document.getElementById('accPart2').value = 'XXX';
  document.getElementById('accPart3').value = '';
  document.getElementById('accountName').value = '';
  document.getElementById('address').value = '';
  document.getElementById('meterNumber').value = '';
  document.getElementById('reading').value = '';
  document.getElementById('orNumber').value = '';
  document.getElementById('paidBy').value = '';
  document.getElementById('reconFee').value = '';
  document.getElementById('cdFee').value = '';
  document.getElementById('materialsFee').value = '';
  document.getElementById('othersFee').value = '';
  
  // 🎯 Ibalik ang Received By sa kasalukuyang naka-log in na user
  const sessionData = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
  if (sessionData) {
    const currentUser = JSON.parse(sessionData);
    const currentName = (currentUser.FULL_NAME || currentUser.username || currentUser.USERNAME || '').toUpperCase();
    const selectEl = document.getElementById('receivedBy');
    if (selectEl && currentName) {
      const matched = Array.from(selectEl.options).find(o => o.value.toUpperCase().includes(currentName));
      if (matched) selectEl.value = matched.value;
    }
  }

  document.getElementById('accPart1').focus();
}

function filterDataPool(kw) {
  const k = kw.toLowerCase();
  const filtered = poolCache.filter(it => Object.values(it).some(v => String(v).toLowerCase().includes(k)));
  renderDataPool(filtered);
}

// 📊 Export to Excel (CSV Format compatible with MS Excel)
function exportReconnectionsToExcel() {
  if (!poolCache || poolCache.length === 0) {
    alert('Walang data na mai-export sa kasalukuyang table.');
    return;
  }

  const currentStatus = document.getElementById('statusFilter').value;
  const filename = `Reconnections_${currentStatus}_${new Date().toISOString().slice(0, 10)}.csv`;

  // 1. Table Headers
  const headers = [
    'Reference Number',
    'Account Number',
    'Account Name',
    'Address',
    'Old Meter Number',
    'Reading',
    'OR Number',
    'Paid By',
    'Recon Fee',
    'CD Fee',
    'Materials Fee',
    'Others Fee',
    'Meter Status',
    'Received By',
    'Request Date',
    'Request Time',
    'Status',
    'Reconnected By',
    'Date Reconnected',
    'New Meter Number',
    'Updated By'
  ];

  // 2. Data Rows Parsing
  const rows = poolCache.map(item => [
    `"${(item.REFERENCE_NUMBER || '').replace(/"/g, '""')}"`,
    `"${(item.ACCOUNT_NUMBER || '').replace(/"/g, '""')}"`,
    `"${(item.ACCOUNT_NAME || '').replace(/"/g, '""')}"`,
    `"${(item.ADDRESS || '').replace(/"/g, '""')}"`,
    `"${(item.METER_NUMBER || '').replace(/"/g, '""')}"`,
    `"${item.READING || '0'}"`,
    `"${(item.OR_NUMBER || 'NO OR').replace(/"/g, '""')}"`,
    `"${(item.PAID_BY || '').replace(/"/g, '""')}"`,
    `"${item.RECON_FEE || '0.00'}"`,
    `"${item.CD_FEE || '0.00'}"`,
    `"${item.MATERIALS_FEE || '0.00'}"`,
    `"${item.OTHERS_FEE || '0.00'}"`,
    `"${(item.METER_STATUS || '').replace(/"/g, '""')}"`,
    `"${(item.RECEIVED_BY || '').replace(/"/g, '""')}"`,
    `"${item.REQUEST_DATE || ''}"`,
    `"${item.REQUEST_TIME || ''}"`,
    `"${item.STATUS || 'PENDING'}"`,
    `"${(item.RECONNECTED_BY || '').replace(/"/g, '""')}"`,
    `"${item.DATE_RECONNECTED || ''}"`,
    `"${(item.NEW_METER_NUMBER || '').replace(/"/g, '""')}"`,
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

function checkPrefillFromDisconnection() {
  const prefillRaw = sessionStorage.getItem('recon_prefill');
  if (!prefillRaw) return;

  try {
    const c = JSON.parse(prefillRaw);
    sessionStorage.removeItem('recon_prefill'); // Linisin agad para hindi mag-populate muli pag-refresh

    // 1. I-parse ang Account Number sa 3 boxes (accPart1, accPart2, accPart3)
    if (c.accountNumber && c.accountNumber.includes('-')) {
      const parts = c.accountNumber.split('-').map(s => s.trim());
      if (parts.length >= 3) {
        document.getElementById('accPart1').value = parts[0];
        document.getElementById('accPart2').value = parts[1];
        document.getElementById('accPart3').value = parts[2];
      } else if (parts.length === 2) {
        document.getElementById('accPart1').value = parts[0];
        document.getElementById('accPart2').value = 'XXX';
        document.getElementById('accPart3').value = parts[1];
      }
    }

    // 2. I-fill ang Customer Details
    if (document.getElementById('accountName')) document.getElementById('accountName').value = c.accountName || '';
    if (document.getElementById('address')) document.getElementById('address').value = c.address || '';
    if (document.getElementById('meterNumber')) document.getElementById('meterNumber').value = c.meterNumber || '';
    if (document.getElementById('reading')) document.getElementById('reading').value = c.reading || 0;
    if (document.getElementById('paidBy')) document.getElementById('paidBy').value = c.accountName || '';
    if (document.getElementById('meterStatus') && c.meterStatus) {
      document.getElementById('meterStatus').value = c.meterStatus;
    }

    // 3. I-focus ang cursor sa OR Number para diretsong makapag-encode ng bayad
    setTimeout(() => {
      const orInput = document.getElementById('orNumber');
      if (orInput) orInput.focus();
    }, 250);

  } catch (err) {
    console.error('Error prefilling from disconnection:', err);
  }
}