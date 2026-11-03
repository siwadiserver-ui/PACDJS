/**
 * Universal Excel Upload Modal & Engine for PACD Portal
 */

// 1. CSS Styles para sa Modal
const excelModalStyles = document.createElement('style');
excelModalStyles.innerHTML = `
  .excel-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 9999;
  }
  .excel-modal-card {
    background: #ffffff;
    width: 540px;
    max-width: 95%;
    border-radius: 10px;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.25);
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .excel-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #e4e6eb;
    padding-bottom: 10px;
  }
  .excel-modal-header h3 {
    font-size: 1.2rem;
    font-weight: 700;
    color: #1c1e21;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
  }
  .btn-em-close {
    background: #e4e6eb;
    border: none;
    border-radius: 50%;
    width: 32px;
    height: 32px;
    cursor: pointer;
    font-weight: bold;
    font-size: 1.1rem;
    color: #606770;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .btn-em-close:hover { background: #d8dadf; }
  
  .excel-status-box {
    background: #f0f2f5;
    border: 1px solid #ccd0d5;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 0.85rem;
    font-weight: 600;
  }
  
  .btn-choose-excel {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    background: #00a859;
    color: #ffffff;
    padding: 12px 20px;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    text-align: center;
    transition: background 0.2s;
  }
  .btn-choose-excel:hover { background: #008f4c; }
  
  .excel-preview-box {
    border: 1px solid #e4e6eb;
    border-radius: 6px;
    background: #fafbfc;
    max-height: 180px;
    overflow-y: auto;
  }
  .excel-preview-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.78rem;
    text-align: left;
  }
  .excel-preview-table th {
    position: sticky;
    top: 0;
    background: #ebedf0;
    padding: 6px 8px;
    border-bottom: 1px solid #ccd0d5;
    color: #4b4f56;
  }
  .excel-preview-table td {
    padding: 5px 8px;
    border-bottom: 1px solid #e4e6eb;
    white-space: nowrap;
  }
  
  .excel-modal-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-top: 8px;
    border-top: 1px solid #e4e6eb;
  }
  .btn-clear-db {
    background: #fff;
    border: 1px solid #fa383e;
    color: #fa383e;
    padding: 6px 12px;
    border-radius: 4px;
    font-size: 0.82rem;
    font-weight: 600;
    cursor: pointer;
  }
  .btn-clear-db:hover { background: #ffebe8; }
`;
document.head.appendChild(excelModalStyles);

// 2. HTML Modal Structure
function initExcelModal() {
  if (document.getElementById('universalExcelModal')) return;
  
  const modalHTML = `
    <div id="universalExcelModal" class="excel-modal-overlay" style="display: none;">
      <div class="excel-modal-card">
        <div class="excel-modal-header">
          <h3><i class='bx bx-file'></i> Upload Client Masterlist</h3>
          <button type="button" class="btn-em-close" onclick="closeExcelDialog()">&times;</button>
        </div>

        <div class="excel-status-box" id="emStatusText">
          Checking database masterlist...
        </div>

        <input type="file" id="emFileInput" accept=".xlsx, .xls" style="display: none;" onchange="handleExcelUploadEvent(event)">
        <label for="emFileInput" class="btn-choose-excel">
          <i class='bx bx-upload'></i> CHOOSE EXCEL FILE (.XLSX)
        </label>

        <div style="font-size: 0.8rem; font-weight: 700; color: #606770; margin-top: 4px;">
          Data Preview (Top 10 Records):
        </div>

        <div class="excel-preview-box">
          <table class="excel-preview-table">
            <thead>
              <tr>
                <th>Account No.</th>
                <th>Name</th>
                <th>Address</th>
                <th>Meter No.</th>
              </tr>
            </thead>
            <tbody id="emPreviewBody">
              <tr><td colspan="4" style="text-align: center; color: #8d949e;">No records loaded.</td></tr>
            </tbody>
          </table>
        </div>

        <div class="excel-modal-actions">
          <button type="button" class="btn-clear-db" onclick="clearConcessionaireMasterlist()">
            <i class='bx bx-trash'></i> Clear Masterlist
          </button>
          <button type="button" class="btn-action-card btn-blue" onclick="closeExcelDialog()" style="width: auto; padding: 6px 16px;">
            Close
          </button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modalHTML);
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', initExcelModal);
} else {
  initExcelModal();
}

// 3. Global Window Functions
window.openExcelUpload = async function() {
  initExcelModal();
  const modal = document.getElementById('universalExcelModal');
  if (modal) {
    modal.style.display = 'flex';
    await refreshExcelModalStatus();
  }
};

window.closeExcelDialog = function() {
  const modal = document.getElementById('universalExcelModal');
  if (modal) modal.style.display = 'none';
};

window.refreshExcelModalStatus = async function() {
  const statusEl = document.getElementById('emStatusText');
  const tbody = document.getElementById('emPreviewBody');

  try {
    const res = await fetch('/api/commercial/excel/status');
    const data = await res.json();

    if (data.success) {
      statusEl.innerHTML = `<span style="color: #00a400;">✅ Active Masterlist: ${Number(data.totalRecords).toLocaleString()} Concessionaires</span>`;

      if (data.preview && data.preview.length > 0) {
        tbody.innerHTML = data.preview.map(row => `
          <tr>
            <td style="font-weight: 600;">${row.ACCOUNT_NUMBER || ''}</td>
            <td>${row.ACCOUNT_NAME || ''}</td>
            <td>${row.ADDRESS || ''}</td>
            <td>${row.METER_NUMBER || 'NO METER'}</td>
          </tr>
        `).join('');
      } else {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #8d949e;">Walang records sa database. Paki-upload ang Excel file.</td></tr>`;
      }
    }
  } catch (err) {
    statusEl.innerHTML = `<span style="color: #fa383e;">❌ Error fetching status: ${err.message}</span>`;
  }
};

window.handleExcelUploadEvent = async function(e) {
  const file = e.target.files[0];
  if (!file) return;

  const statusEl = document.getElementById('emStatusText');
  statusEl.innerHTML = `<span style="color: #1877f2;">⏳ Binabasa at ipinapasok ang ${file.name}... Pakihintay.</span>`;

  const formData = new FormData();
  formData.append('excelFile', file);

  try {
    const res = await fetch('/api/commercial/excel/upload', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      alert(`✅ ${data.message}`);
      await refreshExcelModalStatus();
    } else {
      alert(`❌ Upload Error: ${data.message}`);
      await refreshExcelModalStatus();
    }
  } catch (err) {
    alert('Server/Network Error: ' + err.message);
    await refreshExcelModalStatus();
  } finally {
    e.target.value = '';
  }
};

window.clearConcessionaireMasterlist = async function() {
  if (!confirm('⚠️ Babala: Nais mo bang burahin ang buong Concessionaire Database? Mawawala ang auto-fill hangga\'t walang bagong Excel na nai-upload.')) {
    return;
  }

  try {
    const res = await fetch('/api/commercial/excel/clear', { method: 'POST' });
    const data = await res.json();
    alert(data.message);
    await refreshExcelModalStatus();
  } catch (err) {
    alert('Error: ' + err.message);
  }
};