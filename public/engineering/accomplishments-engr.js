// public/engineering/accomplishments-engr.js
let dataSR = [];
let dataRecon = [];
let dataNSC = [];

// Cache Tracker para hindi mag-refetch kung na-load na
const loadedTabs = {
  srTab: false,
  reconTab: false,
  nscTab: false
};

document.addEventListener('DOMContentLoaded', () => {
  populateYears();
  // Unang tab lang ang i-load sa simula
  loadTabData('srTab');
});

function populateYears() {
  const currentYear = new Date().getFullYear();
  const selYear = document.getElementById('selYear');
  for (let i = currentYear; i >= currentYear - 5; i--) {
    const opt = document.createElement('option');
    opt.value = i.toString();
    opt.textContent = i.toString();
    selYear.appendChild(opt);
  }
  selYear.value = currentYear.toString();
}

async function switchTab(tabId, element) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

  element.classList.add('active');
  document.getElementById(tabId).classList.add('active');

  // 🚀 Lazy Load: Kukunin lang ang data kapag pinindot ang tab
  if (!loadedTabs[tabId]) {
    await loadTabData(tabId);
  } else {
    filterTables(); // Instant display mula sa cache
  }
}

async function loadTabData(tabId) {
  let endpoint = '';
  let targetTbody = null;

  if (tabId === 'srTab') {
    endpoint = '/api/engr/accomplishments/service-requests';
    targetTbody = document.getElementById('bodySR');
  } else if (tabId === 'reconTab') {
    endpoint = '/api/engr/accomplishments/reconnections';
    targetTbody = document.getElementById('bodyRecon');
  } else if (tabId === 'nscTab') {
    endpoint = '/api/engr/accomplishments/new-connections';
    targetTbody = document.getElementById('bodyNSC');
  }

  if (targetTbody) {
    targetTbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--primary); padding: 18px;"><i class='bx bx-loader-alt bx-spin' style="font-size: 1.3rem;"></i> Loading records...</td></tr>`;
  }

  try {
    const res = await fetch(endpoint);
    const result = await res.json();

    if (result.success) {
      if (tabId === 'srTab') dataSR = result.data || [];
      else if (tabId === 'reconTab') dataRecon = result.data || [];
      else if (tabId === 'nscTab') dataNSC = result.data || [];

      loadedTabs[tabId] = true;
      filterTables();
    }
  } catch (err) {
    console.error(`Error loading ${tabId}:`, err);
    if (targetTbody) {
      targetTbody.innerHTML = `<tr><td colspan="12" style="text-align: center; color: var(--danger); padding: 18px;">Error loading data: ${err.message}</td></tr>`;
    }
  }
}

// Global Refresh Button: Ire-reset ang cache at kukunin ang kasalukuyang tab
async function loadAllData() {
  const activeTabId = document.querySelector('.tab-content.active').id;
  loadedTabs.srTab = false;
  loadedTabs.reconTab = false;
  loadedTabs.nscTab = false;

  await loadTabData(activeTabId);
}

function filterTables() {
  const query = document.getElementById('searchInput').value.trim().toLowerCase();
  const yearFilter = document.getElementById('selYear').value;
  const monthFilter = document.getElementById('selMonth').value;

  const matchesDate = (dateVal) => {
    if (!dateVal) return yearFilter === 'ALL' && monthFilter === 'ALL';
    const parts = dateVal.split('-');
    if (parts.length < 2) return true;

    const rYr = parts[0];
    const rMo = parts[1];

    if (yearFilter !== 'ALL' && rYr !== yearFilter) return false;
    if (monthFilter !== 'ALL' && rMo !== monthFilter) return false;
    return true;
  };

  const matchesKeyword = (obj) => {
    if (!query) return true;
    return Object.values(obj).some(val => String(val || '').toLowerCase().includes(query));
  };

  // 1. Render SR Tab
  if (loadedTabs.srTab) {
    const tbodySR = document.getElementById('bodySR');
    const filteredSR = dataSR.filter(d => matchesDate(d.COMPLETION_DATE || d.REQUEST_DATE) && matchesKeyword(d));

    if (filteredSR.length === 0) {
      tbodySR.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-sec); padding: 14px;">Walang tala sa Service Requests Accomplishments.</td></tr>`;
    } else {
      tbodySR.innerHTML = filteredSR.map(row => `
        <tr>
          <td style="font-weight: 700; color: var(--danger);">${row.REFERENCE_NUMBER}</td>
          <td style="font-weight: 700;">${row.ACCOUNT_NAME}</td>
          <td>${row.ADDRESS || ''}</td>
          <td>${row.REQUEST_DATE || ''}</td>
          <td>${row.REQUEST_DETAILS || ''}</td>
          <td>${row.ACTION_TAKEN || ''}</td>
          <td>${row.MATERIALS || ''}</td>
          <td style="font-weight: 600;">${row.COMPLETION_DATE || ''}</td>
          <td>${row.COMPLETED_BY || ''}</td>
          <td><span class="status-badge">${row.STATUS}</span></td>
        </tr>
      `).join('');
    }
  }

  // 2. Render Recon Tab
  if (loadedTabs.reconTab) {
    const tbodyRecon = document.getElementById('bodyRecon');
    const filteredRecon = dataRecon.filter(d => matchesDate(d.DATE_RECONNECTED || d.REQUEST_DATE) && matchesKeyword(d));

    if (filteredRecon.length === 0) {
      tbodyRecon.innerHTML = `<tr><td colspan="11" style="text-align: center; color: var(--text-sec); padding: 14px;">Walang tala sa Reconnection Accomplishments.</td></tr>`;
    } else {
      tbodyRecon.innerHTML = filteredRecon.map(row => `
        <tr>
          <td style="font-weight: 700; color: var(--danger);">${row.REFERENCE_NUMBER}</td>
          <td style="font-weight: 700;">${row.ACCOUNT_NAME}</td>
          <td>${row.ADDRESS || ''}</td>
          <td>${row.METER_NUMBER || ''}</td>
          <td>${row.NEW_METER_NUMBER || '-'}</td>
          <td>${row.OR_NUMBER || ''}</td>
          <td style="font-weight: 600;">${row.DATE_RECONNECTED || ''}</td>
          <td>${row.METER_STATUS || ''}</td>
          <td>${row.RECONNECTED_BY || ''}</td>
          <td>${row.PLUMBER_REMARKS || ''}</td>
          <td><span class="status-badge">${row.STATUS}</span></td>
        </tr>
      `).join('');
    }
  }

  // 3. Render NSC Tab
  if (loadedTabs.nscTab) {
    const tbodyNSC = document.getElementById('bodyNSC');
    const filteredNSC = dataNSC.filter(d => matchesDate(d.INSTALLATION_DATE || d.TRANSFER_DATE) && matchesKeyword(d));

    if (filteredNSC.length === 0) {
      tbodyNSC.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-sec); padding: 14px;">Walang tala sa New Connection Accomplishments.</td></tr>`;
    } else {
      tbodyNSC.innerHTML = filteredNSC.map(row => `
        <tr>
          <td style="font-weight: 700; color: var(--danger);">${row.APPLICATION_NUMBER}</td>
          <td style="font-weight: 700;">${row.APPLICANT_NAME}</td>
          <td>${row.ADDRESS || ''}</td>
          <td>${row.CONTACT_NUMBER || ''}</td>
          <td>${row.OR_NUMBER || ''}</td>
          <td style="font-weight: 600;">${row.INSTALLATION_DATE || ''}</td>
          <td>${row.ASSIGNED_PLUMBERS || ''}</td>
          <td>${row.INSTALLED_MATERIALS || ''}</td>
          <td>${row.PLUMBER_REMARKS || ''}</td>
          <td><span class="status-badge">${row.STATUS}</span></td>
        </tr>
      `).join('');
    }
  }
}

function exportActiveTab() {
  const activeTab = document.querySelector('.tab-content.active').id;
  let tableId, sheetName, filename;

  if (activeTab === 'srTab') {
    tableId = 'tblSR';
    sheetName = 'SR_Accomplishments';
    filename = 'Service_Requests_Accomplishments.xlsx';
  } else if (activeTab === 'reconTab') {
    tableId = 'tblRecon';
    sheetName = 'Recon_Accomplishments';
    filename = 'Reconnections_Accomplishments.xlsx';
  } else {
    tableId = 'tblNSC';
    sheetName = 'NSC_Accomplishments';
    filename = 'New_Connections_Accomplishments.xlsx';
  }

  const table = document.getElementById(tableId);
  const wb = XLSX.utils.table_to_book(table, { sheet: sheetName });
  XLSX.writeFile(wb, filename);
}