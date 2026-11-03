let poolData = [];
let selectedRowId = null;
let configuredRequirements = [];

document.addEventListener('DOMContentLoaded', async () => {
  initDefaults();
  await loadRequirementsPool();
  loadDataPool();
  fetchNextAppNumber();
  setupContextMenu();
  setupKeyboardNav();
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

  const dateInput = document.getElementById('appDate');
  const timeInput = document.getElementById('appTime');
  if (dateInput) dateInput.value = `${year}-${month}-${day}`;
  if (timeInput) timeInput.value = `${hours}:${minutes}`;
}

// 🔀 Taga-kontrol kung lilitaw ang Old Name kapag CON
function handleAppTypeChange() {
  const type = document.getElementById('applicationType').value;
  const rowOldName = document.getElementById('rowOldName');
  const lblName = document.getElementById('lblApplicantName');
  const nameInput = document.getElementById('applicantName');

  if (type === 'CON') {
    rowOldName.style.display = 'grid';
    lblName.textContent = 'New Name:';
    nameInput.placeholder = 'ENTER NEW NAME';
  } else {
    rowOldName.style.display = 'none';
    lblName.textContent = 'Applicant Name:';
    nameInput.placeholder = 'Full Name';
    document.getElementById('oldApplicantName').value = '';
  }
}

// 📦 Bubunutin ang listahan mula sa REQUEST_REQUIREMENTS_CONFIG
async function loadRequirementsPool() {
  const container = document.getElementById('requirementsChecklist');
  if (!container) return;

  try {
    const res = await fetch('/api/requirements/active');
    const json = await res.json();

    if (json.success && Array.isArray(json.data)) {
      configuredRequirements = json.data;
      renderRequirementsChecklist();
    } else {
      container.innerHTML = `<span style="font-size: 0.78rem; color: var(--text-sec);">Walang aktibong requirements sa database.</span>`;
    }
  } catch (err) {
    console.error('Error fetching requirements pool:', err);
    container.innerHTML = `<span style="font-size: 0.78rem; color: var(--danger);">Failed to load requirements.</span>`;
  }
}

function renderRequirementsChecklist() {
  const container = document.getElementById('requirementsChecklist');
  if (!container) return;

  if (configuredRequirements.length === 0) {
    container.innerHTML = `<span style="font-size: 0.78rem; color: var(--text-sec);">Walang requirements.</span>`;
    return;
  }

  container.innerHTML = configuredRequirements.map(req => `
    <label style="display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; cursor: pointer; padding: 2px 0;">
      <input type="checkbox" class="req-checkbox" value="${req.REQUIREMENT_NAME}" onchange="syncRequirementsHiddenInput()" style="width: 15px; height: 15px; cursor: pointer;">
      <span>${req.REQUIREMENT_NAME}</span>
    </label>
  `).join('');
}

function syncRequirementsHiddenInput() {
  const checked = Array.from(document.querySelectorAll('.req-checkbox:checked')).map(cb => cb.value.trim());
  const hiddenInput = document.getElementById('requirementsPassed');
  if (hiddenInput) {
    hiddenInput.value = checked.join(', ');
  }
}

async function fetchNextAppNumber() {
  try {
    const res = await fetch('/api/application/next-ref');
    const data = await res.json();
    if (data.success && data.refNumber) {
      document.getElementById('appNumber').value = data.refNumber;
    }
  } catch (err) {
    console.error('Error getting next ref:', err);
  }
}

async function loadDataPool() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  try {
    const res = await fetch('/api/application/list');
    const rawData = await res.json();

    // 🔒 I-sort agad ayon sa ID (Latest to Oldest)
    poolData = (Array.isArray(rawData) ? rawData : []).sort((a, b) => Number(b.ID) - Number(a.ID));
    renderTable(poolData);
  } catch (err) {
    console.error('Error loading pool:', err);
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--danger);">Error loading data: ${err.message}</td></tr>`;
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
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-sec);">Walang tala sa Applications List.</td></tr>`;
    return;
  }

  filtered.forEach(row => {
    const tr = document.createElement('tr');
    const statusClass = getStatusClass(row.STATUS);
    const isCON = (row.APPLICATION_TYPE || '').toUpperCase() === 'CON';

    tr.innerHTML = `
      <td><strong>${row.APPLICATION_NUMBER || ''}</strong></td>
      <td>
        <span style="font-weight: 800; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: ${isCON ? '#e0e7ff; color: #4338ca;' : '#dcfce7; color: #15803d;'}">
          ${row.APPLICATION_TYPE || 'NSC'}
        </span>
      </td>
      <td>${row.APPLICANT_NAME || ''}</td>
      <td>${row.ADDRESS || ''}</td>
      <td>${row.CONTACT_NUMBER || ''}</td>
      <td>${row.ACCOUNT_REFERENCE || ''}</td>
      <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${row.REQUIREMENTS_PASSED || ''}">
        ${row.REQUIREMENTS_PASSED || '-'}
      </td>
      <td><span class="status-badge ${statusClass}">${row.STATUS || 'PENDING'}</span></td>
      <td>${row.APPLICATION_DATE || ''}</td>
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
    case 'INSPECTED': return 'st-inspected';
    case 'SEMINAR DONE': return 'st-seminar';
    case 'PAID': return 'st-paid';
    case 'NAME CHANGED': return 'st-name-changed'; // 👈 Idinagdag
    case 'REJECTED': return 'st-rejected';
    case 'TO FOLLOW': return 'st-to-follow';
    default: return 'st-pending';
  }
}

function filterDataPool(keyword) {
  const q = keyword.trim().toUpperCase();
  if (!q) return renderTable(poolData);

  const matched = poolData.filter(d =>
    Object.values(d).some(val =>
      val !== null && val !== undefined && String(val).toUpperCase().includes(q)
    )
  );
  renderTable(matched);
}

// 💾 Submit Application
async function submitApplication() {
  syncRequirementsHiddenInput();

  const editId = document.getElementById('editingRecordId')?.value;
  const appType = document.getElementById('applicationType')?.value || 'NSC';
  const newName = document.getElementById('applicantName')?.value.trim() || '';
  const oldName = document.getElementById('oldApplicantName')?.value.trim() || '';

  if (!newName) {
    alert('Pakilagay ang Applicant Name!');
    document.getElementById('applicantName')?.focus();
    return;
  }

  if (appType === 'CON' && !oldName) {
    alert('Pakilagay ang Dating Pangalan (Old Name) para sa Change of Name application.');
    document.getElementById('oldApplicantName')?.focus();
    return;
  }

  // Kapag Change of Name, ilalagay natin both names sa applicant_name column
  const finalApplicantName = (appType === 'CON' && oldName)
    ? `${newName} (OLD: ${oldName})`
    : newName;

  const payload = {
    id: editId || null,
    application_number: document.getElementById('appNumber')?.value || '',
    application_type: appType,
    applicant_name: finalApplicantName,
    address: document.getElementById('address')?.value || '',
    contact_number: document.getElementById('contactNumber')?.value || '',
    government_id: 'N/A',
    account_reference: document.getElementById('accountReference')?.value || '',
    requirements_passed: document.getElementById('requirementsPassed')?.value || '',
    status: document.getElementById('status')?.value || 'PENDING',
    application_date: document.getElementById('appDate')?.value || '',
    application_time: document.getElementById('appTime')?.value || '',
    remarks: document.getElementById('remarks')?.value || ''
  };

  const endpoint = editId ? '/api/application/update' : '/api/application/create';

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

// 🚀 Send to NSC
async function sendSelectedToNSC(id = null) {
  const targetId = id || document.getElementById('editingRecordId')?.value || selectedRowId;
  if (!targetId) {
    alert('Pumili muna ng application sa listahan bago mag-send to NSC.');
    return;
  }

  const app = poolData.find(d => d.ID === targetId);
  if (!app) return;

  const appType = (app.APPLICATION_TYPE || 'NSC').toUpperCase();
  if (appType === 'CON' || appType.includes('CHANGE OF NAME')) {
    alert(`⚠️ Hindi maaaring ipadala sa New Service Connection (NSC)!\nAng transaksyong ito ay ${app.APPLICATION_NUMBER} (CHANGE OF NAME).`);
    return;
  }

  if ((app.STATUS || '').toUpperCase() !== 'PAID') {
    alert(`⚠️ Hindi maaaring ipadala ang Application ${app.APPLICATION_NUMBER}!\nDapat 'PAID' muna ang status nito bago ipadala sa NSC.`);
    return;
  }

  if (!confirm(`Ipadala ang PAID application (${app.APPLICATION_NUMBER}) sa New Service Connections?`)) return;

  try {
    const res = await fetch('/api/application/send-to-nsc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: targetId })
    });
    const result = await res.json();

    if (result.success) {
      alert('🎉 ' + result.message);
      loadDataPool();
    } else {
      alert('❌ ' + result.error);
    }
  } catch (e) {
    alert('❌ Error: ' + e.message);
  }
}

function loadIntoForm(row) {
  document.getElementById('editingRecordId').value = row.ID;
  document.getElementById('formHeaderTitle').textContent = `Editing Application: ${row.APPLICATION_NUMBER}`;
  document.getElementById('btnCancelEdit').style.display = 'inline-block';
  document.getElementById('btnSubmitForm').innerHTML = `<i class='bx bx-check'></i> Save Edit`;

  document.getElementById('appNumber').value = row.APPLICATION_NUMBER || '';
  
  // I-load ang Application Type
  const type = row.APPLICATION_TYPE || 'NSC';
  document.getElementById('applicationType').value = type;
  handleAppTypeChange();

  // Ihiwalay ang Bagong Pangalan at Dating Pangalan kung may (OLD: ...)
  const fullName = row.APPLICANT_NAME || '';
  if (type === 'CON' && fullName.includes('(OLD:')) {
    const parts = fullName.split('(OLD:');
    document.getElementById('applicantName').value = parts[0].trim();
    document.getElementById('oldApplicantName').value = parts[1].replace(')', '').trim();
  } else {
    document.getElementById('applicantName').value = fullName;
    document.getElementById('oldApplicantName').value = '';
  }

  document.getElementById('address').value = row.ADDRESS || '';
  document.getElementById('contactNumber').value = row.CONTACT_NUMBER || '';
  document.getElementById('accountReference').value = row.ACCOUNT_REFERENCE || '';
  document.getElementById('status').value = row.STATUS || 'PENDING';
  document.getElementById('appDate').value = row.APPLICATION_DATE || '';
  document.getElementById('appTime').value = row.APPLICATION_TIME || '';
  document.getElementById('remarks').value = row.REMARKS || '';

  // Lagyan ng tsek ang requirements
  const savedReqs = (row.REQUIREMENTS_PASSED || '').split(',').map(s => s.trim().toUpperCase());
  document.querySelectorAll('.req-checkbox').forEach(cb => {
    cb.checked = savedReqs.includes(cb.value.trim().toUpperCase());
  });
  syncRequirementsHiddenInput();
}

function clearForm() {
  document.getElementById('editingRecordId').value = '';
  document.getElementById('formHeaderTitle').textContent = 'New Service Application';
  document.getElementById('btnCancelEdit').style.display = 'none';
  document.getElementById('btnSubmitForm').innerHTML = `<i class='bx bx-save'></i> Submit Application`;

  document.getElementById('applicationType').value = 'NSC';
  handleAppTypeChange();

  document.getElementById('applicantName').value = '';
  document.getElementById('oldApplicantName').value = '';
  document.getElementById('address').value = '';
  document.getElementById('contactNumber').value = '';
  document.getElementById('accountReference').value = '';
  document.getElementById('status').value = 'PENDING';
  document.getElementById('remarks').value = '';

  document.querySelectorAll('.req-checkbox').forEach(cb => { cb.checked = false; });
  const hiddenInput = document.getElementById('requirementsPassed');
  if (hiddenInput) hiddenInput.value = '';

  initDefaults();
  fetchNextAppNumber();
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

function triggerSendToNSC() {
  sendSelectedToNSC(selectedRowId);
}

function triggerView() {
  const row = poolData.find(d => d.ID === selectedRowId);
  if (row) {
    alert(`📋 APPLICATION DETAILS:\n\nApp #: ${row.APPLICATION_NUMBER}\nType: ${row.APPLICATION_TYPE || 'NSC'}\nApplicant: ${row.APPLICANT_NAME}\nAddress: ${row.ADDRESS}\nContact: ${row.CONTACT_NUMBER || 'N/A'}\nAcct Ref: ${row.ACCOUNT_REFERENCE || 'N/A'}\nRequirements: ${row.REQUIREMENTS_PASSED || 'N/A'}\nStatus: ${row.STATUS}\nDate: ${row.APPLICATION_DATE} ${row.APPLICATION_TIME}\nRemarks: ${row.REMARKS || 'N/A'}`);
  }
}

async function triggerDelete() {
  const row = poolData.find(d => d.ID === selectedRowId);
  if (!row) return;

  // 1. Initial Confirmation
  if (!confirm(`Sigurado ka bang nais mong burahin ang Application ${row.APPLICATION_NUMBER}?`)) return;

  // 2. Security Password Prompt
  const pass = prompt('🔒 SECURITY CHECK:\nIlagay ang password upang kumpirmahin ang pagbura:');
  
  if (pass === null) {
    // Kinlick ng user ang Cancel
    return;
  }

  // Tinitiyak na "KUMAKALABUKAB" o "kumakalabukab" ang tinanggap
  if (pass !== 'KUMAKALABUKAB' && pass !== 'kumakalabukab') {
    alert('❌ Mali ang password! Kanselado ang pagbura ng record.');
    return;
  }

  // 3. Pagpapatuloy sa pagbura kapag tama ang password
  try {
    const res = await fetch('/api/application/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedRowId })
    });
    const result = await res.json();
    if (result.success) {
      alert('✅ Application deleted.');
      if (document.getElementById('editingRecordId')?.value == selectedRowId) {
        clearForm();
      }
      loadDataPool();
      fetchNextAppNumber();
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (e) {
    alert('❌ Delete error: ' + e.message);
  }
}

function setupKeyboardNav() {
  const map = [
    { from: 'appNumber', to: 'applicantName' },
    { from: 'applicantName', to: 'address' },
    { from: 'address', to: 'contactNumber' },
    { from: 'contactNumber', to: 'accountReference' },
    { from: 'accountReference', to: 'status' }
  ];

  map.forEach(item => {
    const el = document.getElementById(item.from);
    if (el) {
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          document.getElementById(item.to)?.focus();
        }
      });
    }
  });
}

// 📊 Export to Excel Function
function exportApplicationsToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Hindi ma-load ang Excel library. Pakisuri ang iyong internet connection.');
    return;
  }

  // Kunin ang kasalukuyang naka-filter o buong listahan
  const filterElem = document.getElementById('statusFilter');
  const filter = filterElem ? filterElem.value : 'ALL';
  const searchVal = (document.getElementById('searchTableInput')?.value || '').trim().toUpperCase();

  let targetData = (Array.isArray(poolData) ? poolData : []).filter(d => {
    const matchesStatus = (filter === 'ALL') || ((d.STATUS || '').toUpperCase() === filter);
    if (!matchesStatus) return false;

    if (!searchVal) return true;
    return Object.values(d).some(val =>
      val !== null && val !== undefined && String(val).toUpperCase().includes(searchVal)
    );
  });

  if (targetData.length === 0) {
    alert('Walang records na mai-export batay sa kasalukuyang filter/search.');
    return;
  }

  // I-format ang columns para sa malinis na Excel sheet
  const exportRows = targetData.map(row => ({
    'Application #': row.APPLICATION_NUMBER || '',
    'Type': row.APPLICATION_TYPE || 'NSC',
    'Applicant Name': row.APPLICANT_NAME || '',
    'Address': row.ADDRESS || '',
    'Contact Number': row.CONTACT_NUMBER || '',
    'Account Reference': row.ACCOUNT_REFERENCE || '',
    'Requirements Passed': row.REQUIREMENTS_PASSED || '',
    'Status': row.STATUS || 'PENDING',
    'Application Date': row.APPLICATION_DATE || '',
    'Application Time': row.APPLICATION_TIME || '',
    'Remarks': row.REMARKS || ''
  }));

  // Gumawa ng worksheet at workbook
  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  
  // I-set ang lapad ng columns para presentable agad pagkabukas
  worksheet['!cols'] = [
    { wch: 16 }, // Application #
    { wch: 8 },  // Type
    { wch: 28 }, // Applicant Name
    { wch: 35 }, // Address
    { wch: 16 }, // Contact #
    { wch: 18 }, // Account Reference
    { wch: 30 }, // Requirements
    { wch: 16 }, // Status
    { wch: 14 }, // Date
    { wch: 10 }, // Time
    { wch: 30 }  // Remarks
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Applications');

// I-save gamit ang lokal na petsa sa filename
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  XLSX.writeFile(workbook, `Service_Applications_${filter}_${todayStr}.xlsx`);
}