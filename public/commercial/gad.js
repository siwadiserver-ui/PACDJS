let poolData = [];
let canEditGAD = false;
let contextSelectedItem = null;
let currentRole = '';
let currentDivision = '';

// Pagination state
let currentPage = 1;
let totalPages = 1;
let totalRecords = 0;
const pageLimit = 50;
let searchDebounceTimer = null;

document.addEventListener('DOMContentLoaded', () => {
  checkUserPermissions();
  loadDataPool();
  setupContextMenu();
});

// 🔒 Permissions Check
function checkUserPermissions() {
  try {
    const userJson = sessionStorage.getItem('currentUser') || localStorage.getItem('currentUser');
    if (userJson) {
      const user = JSON.parse(userJson);
      currentRole = String(user.ROLE || user.role || '').toUpperCase().trim();
      currentDivision = String(user.DIVISION || user.division || '').toUpperCase().trim();

      const isAdmin = currentRole === 'ADMIN' || currentDivision === 'ADMIN' || currentRole === 'SUPERADMIN';
      const isCommercial = currentDivision === 'COMMERCIAL' || currentRole === 'COMMERCIAL' || (!currentRole.includes('ENGR') && !currentDivision.includes('ENGR'));

      canEditGAD = isAdmin || isCommercial;
    }
  } catch (e) {
    canEditGAD = false;
  }

  if (!canEditGAD) {
    document.querySelectorAll('#chkSenior, #chkSoloParent, #chkPwd, #chkIndigent, input[name="genderRadio"]').forEach(el => {
      el.disabled = true;
      el.style.cursor = 'not-allowed';
    });

    const badge = document.getElementById('viewOnlyBadge');
    if (badge) badge.style.display = 'inline-block';

    const actContainer = document.getElementById('formActionsContainer');
    if (actContainer) actContainer.style.display = 'none';
  }
}

let selectedZone = '';

// Handler kapag nagpalit ng Zone sa dropdown
function onZoneChange(val) {
  selectedZone = val.trim();
  currentPage = 1; // Balik pahina 1 kapag nagbago ng zone
  loadDataPool();
}

// I-update ang loadDataPool para isama ang zone
async function loadDataPool() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  const searchKeyword = (document.getElementById('searchTableInput')?.value || '').trim();

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: pageLimit,
      search: searchKeyword,
      zone: selectedZone // 👈 Pinapasa ang zone prefix (01, 02, etc.)
    });

    const res = await fetch(`/api/gad/list?${params.toString()}`);
    const json = await res.json();

    poolData = json.data || [];
    currentPage = json.page || 1;
    totalPages = json.totalPages || 1;
    totalRecords = json.totalRecords || 0;

    renderTable(poolData);
    updatePaginationUI();
  } catch (err) {
    console.error('Error loading Customer GAD data:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #ef4444;">Error loading data: ${err.message}</td></tr>`;
  }
}

// 🎨 Render Table Rows
function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;
  tbody.innerHTML = '';

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #64748b;">Walang tala sa Customer Database.</td></tr>`;
    return;
  }

  data.forEach(row => {
    const tr = document.createElement('tr');

    let tagsHtml = '';
    if (row.IS_SENIOR == 1) tagsHtml += `<span class="badge bg-senior">SENIOR</span>`;
    if (row.IS_SOLO_PARENT == 1) tagsHtml += `<span class="badge bg-solo">SOLO PARENT</span>`;
    if (row.IS_PWD == 1) tagsHtml += `<span class="badge bg-pwd">PWD</span>`;
    if (row.IS_INDIGENT == 1) tagsHtml += `<span class="badge bg-indigent">INDIGENT</span>`;
    if (!tagsHtml) tagsHtml = '<span style="color: #94a3b8; font-size: 0.75rem;">None</span>';

    const genderHtml = row.GENDER 
      ? `<span class="badge bg-gender">${row.GENDER}</span>` 
      : '<span style="color: #94a3b8; font-size: 0.75rem;">Not Set</span>';

    const tdAccNo = document.createElement('td');
    tdAccNo.innerHTML = `<strong>${escapeHtml(row.ACCOUNT_NUMBER || '')}</strong>`;

    const tdName = document.createElement('td');
    tdName.innerHTML = `<strong>${escapeHtml(row.ACCOUNT_NAME || '')}</strong>`;

    const tdGender = document.createElement('td');
    tdGender.innerHTML = genderHtml;

    const tdTags = document.createElement('td');
    tdTags.innerHTML = tagsHtml;

    const tdAddress = document.createElement('td');
    tdAddress.textContent = row.ADDRESS || '';

    tr.appendChild(tdAccNo);
    tr.appendChild(tdName);
    tr.appendChild(tdGender);
    tr.appendChild(tdTags);
    tr.appendChild(tdAddress);

    tr.addEventListener('click', () => loadIntoForm(row));
    tr.addEventListener('dblclick', () => loadIntoForm(row));

    tr.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      contextSelectedItem = row;
      showContextMenu(e.clientX, e.clientY);
    });

    tbody.appendChild(tr);
  });
}

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 🧭 Pagination Control Handlers
function updatePaginationUI() {
  const info = document.getElementById('pageInfoText');
  const btnPrev = document.getElementById('btnPrevPage');
  const btnNext = document.getElementById('btnNextPage');
  const zoneSelect = document.getElementById('zoneFilterSelect');
  const zoneLabel = zoneSelect && zoneSelect.value ? `[Zone ${parseInt(zoneSelect.value, 10)}] ` : '';

  if (info) {
    info.textContent = `${zoneLabel}Pahina ${currentPage} ng ${totalPages} (${totalRecords.toLocaleString()} kabuuang konsyumer)`;
  }

  if (btnPrev) {
    btnPrev.disabled = (currentPage <= 1);
    btnPrev.style.opacity = (currentPage <= 1) ? '0.5' : '1';
  }

  if (btnNext) {
    btnNext.disabled = (currentPage >= totalPages);
    btnNext.style.opacity = (currentPage >= totalPages) ? '0.5' : '1';
  }
}

function goToPrevPage() {
  if (currentPage > 1) {
    currentPage--;
    loadDataPool();
  }
}

function goToNextPage() {
  if (currentPage < totalPages) {
    currentPage++;
    loadDataPool();
  }
}

// 🔍 Live Search na may 350ms debounce
function filterDataPool() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(() => {
    currentPage = 1; // Ibalik sa pahina 1 kapag may bagong hinahanap
    loadDataPool();
  }, 350);
}

// 📝 Form Handling
function loadIntoForm(row) {
  document.getElementById('selectedCustomerId').value = row.ID;
  document.getElementById('dispAccountNo').textContent = row.ACCOUNT_NUMBER || '-';
  document.getElementById('dispName').textContent = row.ACCOUNT_NAME || '-';
  document.getElementById('dispAddress').textContent = row.ADDRESS || '-';

  document.getElementById('chkSenior').checked = (row.IS_SENIOR == 1);
  document.getElementById('chkSoloParent').checked = (row.IS_SOLO_PARENT == 1);
  document.getElementById('chkPwd').checked = (row.IS_PWD == 1);
  document.getElementById('chkIndigent').checked = (row.IS_INDIGENT == 1);

  const currentGender = (row.GENDER || '').toUpperCase();
  const radio = document.querySelector(`input[name="genderRadio"][value="${currentGender}"]`);
  if (radio) radio.checked = true;
  else document.querySelectorAll('input[name="genderRadio"]').forEach(r => r.checked = false);
}

function clearForm() {
  document.getElementById('selectedCustomerId').value = '';
  document.getElementById('dispAccountNo').textContent = '-';
  document.getElementById('dispName').textContent = 'Pumili ng konsyumer sa table';
  document.getElementById('dispAddress').textContent = '-';

  document.getElementById('chkSenior').checked = false;
  document.getElementById('chkSoloParent').checked = false;
  document.getElementById('chkPwd').checked = false;
  document.getElementById('chkIndigent').checked = false;

  document.querySelectorAll('input[name="genderRadio"]').forEach(r => r.checked = false);
}

// 💾 Save GAD Data
async function saveGadData() {
  if (!canEditGAD) return alert('⚠️ Wala kang pahintulot na mag-edit ng GAD data.');

  const account_number = document.getElementById('dispAccountNo').textContent.trim();
  if (!account_number || account_number === '-') {
    return alert('Pumili muna ng konsyumer mula sa listahan sa kanan!');
  }

  const payload = {
    account_number,
    is_senior: document.getElementById('chkSenior').checked ? 1 : 0,
    is_solo_parent: document.getElementById('chkSoloParent').checked ? 1 : 0,
    is_pwd: document.getElementById('chkPwd').checked ? 1 : 0,
    is_indigent: document.getElementById('chkIndigent').checked ? 1 : 0,
    gender: document.querySelector('input[name="genderRadio"]:checked')?.value || null,
    user_role: currentRole,
    user_division: currentDivision
  };

  try {
    const res = await fetch('/api/gad/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();

    if (result.success) {
      alert('✅ ' + result.message);
      await loadDataPool();
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

// 🧹 Reset Tags
async function resetGadTags(targetAccNo = null) {
  if (!canEditGAD) return alert('⚠️ Bawal magbago ang user na ito.');
  const account_number = targetAccNo || document.getElementById('dispAccountNo').textContent.trim();
  if (!account_number || account_number === '-') return alert('Pumili muna ng record.');

  if (!confirm(`Nais mo bang alisin ang lahat ng GAD sector tags para sa Account [${account_number}]?`)) return;

  try {
    const res = await fetch('/api/gad/reset-tag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_number, user_role: currentRole, user_division: currentDivision })
    });
    const result = await res.json();
    if (result.success) {
      alert('🧹 ' + result.message);
      clearForm();
      await loadDataPool();
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

// 🖱️ Context Menu
function setupContextMenu() {
  const menu = document.getElementById('customContextMenu');
  document.addEventListener('click', () => { if (menu) menu.style.display = 'none'; });
}

function showContextMenu(x, y) {
  if (!canEditGAD) return;
  const menu = document.getElementById('customContextMenu');
  if (!menu) return;
  menu.style.left = `${x}px`;
  menu.style.top = `${y}px`;
  menu.style.display = 'flex';
}

function triggerEditFromContext() {
  if (contextSelectedItem) loadIntoForm(contextSelectedItem);
}

function triggerResetTagsFromContext() {
  if (contextSelectedItem) resetGadTags(contextSelectedItem.ACCOUNT_NUMBER);
}

// 📊 Export to Excel
function exportGadToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Hindi ma-load ang Excel library.');
    return;
  }

  if (!poolData || poolData.length === 0) {
    alert('Walang tala sa kasalukuyang view na mai-export.');
    return;
  }

  const exportRows = poolData.map(row => {
    const sectors = [];
    if (row.IS_SENIOR == 1) sectors.push('SENIOR');
    if (row.IS_SOLO_PARENT == 1) sectors.push('SOLO PARENT');
    if (row.IS_PWD == 1) sectors.push('PWD');
    if (row.IS_INDIGENT == 1) sectors.push('INDIGENT');

    return {
      'Account #': row.ACCOUNT_NUMBER || '',
      'Account Name': row.ACCOUNT_NAME || '',
      'Sex / Gender': row.GENDER || 'NOT SET',
      'Special Sectors': sectors.length > 0 ? sectors.join(', ') : 'NONE',
      'Senior Citizen': row.IS_SENIOR == 1 ? 'YES' : 'NO',
      'Solo Parent': row.IS_SOLO_PARENT == 1 ? 'YES' : 'NO',
      'PWD': row.IS_PWD == 1 ? 'YES' : 'NO',
      'Indigent': row.IS_INDIGENT == 1 ? 'YES' : 'NO',
      'Address': row.ADDRESS || ''
    };
  });

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Customer GAD View');
  XLSX.writeFile(workbook, `Customer_GAD_Page_${currentPage}.xlsx`);
}

let genderChartInstance = null;
let sectorsChartInstance = null;

async function openGadSummaryModal() {
  const modal = document.getElementById('gadSummaryModal');
  const scopeLabel = document.getElementById('sumScopeLabel');
  if (!modal) return;

  modal.style.display = 'flex';
  const currentZone = (selectedZone || '').trim();
  scopeLabel.textContent = currentZone ? `Saklaw: Zone ${parseInt(currentZone, 10)}` : 'Saklaw: Buong Konsyumer (Lahat ng Zone)';

  try {
    const res = await fetch(`/api/gad/summary?zone=${encodeURIComponent(currentZone)}`);
    const data = await res.json();

    if (data.error) throw new Error(data.error);

    // 1. I-populate ang KPI Cards
    document.getElementById('statTotal').textContent = Number(data.total || 0).toLocaleString();
    document.getElementById('statMale').textContent = Number(data.gender?.male || 0).toLocaleString();
    document.getElementById('statFemale').textContent = Number(data.gender?.female || 0).toLocaleString();
    document.getElementById('statOthers').textContent = Number((data.gender?.others || 0) + (data.gender?.untagged || 0)).toLocaleString();

    // 2. Tiyaking buhay ang Chart.js bago mag-render ng visual graphs
    if (typeof Chart === 'undefined') {
      console.warn('⚠️ Chart.js library not found. Sinusubukang i-load dynamically...');
      return;
    }

    // 3. Render Gender Doughnut Chart
    const canvasGender = document.getElementById('gadGenderDonutChart');
    if (canvasGender) {
      const ctxGender = canvasGender.getContext('2d');
      if (genderChartInstance) genderChartInstance.destroy();
      genderChartInstance = new Chart(ctxGender, {
        type: 'doughnut',
        data: {
          labels: ['Male', 'Female', 'Others', 'Hindi Pa Na-tag'],
          datasets: [{
            data: [
              data.gender.male || 0,
              data.gender.female || 0,
              data.gender.others || 0,
              data.gender.untagged || 0
            ],
            backgroundColor: ['#2563eb', '#d946ef', '#64748b', '#cbd5e1'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10, weight: '700' } } }
          }
        }
      });
    }

    // 4. Render Special Sectors Bar Chart
    const canvasSectors = document.getElementById('gadSectorsBarChart');
    if (canvasSectors) {
      const ctxSectors = canvasSectors.getContext('2d');
      if (sectorsChartInstance) sectorsChartInstance.destroy();
      sectorsChartInstance = new Chart(ctxSectors, {
        type: 'bar',
        data: {
          labels: ['Senior', 'Solo Parent', 'PWD', 'Indigent'],
          datasets: [{
            data: [
              data.sectors.senior || 0,
              data.sectors.soloParent || 0,
              data.sectors.pwd || 0,
              data.sectors.indigent || 0
            ],
            backgroundColor: ['#eab308', '#f97316', '#a855f7', '#ef4444'],
            borderRadius: 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
            x: { ticks: { font: { size: 10, weight: '700' } } }
          }
        }
      });
    }

  } catch (err) {
    console.error('❌ Error loading GAD summary:', err);
    alert('Hindi makuha ang buod ng estadistika: ' + err.message);
  }
}

function closeGadSummaryModal() {
  const modal = document.getElementById('gadSummaryModal');
  if (modal) modal.style.display = 'none';
}

// 🔄 Trigger Sync mula sa Senior Citizen Module
async function triggerSyncSeniorsToGAD() {
  if (!canEditGAD) {
    return alert('⚠️ Wala kang pahintulot na mag-edit o mag-sync ng GAD data.');
  }

  const ok = confirm('Nais mo bang i-scan ang lahat ng talaan sa Senior Citizen Module at awtomatikong i-tag bilang "SENIOR" sa GAD?');
  if (!ok) return;

  try {
    const res = await fetch('/api/gad/sync-seniors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_role: currentRole,
        user_division: currentDivision
      })
    });

    const data = await res.json();

    if (data.success) {
      alert(`✅ ${data.message}`);
      await loadDataPool(); // I-refresh ang master table
    } else {
      alert(`❌ Error: ${data.error || 'Hindi natapos ang sync.'}`);
    }
  } catch (err) {
    console.error('❌ Sync error:', err);
    alert('❌ May problema sa pagkonekta sa server habang nagsu-sync.');
  }
}

let allSeniorsData = [];

// 🧓 Buksan ang Masterlist ng Senior Citizens
async function openAllSeniorsView() {
  const modal = document.getElementById('seniorsListModal');
  const tbody = document.getElementById('seniorsTableBody');
  const scopeLabel = document.getElementById('seniorsScopeLabel');
  const countBadge = document.getElementById('seniorsCountBadge');
  if (!modal || !tbody) return;

  modal.style.display = 'flex';
  const currentZone = (selectedZone || '').trim();
  scopeLabel.textContent = currentZone ? `Saklaw: Zone ${parseInt(currentZone, 10)}` : 'Saklaw: Buong Water District (Lahat ng Zone)';
  tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #64748b;"><i class='bx bx-loader-alt bx-spin' style='font-size:1.5rem;'></i><br>Kinukuha ang talaan ng mga Senior Citizens...</td></tr>`;

  try {
    const res = await fetch(`/api/gad/seniors/all?zone=${encodeURIComponent(currentZone)}`);
    const json = await res.json();

    if (!json.success) throw new Error(json.error);

    allSeniorsData = json.data || [];
    countBadge.textContent = `${allSeniorsData.length.toLocaleString()} Senior Citizens`;

    if (allSeniorsData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #94a3b8;">Walang natagpuang Senior Citizen sa napiling saklaw.</td></tr>`;
      return;
    }

    tbody.innerHTML = allSeniorsData.map((row, idx) => {
      let otherTags = [];
      if (row.IS_PWD == 1) otherTags.push('<span class="badge bg-pwd">PWD</span>');
      if (row.IS_SOLO_PARENT == 1) otherTags.push('<span class="badge bg-solo">SOLO</span>');
      if (row.IS_INDIGENT == 1) otherTags.push('<span class="badge bg-indigent">INDIGENT</span>');
      const otherTagsHtml = otherTags.length > 0 ? otherTags.join(' ') : '<span style="color:#94a3b8; font-size:0.75rem;">None</span>';

      const genderBadge = row.GENDER 
        ? `<span class="badge bg-gender">${row.GENDER}</span>` 
        : '<span style="color:#94a3b8; font-size:0.75rem;">Not Set</span>';

      return `
        <tr>
          <td style="color:#64748b; font-weight:700;">${idx + 1}</td>
          <td><strong>${escapeHtml(row.ACCOUNT_NUMBER || '')}</strong></td>
          <td><strong>${escapeHtml(row.ACCOUNT_NAME || '')}</strong></td>
          <td>${genderBadge}</td>
          <td>${otherTagsHtml}</td>
          <td>${escapeHtml(row.ADDRESS || '')}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error('Error fetching seniors list:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 2rem; color: #ef4444;">Error: ${err.message}</td></tr>`;
  }
}

function closeAllSeniorsView() {
  const modal = document.getElementById('seniorsListModal');
  if (modal) modal.style.display = 'none';
}

// 📥 I-export sa Excel ang Talaan ng Senior Citizens
function exportSeniorsToExcel() {
  if (typeof XLSX === 'undefined') {
    alert('Hindi ma-load ang Excel library.');
    return;
  }

  if (!allSeniorsData || allSeniorsData.length === 0) {
    alert('Walang tala ng Senior Citizens na mai-export.');
    return;
  }

  const exportRows = allSeniorsData.map((row, idx) => ({
    'No.': idx + 1,
    'Account #': row.ACCOUNT_NUMBER || '',
    'Account Name': row.ACCOUNT_NAME || '',
    'Kasarian': row.GENDER || 'NOT SET',
    'Senior Citizen': 'YES',
    'PWD': row.IS_PWD == 1 ? 'YES' : 'NO',
    'Solo Parent': row.IS_SOLO_PARENT == 1 ? 'YES' : 'NO',
    'Indigent': row.IS_INDIGENT == 1 ? 'YES' : 'NO',
    'Address': row.ADDRESS || ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportRows);
  worksheet['!cols'] = [
    { wch: 6 },
    { wch: 18 },
    { wch: 30 },
    { wch: 14 },
    { wch: 15 },
    { wch: 10 },
    { wch: 12 },
    { wch: 12 },
    { wch: 35 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Senior Citizens');
  const zoneTag = selectedZone ? `Zone_${selectedZone}` : 'All_Zones';
  const todayStr = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `Senior_Citizens_${zoneTag}_${todayStr}.xlsx`);
}
