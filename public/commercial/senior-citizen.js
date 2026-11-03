let poolData = [];
let selectedRowId = null;
let contextSelectedRecord = null;

document.addEventListener('DOMContentLoaded', () => {
  initDefaults();
  fetchNextRef();
  loadDataPool();
  setupEnterKeyNav();
  setupContextMenu();
});

function initDefaults() {
  const now = new Date();
  document.getElementById('appDate').value = now.toISOString().split('T')[0];
}

// 🔢 Auto-increment fetch mula sa pinakamataas na tala sa DB
async function fetchNextRef() {
  try {
    const res = await fetch('/api/commercial/senior/next-ref');
    const json = await res.json();
    if (json.success && json.refNumber) {
      document.getElementById('refNumber').value = json.refNumber;
    }
  } catch (err) {
    console.error('Error fetching ref:', err);
  }
}

// ⌨️ Enter Key Navigation Handler
function setupEnterKeyNav() {
  const navMap = [
    { from: 'refNumber', to: 'applicationType' },
    { from: 'applicationType', to: 'accPart1' },
    { from: 'accPart1', to: 'accPart3' },
    { from: 'accPart3', to: 'surname', onEnter: () => onAccountEnter() },
    { from: 'surname', to: 'firstname' },
    { from: 'firstname', to: 'middleName' },
    { from: 'middleName', to: 'address' },
    { from: 'address', to: 'contactNumber' },
    { from: 'contactNumber', to: 'appDate' },
    { from: 'appDate', to: 'remarks' }
  ];

  navMap.forEach(item => {
    const el = document.getElementById(item.from);
    if (!el) return;

    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (el.tagName === 'TEXTAREA' && e.shiftKey) return;

        e.preventDefault();
        if (typeof item.onEnter === 'function') item.onEnter();

        const nextEl = document.getElementById(item.to);
        if (nextEl) nextEl.focus();
      }
    });
  });
}

// 🔍 Search Customer Logic (Patterned from reconnection.js)
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

      document.getElementById('address').value = c.ADDRESS || '';

      const rawName = (c.ACCOUNT_NAME || '').trim();
      if (rawName.includes(',')) {
        const [surnamePart, restPart] = rawName.split(',');
        document.getElementById('surname').value = surnamePart.trim();

        const restWords = restPart.trim().split(/\s+/);
        if (restWords.length > 1) {
          document.getElementById('firstname').value = restWords.slice(0, -1).join(' ');
          document.getElementById('middleName').value = restWords[restWords.length - 1];
        } else {
          document.getElementById('firstname').value = restWords[0] || '';
          document.getElementById('middleName').value = '';
        }
      } else {
        document.getElementById('surname').value = rawName;
        document.getElementById('firstname').value = '';
        document.getElementById('middleName').value = '';
      }
    }
  } catch (e) {
    console.error('Account search error:', e);
  }
}

// 📷 Photo Upload & Preview
function handlePhotoUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      document.getElementById('photoBase64').value = e.target.result;
      document.getElementById('previewContainer').innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// 📋 Table Data Pool Loader
async function loadDataPool() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/commercial/senior/list');
    poolData = await res.json();
    renderTable(poolData);
  } catch (err) {
    console.error('Error loading senior pool:', err);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--danger);">Error loading data: ${err.message}</td></tr>`;
  }
}

function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-sec);">Walang tala ng Senior Citizen Discount.</td></tr>`;
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');
    const fullName = `${row.SURNAME || ''}, ${row.FIRSTNAME || ''} ${row.MIDDLE_NAME || ''}`.trim();

    let stClass = 'st-active';
    if (row.COMPUTED_STATUS === 'EXPIRED') stClass = 'st-expired';
    else if (row.COMPUTED_STATUS === 'NEAR EXPIRY') stClass = 'st-near';

    tr.innerHTML = `
      <td><strong>${row.REFERENCE_NUMBER || ''}</strong></td>
      <td><span style="font-weight: 700; padding: 2px 6px; border-radius: 4px; background: #fef3c7; color: #b45309;">${row.APPLICATION_TYPE || 'NEW'}</span></td>
      <td><strong>${fullName}</strong></td>
      <td>${row.ACCOUNT_NUMBER || '-'}</td>
      <td>${row.APPLICATION_DATE || '-'}</td>
      <td>${row.EXPIRATION_DATE || '-'}</td>
      <td><span class="st-badge ${stClass}">${row.COMPUTED_STATUS || 'ACTIVE'}</span></td>
      <td>${row.ADDRESS || ''}</td>
    `;

    tr.addEventListener('click', () => loadIntoForm(row));
    tr.addEventListener('dblclick', () => loadIntoForm(row));

    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextSelectedRecord = row;
      showContextMenu(e.pageX, e.pageY);
    });

    tbody.appendChild(tr);
  });
}

function filterDataPool(keyword) {
  const q = keyword.trim().toUpperCase();
  if (!q) return renderTable(poolData);

  const matched = poolData.filter(d =>
    (d.REFERENCE_NUMBER && d.REFERENCE_NUMBER.toUpperCase().includes(q)) ||
    (d.SURNAME && d.SURNAME.toUpperCase().includes(q)) ||
    (d.FIRSTNAME && d.FIRSTNAME.toUpperCase().includes(q)) ||
    (d.ACCOUNT_NUMBER && d.ACCOUNT_NUMBER.toUpperCase().includes(q))
  );
  renderTable(matched);
}

// ✏️ Load Record into Form for Editing
function loadIntoForm(row) {
  selectedRowId = row.ID;
  document.getElementById('editingRecordId').value = row.ID;
  document.getElementById('refNumber').value = row.REFERENCE_NUMBER || '';
  document.getElementById('applicationType').value = row.APPLICATION_TYPE || 'NEW';

  if (row.ACCOUNT_NUMBER && row.ACCOUNT_NUMBER.includes('-')) {
    const p = row.ACCOUNT_NUMBER.split('-');
    document.getElementById('accPart1').value = p[0] || '';
    document.getElementById('accPart2').value = p[1] || 'XXX';
    document.getElementById('accPart3').value = p[2] || '';
  }

  document.getElementById('surname').value = row.SURNAME || '';
  document.getElementById('firstname').value = row.FIRSTNAME || '';
  document.getElementById('middleName').value = row.MIDDLE_NAME || '';
  document.getElementById('address').value = row.ADDRESS || '';
  document.getElementById('contactNumber').value = row.CONTACT_NUMBER || '';
  document.getElementById('appDate').value = row.APPLICATION_DATE ? row.APPLICATION_DATE.split('T')[0] : '';
  document.getElementById('remarks').value = row.REMARKS || '';

  const savedReqs = (row.REQUIREMENTS_SUBMITTED || '').split(',');
  document.querySelectorAll('.chk-req').forEach(cb => {
    cb.checked = savedReqs.includes(cb.value);
  });

  const savedIds = (row.ID_SUBMITTED || '').split(',');
  document.querySelectorAll('.chk-id').forEach(cb => {
    cb.checked = savedIds.includes(cb.value);
  });

  document.getElementById('chkAuthLetter').checked = (row.IS_REPRESENTATIVE == 1);
  document.getElementById('chkRepId').checked = (row.IS_REPRESENTATIVE == 1);

// 🖼️ Kunin ang litrato gamit ang bagong hiwalay na endpoint
  document.getElementById('photoBase64').value = '';
  document.getElementById('previewContainer').innerHTML = `<span style="font-size: 0.65rem; color: #64748b;">Loading...</span>`;

  fetch(`/api/commercial/senior/photo/${row.ID}`)
    .then(res => res.json())
    .then(data => {
      if (data.success && data.photo && String(data.photo).trim().length > 50) {
        const src = data.photo.startsWith('data:image') ? data.photo : `data:image/jpeg;base64,${data.photo}`;
        document.getElementById('photoBase64').value = src;
        document.getElementById('previewContainer').innerHTML = `<img src="${src}" style="width: 100%; height: 100%; object-fit: cover;">`;
      } else {
        document.getElementById('photoBase64').value = '';
        document.getElementById('previewContainer').innerHTML = `<span style="font-size: 0.65rem; color: #64748b;">2x2</span>`;
      }
    })
    .catch(() => {
      document.getElementById('previewContainer').innerHTML = `<span style="font-size: 0.65rem; color: #64748b;">2x2</span>`;
    });

  document.getElementById('formHeaderTitle').textContent = `Edit Record: ${row.REFERENCE_NUMBER}`;
  document.getElementById('editModeIndicator').style.display = 'inline-block';
  document.getElementById('btnSave').innerHTML = `<i class='bx bx-check-double'></i> Update Record`;
  document.getElementById('btnDeleteForm').style.display = 'inline-flex';
}

function clearForm() {
  selectedRowId = null;
  document.getElementById('editingRecordId').value = '';
  document.getElementById('applicationType').value = 'NEW';
  document.getElementById('accPart1').value = '';
  document.getElementById('accPart2').value = 'XXX';
  document.getElementById('accPart3').value = '';
  document.getElementById('surname').value = '';
  document.getElementById('firstname').value = '';
  document.getElementById('middleName').value = '';
  document.getElementById('address').value = '';
  document.getElementById('contactNumber').value = '';
  document.getElementById('remarks').value = '';
  document.getElementById('photoBase64').value = '';
  document.getElementById('photoInput').value = '';
  document.getElementById('previewContainer').innerHTML = `<span style="font-size: 0.65rem; color: var(--text-sec);">2x2</span>`;

  document.getElementById('formHeaderTitle').textContent = 'Senior Citizen Discount Application';
  document.getElementById('editModeIndicator').style.display = 'none';
  document.getElementById('btnSave').innerHTML = `<i class='bx bx-save'></i> Save Record`;
  document.getElementById('btnDeleteForm').style.display = 'none';

  initDefaults();
  fetchNextRef();
}

// 💾 Save / Update Action
async function saveRecord() {
  const p1 = document.getElementById('accPart1').value.trim();
  const p2 = document.getElementById('accPart2').value.trim();
  const p3 = document.getElementById('accPart3').value.trim();
  const accNo = (p1 && p3) ? `${p1}-${p2}-${p3}` : '';

  const reqs = Array.from(document.querySelectorAll('.chk-req:checked')).map(cb => cb.value).join(',');
  const ids = Array.from(document.querySelectorAll('.chk-id:checked')).map(cb => cb.value).join(',');
  const isRep = document.getElementById('chkAuthLetter').checked || document.getElementById('chkRepId').checked;

  const payload = {
    id: document.getElementById('editingRecordId').value || null,
    reference_number: document.getElementById('refNumber').value,
    application_type: document.getElementById('applicationType').value,
    account_number: accNo,
    surname: document.getElementById('surname').value,
    firstname: document.getElementById('firstname').value,
    middle_name: document.getElementById('middleName').value,
    address: document.getElementById('address').value,
    contact_number: document.getElementById('contactNumber').value,
    requirements_submitted: reqs,
    id_submitted: ids,
    is_representative: isRep,
    photo_data: document.getElementById('photoBase64').value || null,
    application_date: document.getElementById('appDate').value,
    remarks: document.getElementById('remarks').value
  };

  if (!payload.reference_number || !payload.account_number || !payload.surname || !payload.firstname) {
    alert('Pakikompleto ang Ref #, Account No., Surname, at Firstname.');
    return;
  }

  try {
    const res = await fetch('/api/commercial/senior/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      alert(`✅ ${result.message}`);
      clearForm();
      await loadDataPool();
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

// 🗑️ Delete Handling mula sa Form Button
async function deleteCurrentRecord() {
  const id = document.getElementById('editingRecordId')?.value;
  const ref = document.getElementById('refNumber')?.value;
  if (!id) return;

  if (!confirm(`CRITICAL CONFIRMATION: Sigurado ka bang nais mong burahin ang record para sa Ref #${ref}?`)) {
    return;
  }

  // 👈 Dito lalabas ang prompt box
  const pass = prompt('🔒 SECURITY CHECK:\nIlagay ang password upang kumpirmahin ang pagbura:');

  if (pass === null) return; // Kinansela ng user

  if (pass !== 'KUMAKALABUKAB' && pass !== 'kumakalabukab') {
    alert('❌ Mali ang password! Kanselado ang pagbura ng record.');
    return;
  }

  try {
    const res = await fetch('/api/commercial/senior/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, password: pass }) // 👈 Ipinapasa ang password sa server
    });
    const result = await res.json();
    if (result.success) {
      alert('🗑️ Record deleted successfully.');
      clearForm();
      await loadDataPool();
    } else {
      alert('❌ Error: ' + (result.error || result.message));
    }
  } catch (e) {
    alert('❌ Delete error: ' + e.message);
  }
}

// 🖱️ Delete Handling mula sa Context Menu
async function triggerDeleteFromContext() {
  if (!contextSelectedRecord) return;

  if (!confirm(`Sigurado ka bang buburahin ang tala para sa ${contextSelectedRecord.REFERENCE_NUMBER}?`)) return;

  // 👈 Dito lalabas ang prompt box
  const pass = prompt('🔒 SECURITY CHECK:\nIlagay ang password upang kumpirmahin ang pagbura:');

  if (pass === null) return;

  if (pass !== 'KUMAKALABUKAB' && pass !== 'kumakalabukab') {
    alert('❌ Mali ang password! Kanselado ang pagbura ng record.');
    return;
  }

  try {
    const res = await fetch('/api/commercial/senior/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contextSelectedRecord.ID, password: pass }) // 👈 Ipinapasa ang password sa server
    });
    const result = await res.json();
    if (result.success) {
      alert('🗑️ Record deleted successfully.');
      if (document.getElementById('editingRecordId')?.value == contextSelectedRecord.ID) {
        clearForm();
      }
      await loadDataPool();
    } else {
      alert('❌ Error: ' + (result.error || result.message));
    }
  } catch (e) {
    alert('❌ Delete error: ' + e.message);
  }
}

// 🖨️ A4 Printing Setup
function printApplication() {
  const surname = document.getElementById('surname').value.trim();
  if (!surname) {
    alert('Pumili muna o maghanap ng Concessionaire bago mag-print.');
    return;
  }

  const p1 = document.getElementById('accPart1').value.trim();
  const p2 = document.getElementById('accPart2').value.trim();
  const p3 = document.getElementById('accPart3').value.trim();

  document.getElementById('pSurname').textContent = surname;
  document.getElementById('pFirstname').textContent = document.getElementById('firstname').value.trim();
  document.getElementById('pMI').textContent = document.getElementById('middleName').value.trim() || '';
  document.getElementById('pAddress').textContent = document.getElementById('address').value.trim();
  document.getElementById('pContact').textContent = document.getElementById('contactNumber').value.trim() || '';
  document.getElementById('pAccount').textContent = (p1 && p3) ? `${p1}-${p2}-${p3}` : '';
  document.getElementById('pRefNo').textContent = document.getElementById('refNumber').value.trim();

  // Matatag na Photo Handling
  const photo = document.getElementById('photoBase64').value;
  const pBox = document.getElementById('pPhotoBox');
  if (photo && photo.trim().length > 100) {
    const src = photo.startsWith('data:image') ? photo : `data:image/jpeg;base64,${photo}`;
    pBox.innerHTML = `<img src="${src}" style="width: 100%; height: 100%; object-fit: cover;">`;
  } else {
    pBox.innerHTML = `<span style="font-size: 8pt; color: #666;">2x2 Photo</span>`;
  }

  const isChecked = (selector, val) => {
    const el = Array.from(document.querySelectorAll(selector)).find(cb => cb.value.toUpperCase().includes(val.toUpperCase()));
    return el && el.checked;
  };

  document.getElementById('pReqApp').textContent = isChecked('.chk-req', 'Application Form') ? '☑ Application Form' : '□ Application Form';
  document.getElementById('pReqOwn').textContent = isChecked('.chk-req', 'Proof of Ownership') ? '☑ Proof of Ownership' : '□ Proof of Ownership';
  document.getElementById('pReqTax').textContent = isChecked('.chk-req', 'Tax') ? '☑ Real Estate Tax/Tax-Dec' : '□ Real Estate Tax/Tax-Dec';
  document.getElementById('pReqId').textContent = isChecked('.chk-req', 'Photocopy') ? '☑ Photocopy ID with three specimen signatures' : '□ Photocopy ID with three specimen signatures';

  document.getElementById('pIdPassport').textContent = isChecked('.chk-id', 'Passport') ? '☑ Passport' : '□ Passport';
  document.getElementById('pIdBarangay').textContent = isChecked('.chk-id', 'Barangay') ? '☑ Barangay ID' : '□ Barangay ID';
  document.getElementById('pIdPostal').textContent = isChecked('.chk-id', 'Postal') ? '☑ Postal ID' : '□ Postal ID';
  document.getElementById('pIdLicense').textContent = isChecked('.chk-id', 'Driver') ? "☑ Driver's License" : "□ Driver's License";
  document.getElementById('pIdSss').textContent = isChecked('.chk-id', 'SSS') ? '☑ SSS/GSIS ID' : '□ SSS/GSIS ID';
  document.getElementById('pIdSenior').textContent = isChecked('.chk-id', 'Senior') ? '☑ Senior Citizen ID' : '□ Senior Citizen ID';

  const authChecked = document.getElementById('chkAuthLetter')?.checked;
  const repIdChecked = document.getElementById('chkRepId')?.checked;
  document.getElementById('pAuthLetter').textContent = authChecked ? '☑ Authorization letter (if applying through representative)' : '□ Authorization letter (if applying through representative)';
  document.getElementById('pDeptId').textContent = repIdChecked ? '☑ Department Issued ID (if the Representative)' : '□ Department Issued ID (if the Representative)';

  const appType = (document.getElementById('applicationType').value || 'NEW').toUpperCase();
  document.getElementById('pTypeNew').textContent = (appType === 'NEW') ? '☑ New' : '□ New';
  document.getElementById('pTypeRenewal').textContent = (appType === 'RENEWAL') ? '☑ Renewal' : '□ Renewal';

  const appDateInput = document.getElementById('appDate').value;
  const appDate = appDateInput ? new Date(appDateInput) : new Date();
  
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  document.getElementById('pDateDay').textContent = appDate.getDate();
  document.getElementById('pDateMonth').textContent = months[appDate.getMonth()];
  document.getElementById('pDateYear').textContent = appDate.getFullYear();

  window.print();
}

// 🖱️ Context Menu Handlers
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

function triggerEditFromContext() {
  if (contextSelectedRecord) loadIntoForm(contextSelectedRecord);
}

function triggerPrintFromContext() {
  if (contextSelectedRecord) {
    loadIntoForm(contextSelectedRecord);
    setTimeout(() => {
      printApplication();
    }, 200);
  }
}

async function triggerDeleteFromContext() {
  if (!contextSelectedRecord) return;

  // 1. Initial Confirmation
  if (!confirm(`Sigurado ka bang buburahin ang tala para sa ${contextSelectedRecord.REFERENCE_NUMBER}?`)) return;

  // 2. Security Check (Password Prompt)
  const pass = prompt('🔒 SECURITY CHECK:\nIlagay ang password upang kumpirmahin ang pagbura:');

  if (pass === null) return; // Kinansela ng user

  if (pass !== 'KUMAKALABUKAB' && pass !== 'kumakalabukab') {
    alert('❌ Mali ang password! Kanselado ang pagbura ng record.');
    return;
  }

  // 3. Pagpasa ng ID at Password sa server
  try {
    const res = await fetch('/api/commercial/senior/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: contextSelectedRecord.ID, password: pass })
    });
    const result = await res.json();
    if (result.success) {
      alert('🗑️ Record deleted successfully.');
      if (document.getElementById('editingRecordId')?.value == contextSelectedRecord.ID) {
        clearForm();
      }
      await loadDataPool();
    } else {
      alert('❌ Error: ' + (result.error || result.message));
    }
  } catch (e) {
    alert('❌ Delete error: ' + e.message);
  }
}

// 📄 Print Blank A4 Application Form (Para sa manual filling)
function printBlankApplication() {
  // Linisin ang mga personal details para blanko
  document.getElementById('pSurname').textContent = '';
  document.getElementById('pFirstname').textContent = '';
  document.getElementById('pMI').textContent = '';
  document.getElementById('pAddress').textContent = '';
  document.getElementById('pContact').textContent = '';
  document.getElementById('pAccount').textContent = '';
  document.getElementById('pRefNo').textContent = '';

  // 2x2 Photo Box Placeholder
  document.getElementById('pPhotoBox').innerHTML = `<span style="font-size: 8pt; color: #888;">Attach 2x2 Photo Here</span>`;

  // Gawing blangkong kahon (□) ang lahat ng requirements at IDs
  document.getElementById('pReqApp').textContent = '□ Application Form';
  document.getElementById('pReqOwn').textContent = '□ Proof of Ownership';
  document.getElementById('pReqTax').textContent = '□ Real Estate Tax/Tax-Dec';
  document.getElementById('pReqId').textContent = '□ Photocopy ID with three specimen signatures';

  document.getElementById('pIdPassport').textContent = '□ Passport';
  document.getElementById('pIdBarangay').textContent = '□ Barangay ID';
  document.getElementById('pIdPostal').textContent = '□ Postal ID';
  document.getElementById('pIdLicense').textContent = "□ Driver's License";
  document.getElementById('pIdSss').textContent = '□ SSS/GSIS ID';
  document.getElementById('pIdSenior').textContent = '□ Senior Citizen ID';

  document.getElementById('pAuthLetter').textContent = '□ Authorization letter (if applying through representative)';
  document.getElementById('pDeptId').textContent = '□ Department Issued ID (if the Representative)';

  // Blank checkboxes sa Application Type
  document.getElementById('pTypeNew').textContent = '□ New';
  document.getElementById('pTypeRenewal').textContent = '□ Renewal';

  // Blangkong petsa para mano-manong isulat
  document.getElementById('pDateDay').textContent = '_____';
  document.getElementById('pDateMonth').textContent = '_________________';
  document.getElementById('pDateYear').textContent = '2026';

  // Buksan ang printer dialog
  window.print();
}

// 📊 Export Senior Citizen Records to Excel
function exportSeniorsToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Hindi ma-load ang Excel library. Pakisuri ang iyong koneksyon sa internet.');
    return;
  }

  const searchVal = (document.getElementById('searchTableInput')?.value || '').trim().toUpperCase();

  // Kuhanin ang kasalukuyang naka-search o buong poolData
  let targetData = (Array.isArray(poolData) ? poolData : []).filter(d => {
    if (!searchVal) return true;
    return (
      (d.REFERENCE_NUMBER && d.REFERENCE_NUMBER.toUpperCase().includes(searchVal)) ||
      (d.SURNAME && d.SURNAME.toUpperCase().includes(searchVal)) ||
      (d.FIRSTNAME && d.FIRSTNAME.toUpperCase().includes(searchVal)) ||
      (d.MIDDLE_NAME && d.MIDDLE_NAME.toUpperCase().includes(searchVal)) ||
      (d.ACCOUNT_NUMBER && d.ACCOUNT_NUMBER.toUpperCase().includes(searchVal)) ||
      (d.ADDRESS && d.ADDRESS.toUpperCase().includes(searchVal))
    );
  });

  if (targetData.length === 0) {
    alert('Walang tala ng Senior Citizen na mai-export batay sa kasalukuyang search.');
    return;
  }

  // I-format ang columns para sa spreadsheet
  const exportRows = targetData.map(row => {
    const fullName = `${row.SURNAME || ''}, ${row.FIRSTNAME || ''} ${row.MIDDLE_NAME || ''}`.trim();
    const appDate = row.APPLICATION_DATE ? row.APPLICATION_DATE.split('T')[0] : '';
    const expDate = row.EXPIRATION_DATE ? row.EXPIRATION_DATE.split('T')[0] : '';

    return {
      'Ref #': row.REFERENCE_NUMBER || '',
      'App. Type': row.APPLICATION_TYPE || 'NEW',
      'Account Number': row.ACCOUNT_NUMBER || '',
      'Surname': row.SURNAME || '',
      'Firstname': row.FIRSTNAME || '',
      'Middle Name': row.MIDDLE_NAME || '',
      'Full Name': fullName,
      'Address': row.ADDRESS || '',
      'Contact #': row.CONTACT_NUMBER || '',
      'Application Date': appDate,
      'Expiration Date': expDate,
      'Validity Status': row.COMPUTED_STATUS || 'ACTIVE',
      'Requirements Submitted': row.REQUIREMENTS_SUBMITTED || '',
      'IDs Submitted': row.ID_SUBMITTED || '',
      'Representative': row.IS_REPRESENTATIVE == 1 ? 'YES' : 'NO',
      'Remarks': row.REMARKS || ''
    };
  });

  // Gumawa ng worksheet at i-adjust ang lapad ng mga columns
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  worksheet['!cols'] = [
    { wch: 14 }, // Ref #
    { wch: 12 }, // App. Type
    { wch: 18 }, // Account Number
    { wch: 18 }, // Surname
    { wch: 18 }, // Firstname
    { wch: 16 }, // Middle Name
    { wch: 28 }, // Full Name
    { wch: 35 }, // Address
    { wch: 15 }, // Contact #
    { wch: 16 }, // Application Date
    { wch: 16 }, // Expiration Date
    { wch: 16 }, // Validity Status
    { wch: 32 }, // Requirements Submitted
    { wch: 25 }, // IDs Submitted
    { wch: 14 }, // Representative
    { wch: 28 }  // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Senior Citizens');

  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Senior_Citizen_Discount_List_${todayStr}.xlsx`);
}

// 📷 Web Camera & Zoom Handlers
let cameraStream = null;
let currentZoomLevel = 1.0;

async function openCameraModal() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraVideo');

  modal.style.display = 'flex';
  resetZoomControl();

  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    alert('Security Warning: Ang camera ay gumagana lamang sa HTTPS o kapag naka-access sa "http://localhost:3001".');
    closeCameraModal();
    return;
  }

  if (!navigator.mediaDevices) {
    navigator.mediaDevices = {};
  }

  if (!navigator.mediaDevices.getUserMedia) {
    const legacyGetUserMedia = navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
    if (!legacyGetUserMedia) {
      alert('Hindi suportado ng browser na ito ang camera access.');
      closeCameraModal();
      return;
    }
    navigator.mediaDevices.getUserMedia = function (constraints) {
      return new Promise((resolve, reject) => {
        legacyGetUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }

  try {
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 640 } },
      audio: false
    });
    video.srcObject = cameraStream;
  } catch (err) {
    alert('Hindi ma-access ang camera: ' + err.message + '\nTiyaking may camera na nakakabit at pinayagan ang permission.');
    closeCameraModal();
  }
}

// 🔍 Live Zoom Function
function updateCameraZoom(val) {
  currentZoomLevel = parseFloat(val);
  const video = document.getElementById('cameraVideo');
  const textLabel = document.getElementById('zoomLevelText');

  if (textLabel) textLabel.textContent = `${currentZoomLevel.toFixed(1)}x`;

  // 1. Subukang gamitin ang Hardware Zoom (kung suportado ng webcam)
  if (cameraStream) {
    const track = cameraStream.getVideoTracks()[0];
    if (track && typeof track.getCapabilities === 'function') {
      const capabilities = track.getCapabilities();
      if (capabilities.zoom) {
        track.applyConstraints({
          advanced: [{ zoom: Math.min(currentZoomLevel, capabilities.zoom.max) }]
        }).catch(() => {});
      }
    }
  }

  // 2. CSS Visual Scale (Universal preview zoom para sa lahat ng uri ng camera)
  if (video) {
    video.style.transform = `scale(${currentZoomLevel})`;
  }
}

function resetZoomControl() {
  currentZoomLevel = 1.0;
  const rangeInput = document.getElementById('cameraZoomRange');
  const textLabel = document.getElementById('zoomLevelText');
  const video = document.getElementById('cameraVideo');

  if (rangeInput) rangeInput.value = 1.0;
  if (textLabel) textLabel.textContent = '1.0x';
  if (video) video.style.transform = 'scale(1.0)';
}

function takeSnapshot() {
  const video = document.getElementById('cameraVideo');
  const canvas = document.getElementById('cameraCanvas');
  const ctx = canvas.getContext('2d');

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Kalkulahin ang cropped bounding box batay sa currentZoomLevel
  const zoomedWidth = w / currentZoomLevel;
  const zoomedHeight = h / currentZoomLevel;
  const offsetX = (w - zoomedWidth) / 2;
  const offsetY = (h - zoomedHeight) / 2;

  // I-draw sa canvas ang eksaktong na-zoom na area ng video
  ctx.drawImage(
    video, 
    0, 0, video.videoWidth || w, video.videoHeight || h, // Source dimensions
    -offsetX * currentZoomLevel, -offsetY * currentZoomLevel, w * currentZoomLevel, h * currentZoomLevel // Destination scaled area
  );

  // I-convert sa JPEG Base64
  const photoBase64 = canvas.toDataURL('image/jpeg', 0.85);

  // Isaksak sa form input at preview container
  document.getElementById('photoBase64').value = photoBase64;
  document.getElementById('previewContainer').innerHTML = `<img src="${photoBase64}" style="width: 100%; height: 100%; object-fit: cover;">`;

  closeCameraModal();
}

function closeCameraModal() {
  const modal = document.getElementById('cameraModal');
  const video = document.getElementById('cameraVideo');

  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }
  if (video) {
    video.srcObject = null;
  }

  resetZoomControl();
  modal.style.display = 'none';
}

// 🖼️ View & Edit Photo Modal Handlers
let modalTempPhotoBase64 = '';

function openPhotoViewerModal() {
  const currentPhoto = document.getElementById('photoBase64').value;
  const displayBox = document.getElementById('modalPhotoDisplay');
  const recordId = document.getElementById('editingRecordId').value;

  modalTempPhotoBase64 = currentPhoto || '';

  if (modalTempPhotoBase64 && modalTempPhotoBase64.trim().length > 50) {
    const src = modalTempPhotoBase64.startsWith('data:image') ? modalTempPhotoBase64 : `data:image/jpeg;base64,${modalTempPhotoBase64}`;
    displayBox.innerHTML = `<img src="${src}" style="width: 100%; height: 100%; object-fit: cover;">`;
  } else {
    displayBox.innerHTML = `<span style="font-size: 0.8rem; color: #64748b;">Walang Litrato</span>`;
  }

  // I-show/hide ang Save Photo Only button depende kung may napiling record na na-load
  const btnSavePhoto = document.getElementById('btnSavePhotoOnly');
  if (recordId) {
    btnSavePhoto.style.display = 'inline-flex';
  } else {
    btnSavePhoto.style.display = 'none'; // Kapag bagong entry, gamitin ang main Save Record button
  }

  document.getElementById('photoViewerModal').style.display = 'flex';
}

function closePhotoViewerModal() {
  document.getElementById('photoViewerModal').style.display = 'none';
}

// Upload bagong litrato mula sa Viewer Modal
function handleModalPhotoUpload(input) {
  if (input.files && input.files[0]) {
    const reader = new FileReader();
    reader.onload = function (e) {
      modalTempPhotoBase64 = e.target.result;
      
      // Update sa Viewer Modal
      document.getElementById('modalPhotoDisplay').innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
      
      // Sync sa Main Form
      document.getElementById('photoBase64').value = e.target.result;
      document.getElementById('previewContainer').innerHTML = `<img src="${e.target.result}" style="width: 100%; height: 100%; object-fit: cover;">`;
    };
    reader.readAsDataURL(input.files[0]);
  }
}

// Buksan ang Camera mula sa Viewer Modal
function openCameraFromModal() {
  closePhotoViewerModal();
  openCameraModal();
}

// 💾 Direktang pag-save ng litrato lamang papuntang database
async function savePhotoOnly() {
  const recordId = document.getElementById('editingRecordId').value;
  if (!recordId) {
    alert('Pumili muna ng Senior Record bago mag-save ng litrato.');
    return;
  }

  if (!modalTempPhotoBase64 || modalTempPhotoBase64.trim().length < 50) {
    alert('Maglagay muna ng litrato bago mag-save.');
    return;
  }

  try {
    const res = await fetch('/api/commercial/senior/update-photo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: recordId,
        photo_data: modalTempPhotoBase64
      })
    });

    const result = await res.json();
    if (result.success) {
      alert(`✅ ${result.message}`);
      closePhotoViewerModal();
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (err) {
    alert('❌ Error saving photo: ' + err.message);
  }
}