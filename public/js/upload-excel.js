window.UploadExcelModule = {
  rawWorkbook: null,
  rawDataRows: [],
  availableColumns: [],
  requiredHeaders: ['Account No.', 'Name', 'Address', 'No.', 'BALANCE', 'AROBALANCE', 'Status'],
  
  // Eksaktong patterns mula sa Python script
  patterns: {
    'Account No.': ['account', 'acc', 'acct', 'account no', 'account number'],
    'Name': ['name', 'customer', 'client', 'subscriber'],
    'Address': ['address', 'addr', 'location'],
    'No.': ['no', 'number', 'id', 'identifier'],
    'BALANCE': ['balance', 'bal', 'current balance', 'amount'],
    'AROBALANCE': ['arobalance', 'aro', 'arrears', 'outstanding'],
    'Status': ['status', 'stat', 'condition', 'state']
  },

  // Helper para sa ligtas na HTML ID
  getFieldId: function(header) {
    return 'map_' + header.toLowerCase().replace(/[^a-z0-9]/g, '_');
  },

  // 1. Init Lifecycle
  init: async function () {
    this.setupSubTabs();
    this.setupDateDropdowns();
    await this.loadZoneConfig();
    this.renderMappingRows();
    this.setupEvents();
    this.attachAutoSaveListeners();
  },

  // 2. Sub-tab Navigation (Due Dates / Reading Dates / Discon Dates)
  setupSubTabs: function () {
    document.querySelectorAll('.sub-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sub-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.zone-grid-pane').forEach(p => p.classList.remove('active'));
        btn.classList.add('active');
        const targetPane = document.getElementById(btn.getAttribute('data-pane'));
        if (targetPane) targetPane.classList.add('active');
      });
    });
  },

// 3. Dropdown Generation (Months & Days)
  setupDateDropdowns: function () {
    const months = [];
    const now = new Date();
    for (let i = -12; i <= 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      months.push(d.toLocaleString('en-US', { month: 'long', year: 'numeric' }));
    }
    const days = Array.from({ length: 31 }, (_, i) => String(i + 1));
    const currentMonthYear = now.toLocaleString('en-US', { month: 'long', year: 'numeric' });

    const populate = (containerId, type, defDay) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.innerHTML = '';
      for (let z = 1; z <= 9; z++) {
        const item = document.createElement('div');
        item.className = 'zone-card-item';
        item.innerHTML = `
          <label class="zone-lbl">Zone ${z}:</label>
          <select id="${type}-m-${z}" class="zone-input" style="flex: 1; min-width: 140px; padding: 6px 8px; font-size: 0.85rem;">
            ${months.map(m => `<option value="${m}" ${m === currentMonthYear ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
          <select id="${type}-d-${z}" class="zone-input" style="width: 75px; flex-shrink: 0; padding: 6px 4px 6px 8px; font-size: 0.85rem; text-align: center;">
            ${days.map(d => `<option value="${d}" ${d === defDay ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        `;
        container.appendChild(item);
      }
    };

    populate('dueDatesGrid', 'due', '15');
    populate('readingDatesGrid', 'reading', '25');
    populate('disconDatesGrid', 'discon', '10');
  },

  // 4. Persistence: Load mula sa zone_config.json
  loadZoneConfig: async function () {
    try {
      const res = await fetch('/api/zone-config');
      const config = await res.json();
      if (!config || Object.keys(config).length === 0) return;

      for (let z = 1; z <= 9; z++) {
        const zoneKey = `zone_${z}`;
        if (config[zoneKey]) {
          const { due_date, reading_date, discon_date } = config[zoneKey];

          if (due_date) {
            const dueM = document.getElementById(`due-m-${z}`);
            const dueD = document.getElementById(`due-d-${z}`);
            if (dueM && due_date.month) dueM.value = due_date.month;
            if (dueD && due_date.day) dueD.value = due_date.day;
          }

          if (reading_date) {
            const readM = document.getElementById(`reading-m-${z}`);
            const readD = document.getElementById(`reading-d-${z}`);
            if (readM && reading_date.month) readM.value = reading_date.month;
            if (readD && reading_date.day) readD.value = reading_date.day;
          }

          if (discon_date) {
            const discM = document.getElementById(`discon-m-${z}`);
            const discD = document.getElementById(`discon-d-${z}`);
            if (discM && discon_date.month) discM.value = discon_date.month;
            if (discD && discon_date.day) discD.value = discon_date.day;
          }
        }
      }
    } catch (e) {
      console.warn("Hindi ma-load ang zone config:", e);
    }
  },

  // 5. Persistence: Save pabalik sa zone_config.json
  saveZoneConfig: async function () {
    const config = {};
    for (let z = 1; z <= 9; z++) {
      config[`zone_${z}`] = {
        due_date: {
          month: document.getElementById(`due-m-${z}`)?.value || '',
          day: document.getElementById(`due-d-${z}`)?.value || '15'
        },
        reading_date: {
          month: document.getElementById(`reading-m-${z}`)?.value || '',
          day: document.getElementById(`reading-d-${z}`)?.value || '25'
        },
        discon_date: {
          month: document.getElementById(`discon-m-${z}`)?.value || '',
          day: document.getElementById(`discon-d-${z}`)?.value || '10'
        }
      };
    }

    try {
      await fetch('/api/zone-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      });
    } catch (e) {
      console.error("Hindi ma-save ang zone config:", e);
    }
  },

  // 6. Auto-save triggers
  attachAutoSaveListeners: function () {
    document.querySelectorAll('.zone-input').forEach(elem => {
      elem.addEventListener('change', () => this.saveZoneConfig());
    });
  },

  // 7. Render Mapping Select Elements
  renderMappingRows: function () {
    const container = document.getElementById('mappingContainer');
    if (!container) return;
    container.innerHTML = '';
    
    this.requiredHeaders.forEach(header => {
      const fieldId = this.getFieldId(header);
      const box = document.createElement('div');
      box.className = 'mapping-field-box';
      box.innerHTML = `
        <label>${header}:</label>
        <select id="${fieldId}">
          <option value="">(None)</option>
          ${this.availableColumns.map(c => `<option value="${c}">${c}</option>`).join('')}
        </select>
      `;
      container.appendChild(box);
    });
  },

  // 8. Event Handlers (Load File, Drag/Drop)
  setupEvents: function () {
    const fileInput = document.getElementById('fileInput');
    const btnBrowse = document.getElementById('btnBrowse');
    const dropArea = document.getElementById('dropArea');
    const btnProcess = document.getElementById('btnProcessData');
    const btnExport = document.getElementById('btnExportExcel');

    if (btnBrowse && fileInput) {
      btnBrowse.addEventListener('click', () => fileInput.click());
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.handleIncomingFile(e.target.files[0]);
        }
      });
    }

    if (dropArea) {
      ['dragenter', 'dragover'].forEach(name => {
        dropArea.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropArea.classList.add('dragover');
        });
      });

      ['dragleave', 'drop'].forEach(name => {
        dropArea.addEventListener(name, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropArea.classList.remove('dragover');
        });
      });

      dropArea.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files[0]) {
          this.handleIncomingFile(dt.files[0]);
        }
      });
    }

    if (btnProcess) btnProcess.addEventListener('click', () => this.processData());
    if (btnExport) btnExport.addEventListener('click', () => this.exportExcel());
    
    // ⚡ DIRECT TO SUPABASE BUTTON
    const btnDirect = document.getElementById('btnDirectToSupabase');
    if (btnDirect) {
      btnDirect.addEventListener('click', () => this.directToSupabase());
    }


  },

  // 9. Load File - Eksaktong katumbas ng pd.read_excel(skiprows=1) sa Python
  handleIncomingFile: function (file) {
    const fileNameElem = document.getElementById('fileName');
    if (fileNameElem) fileNameElem.textContent = `${file.name} (Loading...)`;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        this.rawWorkbook = XLSX.read(data, { type: 'array' });
        const sheetName = this.rawWorkbook.SheetNames[0];
        const sheet = this.rawWorkbook.Sheets[sheetName];

        // AUTO-SKIP FIRST ROW (Katumbas ng skiprows=1)
        const rawJson = XLSX.utils.sheet_to_json(sheet, { header: 1, range: 1, defval: '' });
        if (rawJson.length < 2) {
          alert("Walang sapat na data sa napiling Excel file.");
          return;
        }

        // Kunin ang Available Columns (Headers mula sa 2nd row ng original Excel)
        this.availableColumns = rawJson[0].map(c => String(c).trim()).filter(c => c !== '');
        this.rawDataRows = rawJson.slice(1);

        this.renderMappingRows();
        this.autoDetectColumns(); // Patakbuhin ang eksaktong auto-detect logic

        const btnProcess = document.getElementById('btnProcessData');
        if (btnProcess) btnProcess.disabled = false;

        if (fileNameElem) fileNameElem.textContent = `${file.name} (first row auto-skipped, ${this.rawDataRows.length} records)`;
        if (window.AppState && window.AppState.showStatus) {
          window.AppState.showStatus(`✅ File loaded: ${this.rawDataRows.length} records, ${this.availableColumns.length} columns`, 'info');
        }
      } catch (err) {
        console.error("File parse error:", err);
        alert("Error sa pagbasa ng Excel file: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
  },

  // 10. Auto-detect Logic - 1:1 Translation mula sa Python auto_detect_columns()
  autoDetectColumns: function () {
    if (!this.availableColumns || this.availableColumns.length === 0) return;

    const columnMappings = {};
    const availableColsLower = this.availableColumns.map(col => String(col).toLowerCase());

    for (const [targetHeader, patternsList] of Object.entries(this.patterns)) {
      let found = false;
      for (const pattern of patternsList) {
        for (let i = 0; i < availableColsLower.length; i++) {
          const col = availableColsLower[i];
          if (col.includes(pattern)) {
            columnMappings[targetHeader] = this.availableColumns[i];
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    // Apply auto-detected mappings
    for (const header of this.requiredHeaders) {
      const fieldId = this.getFieldId(header);
      const select = document.getElementById(fieldId);
      if (select && columnMappings[header]) {
        select.value = columnMappings[header];
      }
    }

    // SPECIAL CASE SA PYTHON: Always prioritize exact match for "No."
    if (this.availableColumns.includes('No.')) {
      const noSelect = document.getElementById(this.getFieldId('No.'));
      if (noSelect) noSelect.value = 'No.';
    }
  },

  // 11. Parse Date mula sa UI (1:1 sa Python parse_date_from_ui)
  parseDateFromUi: function (type, zoneNum) {
    try {
      const mSelect = document.getElementById(`${type}-m-${zoneNum}`);
      const dSelect = document.getElementById(`${type}-d-${zoneNum}`);
      if (!mSelect || !dSelect) return '';

      const monthSelection = mSelect.value.trim();
      const daySelection = dSelect.value.trim();
      if (!monthSelection || !daySelection) return '';

      const parts = monthSelection.split(' ');
      if (parts.length !== 2) return '';

      const monthName = parts[0];
      const year = parseInt(parts[1], 10);
      const day = parseInt(daySelection, 10);

      const monthDict = {
        'January': 1, 'February': 2, 'March': 3, 'April': 4,
        'May': 5, 'June': 6, 'July': 7, 'August': 8,
        'September': 9, 'October': 10, 'November': 11, 'December': 12
      };

      const month = monthDict[monthName];
      if (!month) return '';

      const lastDay = new Date(year, month, 0).getDate();
      const validDay = Math.min(day, lastDay);

      return `${year}-${String(month).padStart(2, '0')}-${String(validDay).padStart(2, '0')}`;
    } catch (e) {
      console.error(`Error parsing date for zone ${zoneNum}:`, e);
      return '';
    }
  },

  // 12. Process Data - 1:1 sa Python map_columns()
  processData: function () {
    this.saveZoneConfig();

    // Kunin ang column indices mula sa mapping selects
    const colMap = {};
    for (const header of this.requiredHeaders) {
      const fieldId = this.getFieldId(header);
      const selectedCol = document.getElementById(fieldId)?.value || '';
      colMap[header] = this.availableColumns.indexOf(selectedCol);
    }

    // Kolektahin ang zone dates
    const zoneDueDates = {};
    const zoneReadingDates = {};
    const zoneDisconDates = {};

    for (let z = 1; z <= 9; z++) {
      const zStr = String(z);
      zoneDueDates[zStr] = this.parseDateFromUi('due', z);
      zoneReadingDates[zStr] = this.parseDateFromUi('reading', z);
      zoneDisconDates[zStr] = this.parseDateFromUi('discon', z);
    }

    const output = this.rawDataRows.map(row => {
      const getVal = (header) => {
        const idx = colMap[header];
        return (idx !== undefined && idx !== -1 && row[idx] !== undefined) ? row[idx] : '';
      };

      const accountNo = String(getVal('Account No.')).trim();
      
      // Calculate Total with proper logic (katumbas ng calculate_total sa Python)
      const parseVal = (v) => {
        const num = parseFloat(v);
        return (!isNaN(num) && String(v).trim() !== '') ? num : 0;
      };

      const bal = parseVal(getVal('BALANCE'));
      const aro = parseVal(getVal('AROBALANCE'));
      const total = Math.round((bal + aro) * 100) / 100;

      // Status: Active / Inactive
      const rawStatus = String(getVal('Status')).trim().toLowerCase();
      const status = rawStatus === 'inactive' ? 'Inactive' : 'Active';

      // Extract Zone from Account No. (katumbas ng extract_zone sa Python)
      let zone = '1';
      if (accountNo && accountNo.length >= 2) {
        const firstTwo = accountNo.substring(0, 2);
        zone = firstTwo.startsWith('0') ? firstTwo[1] : firstTwo[0];
      }

      const isInactive = status === 'Inactive';

      return {
        'Account No.': accountNo,
        'Name': getVal('Name'),
        'Address': getVal('Address'),
        'No.': getVal('No.'),
        'BALANCE': bal,
        'AROBALANCE': aro,
        'Total': total,
        'Status': status,
        'Zone': zone,
        'Due Date': isInactive ? 'N/A' : (zoneDueDates[zone] || ''),
        'Status for App': status,
        'Reading Date': isInactive ? 'N/A' : (zoneReadingDates[zone] || ''),
        'Discon Date': isInactive ? 'N/A' : (zoneDisconDates[zone] || '')
      };
    });

    const btnUploadProcessed = document.getElementById('btnUploadProcessed');
    if (btnUploadProcessed) btnUploadProcessed.disabled = false;

// Special Row sa dulo (Naka-set sa 092-101-001 kasama ang Present Date at Current Time sa Column D)
    // ✅ SYNC TEST ROW: 091-101-500 (sync indicator)
    const syncTestAccNo = '091-101-500';
    const existsInData = output.some(row => String(row['Account No.']).trim() === syncTestAccNo);

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const todayDate = `${year}-${month}-${day}`;

    const currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });

    if (existsInData) {
      const existingIdx = output.findIndex(row => String(row['Account No.']).trim() === syncTestAccNo);
      if (existingIdx !== -1) {
        output[existingIdx]['No.'] = currentTime;
        output[existingIdx]['Due Date'] = todayDate;
        output[existingIdx]['Reading Date'] = todayDate;
        output[existingIdx]['Discon Date'] = todayDate;
      }
    } else {
      output.push({
        'Account No.': syncTestAccNo,
        'Name': 'BAYAGBAG, PULPITO',
        'Address': 'SA PUSO MO',
        'No.': currentTime,
        'BALANCE': 0,
        'AROBALANCE': 0,
        'Total': 0,
        'Status': 'Active',
        'Zone': '9',
        'Due Date': todayDate,
        'Status for App': 'FOR TESTING',
        'Reading Date': todayDate,
        'Discon Date': todayDate
      });
    }

    window.AppState.processedData = output;
    
    const btnExport = document.getElementById('btnExportExcel');
    if (btnExport) btnExport.disabled = false;
    
    const btnDirect = document.getElementById('btnDirectToSupabase');
    if (btnDirect) btnDirect.disabled = false;

    if (window.AppState && window.AppState.showStatus) {
      window.AppState.showStatus(`🚀 Data Processed Successfully! (${output.length - 1} records)`, 'success');
    }
  },

  exportExcel: function () {
    if (!window.AppState || !window.AppState.processedData || !window.AppState.processedData.length) return;
    const ws = XLSX.utils.json_to_sheet(window.AppState.processedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "ForWebsite.xlsx");
    if (window.AppState && window.AppState.showStatus) {
      window.AppState.showStatus(`💾 Na-export na ang ForWebsite.xlsx!`, 'success');
    }
  },

  // 14. Direct to Supabase — GAMIT ANG ForWebsite.xlsx
  directToSupabase: async function () {
    const btnDirect = document.getElementById('btnDirectToSupabase');
    
    // Gumawa ng hidden file input kung wala pa
    let fileInput = document.getElementById('supabaseFileInput');
    if (!fileInput) {
      fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.id = 'supabaseFileInput';
      fileInput.accept = '.xlsx, .xls';
      fileInput.style.display = 'none';
      document.body.appendChild(fileInput);
    }

    // I-trigger ang file picker
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const proceed = confirm(`Sigurado ka bang nais mong i-upload ang "${file.name}" DIREKTA sa Supabase?\n\nAng existing data sa Supabase ay mapapalitan.`);
      if (!proceed) {
        fileInput.value = '';
        return;
      }

      if (btnDirect) {
        btnDirect.disabled = true;
        btnDirect.textContent = '⏳ Nag-u-upload...';
      }

      try {
        // Basahin ang Excel file
        const data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (evt) => resolve(new Uint8Array(evt.target.result));
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });

        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

        if (jsonData.length < 2) {
          alert('Walang laman ang Excel file.');
          return;
        }

        // I-convert sa matrix format
        const headers = jsonData[0].map(h => String(h).trim());
        const dataMatrix = [headers];

        jsonData.slice(1).forEach(row => {
          dataMatrix.push(headers.map((_, idx) => {
            const val = row[idx];
            return (val !== undefined && val !== null) ? String(val).trim() : '';
          }));
        });

        // I-upload sa Supabase
        const res = await fetch('/api/excel-to-supabase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: dataMatrix })
        });

        const result = await res.json();

        if (result.success) {
          window.AppState.showStatus(
            `🎉 DIREKTA SA SUPABASE!\n✓ ${result.count} records\n✓ Mula sa: ${file.name}`,
            'success'
          );
        } else {
          window.AppState.showStatus(`❌ Error: ${result.error}`, 'error');
        }
      } catch (err) {
        window.AppState.showStatus(`❌ Network Error: ${err.message}`, 'error');
      } finally {
        if (btnDirect) {
          btnDirect.disabled = false;
          btnDirect.textContent = '⚡ Direct to Supabase';
        }
        fileInput.value = '';
      }
    };

    fileInput.click();
  },

  // 15. Upload Processed Excel
  uploadProcessedFile: async function (file) {
    const btnUploadProcessed = document.getElementById('btnUploadProcessed');
    
    if (btnUploadProcessed) {
      btnUploadProcessed.disabled = true;
      btnUploadProcessed.textContent = '⏳ Nag-u-upload...';
    }

    try {
      // Basahin ang Excel file
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (evt) => resolve(new Uint8Array(evt.target.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
      });

      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

      if (jsonData.length < 2) {
        alert('Walang laman ang Excel file.');
        return;
      }

      const headers = jsonData[0].map(h => String(h).trim());
      const dataMatrix = [headers];

      jsonData.slice(1).forEach(row => {
        dataMatrix.push(headers.map((_, idx) => {
          const val = row[idx];
          return (val !== undefined && val !== null) ? String(val).trim() : '';
        }));
      });

      const proceed = confirm(`Sigurado ka bang nais mong i-upload ang ${dataMatrix.length - 1} records mula sa "${file.name}" DIREKTA sa Supabase?\n\nAng existing data sa Supabase ay mapapalitan.`);
      if (!proceed) return;

      const res = await fetch('/api/excel-to-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: dataMatrix })
      });

      const result = await res.json();

      if (result.success) {
        window.AppState.showStatus(
          `🎉 NA-UPLOAD SA SUPABASE!\n✓ ${result.count} records\n✓ Mula sa: ${file.name}`,
          'success'
        );
      } else {
        window.AppState.showStatus(`❌ Error: ${result.error}`, 'error');
      }
    } catch (err) {
      window.AppState.showStatus(`❌ Network Error: ${err.message}`, 'error');
    } finally {
      if (btnUploadProcessed) {
        btnUploadProcessed.disabled = false;
        btnUploadProcessed.textContent = '📤 Upload Processed Excel';
      }
      // I-reset ang file input
      const processedFileInput = document.getElementById('processedFileInput');
      if (processedFileInput) processedFileInput.value = '';
    }
  }
  
};