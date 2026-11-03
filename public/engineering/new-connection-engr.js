// public/engineering/new-connection-engr.js
let poolData = [];
let availablePlumbers = [];
let availableMaterials = [];

document.addEventListener('DOMContentLoaded', async () => {
  initDefaults();
  await loadReferencePools();
  await loadDataPool();
});

function initDefaults() {
  // Blangko para manual na pipiliin sa date & time picker
  document.getElementById('txtInstDateTime').value = '';
}

// 📦 1. Kuhanin ang Data mula sa Plumbers at Materials Databases
async function loadReferencePools() {
  try {
    // Plumbers Pool
    const resP = await fetch('/api/plumbers/list?active=true');
    availablePlumbers = await resP.json();
    renderPlumbersChecklist(availablePlumbers);

    // Materials Pool
    const resM = await fetch('/api/materials/active');
    const jsonM = await resM.json();
    if (jsonM.success) {
      availableMaterials = (jsonM.data || []).filter(m => m.MATERIAL_NAME !== 'WALA' && m.MATERIAL_NAME !== 'MERON');
    }
  } catch (err) {
    console.error('Error loading pools:', err);
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

// 🪟 Plumber Selector Modal Handlers
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

// 🧱 Dynamic Materials Rows Handler (Add / Remove)
function addMaterialRow(matName = '', qtyVal = '') {
  const container = document.getElementById('materialsContainer');
  const rowDiv = document.createElement('div');
  rowDiv.className = 'mat-row-item';

  const optionsHtml = availableMaterials.map(m => 
    `<option value="${m.MATERIAL_NAME}" ${m.MATERIAL_NAME.toUpperCase() === matName.toUpperCase() ? 'selected' : ''}>${m.MATERIAL_NAME}</option>`
  ).join('');

  rowDiv.innerHTML = `
    <select class="mat-select">
      <option value="">-- SELECT MATERIAL --</option>
      ${optionsHtml}
    </select>
    <input type="text" class="mat-qty" placeholder="Qty" value="${qtyVal}">
    <button type="button" class="btn-remove-row" onclick="this.parentElement.remove()">✕</button>
  `;

  container.appendChild(rowDiv);
}

function getCompiledMaterialsString() {
  const rows = document.querySelectorAll('.mat-row-item');
  const compiled = [];

  rows.forEach(r => {
    const mat = r.querySelector('.mat-select').value.trim();
    const qty = r.querySelector('.mat-qty').value.trim();
    if (mat) {
      if (qty) compiled.push(`${mat} (${qty})`);
      else compiled.push(mat);
    }
  });

  return compiled.join(' | ');
}

function parseAndLoadMaterialsString(matsStr) {
  const container = document.getElementById('materialsContainer');
  container.innerHTML = '';

  if (!matsStr || !matsStr.trim()) {
    addMaterialRow();
    return;
  }

  const items = matsStr.split(' | ');
  items.forEach(item => {
    const trimmed = item.trim();
    if (trimmed.includes('(') && trimmed.endsWith(')')) {
      const matName = trimmed.substring(0, trimmed.lastIndexOf('(')).trim();
      const qtyVal = trimmed.substring(trimmed.lastIndexOf('(') + 1, trimmed.length - 1).trim();
      addMaterialRow(matName, qtyVal);
    } else {
      addMaterialRow(trimmed, '');
    }
  });
}

// 📋 Table Data Pool Loader
async function loadDataPool() {
  const statusFilter = document.getElementById('statusFilter').value;
  const tbody = document.getElementById('tableBody');
  const countLbl = document.getElementById('recordCount');

  try {
    // 💡 Laging kunin ang ALL para ma-filter nang maayos sa frontend
    const res = await fetch('/api/engr/new-connections/list?status=ALL');
    const json = await res.json();
    
    if (json.success) {
      let rawData = (json.data || []).sort((a, b) => Number(b.ID) - Number(a.ID));

      // I-map muna ang SENT TO ENGINEERING patungong PENDING
      rawData = rawData.map(row => {
        const s = (row.STATUS || 'PENDING').toUpperCase();
        if (s === 'SENT TO ENGINEERING' || s === 'SENT TO ENGR') {
          return { ...row, STATUS: 'PENDING' };
        }
        return row;
      });

      // I-filter ayon sa piniling Status sa Dropdown
      if (statusFilter !== 'ALL') {
        poolData = rawData.filter(row => (row.STATUS || '').toUpperCase() === statusFilter.toUpperCase());
      } else {
        poolData = rawData;
      }

      renderTable(poolData);
      countLbl.textContent = `${poolData.length} Records Found`;
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--danger);">Error loading data: ${err.message}</td></tr>`;
  }
}

function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-sec);">Walang tala sa New Service Connections.</td></tr>`;
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');

    let rawStatus = (row.STATUS || 'PENDING').toUpperCase();
    if (rawStatus === 'SENT TO ENGINEERING' || rawStatus === 'SENT TO ENGR') {
      rawStatus = 'PENDING';
    }

    const status = rawStatus;
    const statusClass = getStatusClass(status); // ✅ Inalis ang dobleng deklarasyon

    tr.innerHTML = `
      <td><strong style="color: var(--danger);">${row.APPLICATION_NUMBER || ''}</strong></td>
      <td><strong>${row.APPLICANT_NAME || ''}</strong></td>
      <td>${row.ADDRESS || ''}</td>
      <td>${row.CONTACT_NUMBER || ''}</td>
      <td><strong style="color: var(--success);">${row.OR_NUMBER || 'NO OR'}</strong></td>
      <td><span class="status-badge ${statusClass}">${status}</span></td>
      <td>${row.ASSIGNED_PLUMBERS || '<em>None</em>'}</td>
      <td>${row.INSTALLATION_DATE || ''}</td>
      <td>${row.INSTALLED_MATERIALS || 'None'}</td>
      <td>${row.PLUMBER_REMARKS || ''}</td>
    `;

    // 🚀 Double-click to open Clean Update Modal
    tr.addEventListener('dblclick', () => {
      openUpdateModal(row);
    });

    tbody.appendChild(tr);
  });
}

function getStatusClass(status) {
  const s = (status || '').toUpperCase();
  switch (s) {
    case 'COMPLETED':
    case 'INSTALLED':
      return 'st-completed';
    case 'PAID':
      return 'st-paid';
    case 'SENT TO ENGINEERING':
    case 'SENT TO ENGR':
    case 'PENDING':
    default:
      return 'st-pending';
  }
}

function filterDataPool(keyword) {
  const q = keyword.trim().toUpperCase();
  if (!q) return renderTable(poolData);

  const matched = poolData.filter(d => 
    (d.APPLICATION_NUMBER && d.APPLICATION_NUMBER.toUpperCase().includes(q)) ||
    (d.APPLICANT_NAME && d.APPLICANT_NAME.toUpperCase().includes(q)) ||
    (d.OR_NUMBER && d.OR_NUMBER.toUpperCase().includes(q)) ||
    (d.ADDRESS && d.ADDRESS.toUpperCase().includes(q))
  );
  renderTable(matched);
}

// 🪟 Open Clean Modal
function openUpdateModal(row) {
  document.getElementById('modalRecordId').value = row.ID || '';
  document.getElementById('lblAppNo').textContent = row.APPLICATION_NUMBER || '-';
  document.getElementById('lblOr').textContent = row.OR_NUMBER || 'NO OR';
  document.getElementById('lblName').textContent = row.APPLICANT_NAME || '-';
  document.getElementById('lblContact').textContent = row.CONTACT_NUMBER || '-';
  document.getElementById('lblGovId').textContent = row.GOVERNMENT_ID || '-';
  document.getElementById('lblAcctRef').textContent = row.ACCOUNT_REFERENCE || '-';
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

  // 1. Plumbers Display
  const pBox = document.getElementById('boxPlumbers');
  const pTxt = document.getElementById('txtSelectedPlumbers');
  if (row.ASSIGNED_PLUMBERS && row.ASSIGNED_PLUMBERS.trim()) {
    pTxt.textContent = row.ASSIGNED_PLUMBERS;
    pBox.classList.remove('placeholder');
  } else {
    pTxt.textContent = '-- PLEASE SELECT PLUMBERS --';
    pBox.classList.add('placeholder');
  }

  // 2. Date & Time Picker Handling (YYYY-MM-DDTHH:mm format)
// 2. Date & Time Picker Handling (Matibay na parser para sa datetime-local)
  const dtInput = document.getElementById('txtInstDateTime');
  if (row.INSTALLATION_DATE) {
    try {
      const parsedDate = new Date(row.INSTALLATION_DATE);
      if (!isNaN(parsedDate.getTime())) {
        // I-format nang ligtas sa local timezone: YYYY-MM-DDTHH:mm
        const pad = (n) => String(n).padStart(2, '0');
        const formatted = `${parsedDate.getFullYear()}-${pad(parsedDate.getMonth() + 1)}-${pad(parsedDate.getDate())}T${pad(parsedDate.getHours())}:${pad(parsedDate.getMinutes())}`;
        dtInput.value = formatted;
      } else {
        dtInput.value = String(row.INSTALLATION_DATE).replace(' ', 'T').substring(0, 16);
      }
    } catch (e) {
      dtInput.value = String(row.INSTALLATION_DATE).replace(' ', 'T').substring(0, 16);
    }
  } else {
    dtInput.value = '';
  }

  // 3. Materials Parse
  parseAndLoadMaterialsString(row.INSTALLED_MATERIALS || '');

  // 4. Remarks & Status
  document.getElementById('txtPlumberRemarks').value = row.PLUMBER_REMARKS || '';
  document.getElementById('selFinalStatus').value = row.STATUS || 'COMPLETED';

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
  const remarks = document.getElementById('txtPlumberRemarks').value.trim();

  // ⚠️ Validation para sa "SEND BACK TO COMMERCIAL"
  if (status === 'SEND BACK TO COMMERCIAL') {
    if (!remarks) {
      alert('⚠️ Kailangang maglagay ng dahilan sa "Engineering Remarks" kung bakit ibinabalik sa Commercial Tab ang application na ito!');
      document.getElementById('txtPlumberRemarks').focus();
      return;
    }
    if (!confirm(`Sigurado ka bang ibabalik ang application na ito sa Commercial Tab?\n\nDahilan: ${remarks}`)) {
      return;
    }
  } else if (status === 'COMPLETED' && (plumbers.startsWith('--') || !plumbers)) {
    alert('Pakilagay ang Assigned Plumbers kapag ang Status ay COMPLETED.');
    return;
  }

  // I-format ang datetime para sa database ('YYYY-MM-DD HH:mm')
  const dtVal = document.getElementById('txtInstDateTime').value.trim();
  // Kung may laman, gawing 'YYYY-MM-DD HH:mm:00'
  const fullDateTime = dtVal ? (dtVal.replace('T', ' ') + (dtVal.length === 16 ? ':00' : '')) : '';

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
    assignedPlumbers: (plumbers.startsWith('--') ? '' : plumbers),
    installationDate: fullDateTime,
    installedMaterials: getCompiledMaterialsString(),
    plumberRemarks: remarks,
    updatedBy: loggedUserName, // 👈 Diretsong ipasa ang encoder
    status: status
  };

  try {
    const res = await fetch('/api/engr/new-connections/update-action', {
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

// 🖨️ Buksan ang A6 Print Accomplishment para sa New Connection
function triggerPrintAccomplishmentModal() {
  const appNumber = document.getElementById('lblAppNo').textContent.trim();
  if (!appNumber || appNumber === '-') {
    alert('Walang aktibong Application Number na napili.');
    return;
  }

  let cleanApp = appNumber.toUpperCase();
  if (cleanApp.startsWith('APP-')) cleanApp = cleanApp.substring(4);

  const printUrl = `/api/engr/new-connections/print-accomplishment/${encodeURIComponent(cleanApp)}`;
  window.open(printUrl, '_blank');
}