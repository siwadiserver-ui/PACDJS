let winnersList = [];
let lastFetchedFullAccount = '';

document.addEventListener('DOMContentLoaded', () => {
  populateMonthOptions();
  setupKeyboardEvents();
  loadLastSavedSession(); // 👈 Kusa nitong ibinabalik ang huling na-type na winners
});

// 📅 Month of Draw Options (Last 12 months in MM/YYYY format)
function populateMonthOptions() {
  const select = document.getElementById('drawMonth');
  const date = new Date();
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  select.innerHTML = '';
  for (let i = 0; i < 12; i++) {
    const d = new Date(date.getFullYear(), date.getMonth() - i, 1);
    const mName = months[d.getMonth()].toUpperCase();
    const yr = d.getFullYear();
    const opt = document.createElement('option');
    opt.value = `${mName} ${yr}`;
    opt.textContent = `${mName} ${yr}`;
    select.appendChild(opt);
  }
}

// ⌨️ Keyboard Shortcuts & Enter Navigation
function setupKeyboardEvents() {
  const p1 = document.getElementById('accPart1');
  const p3 = document.getElementById('accPart3');
  const nameInput = document.getElementById('winnerName');
  const addrInput = document.getElementById('winnerAddress');

  p1.addEventListener('keyup', (e) => {
    if (e.key === 'Enter' || p1.value.length === 3) p3.focus();
  });

  p3.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') autoFetchAccount();
  });

  nameInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') addrInput.focus();
  });

  addrInput.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') addWinnerToList();
  });
}

// 🔍 Auto-Fetch mula sa Concessionaires Search
// 🔍 Auto-Fetch mula sa Customer Search (Gaya ng Senior Citizen module)
async function autoFetchAccount() {
  const p1 = (document.getElementById('accPart1')?.value || '').trim();
  const p3 = (document.getElementById('accPart3')?.value || '').trim();

  if (!p1 || !p3) {
    document.getElementById('statusNotice').textContent = '⚠️ Pakikompleto ang account number (Part 1 at Part 3).';
    return;
  }

  document.getElementById('statusNotice').innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Hinahanap ang concessionaire...`;

  try {
    const res = await fetch(`/api/commercial/excel/search-customer?part1=${encodeURIComponent(p1)}&part3=${encodeURIComponent(p3)}`);
    const data = await res.json();

    if (data.success && data.found && data.customer) {
      const c = data.customer;

      // Buong Account Number
      const fullAcc = c.ACCOUNT_NUMBER || '';
      if (fullAcc && fullAcc.includes('-')) {
        const parts = fullAcc.split('-');
        if (parts.length >= 3) {
          document.getElementById('accPart1').value = parts[0];
          document.getElementById('accPart2').value = parts[1];
          document.getElementById('accPart3').value = parts[2];
        }
        lastFetchedFullAccount = fullAcc;
      } else {
        lastFetchedFullAccount = `${p1}-000-${p3}`;
      }

      // Name & Address
      const name = (c.ACCOUNT_NAME || c.NAME || '').trim();
      const address = (c.ADDRESS || '').trim();

      document.getElementById('winnerName').value = name.toUpperCase();
      document.getElementById('winnerAddress').value = address.toUpperCase();

      document.getElementById('statusNotice').textContent = '✅ Nahanap ang Concessionaire! Pindutin ang Enter para idagdag sa winners list.';
      document.getElementById('winnerName').focus();
    } else {
      lastFetchedFullAccount = '';
      document.getElementById('accPart2').value = 'XXX';
      document.getElementById('statusNotice').textContent = '❌ Walang natagpuang Concessionaire. Pwede mong i-type manually ang pangalan at address.';
      document.getElementById('winnerName').focus();
    }
  } catch (e) {
    console.error('Fetch error:', e);
    document.getElementById('statusNotice').textContent = '❌ Error fetching customer: ' + e.message;
  }
}

// 🏙️ City Detection Logic: Famy (071-074, 081-084) vs Siniloan
function getCityFromAccountNumber(accountNo) {
  try {
    const clean = String(accountNo || '').trim().toUpperCase();
    if (clean === 'MANUAL-ENTRY' || !clean) return 'Siniloan, Laguna';

    let prefix = clean;
    if (clean.includes('-')) {
      prefix = clean.split('-')[0].trim();
    }
    
    const firstThree = prefix.substring(0, 3);
    const famyPrefixes = ['071', '072', '073', '074', '081', '082', '083', '084'];

    if (famyPrefixes.includes(firstThree)) {
      return 'Famy, Laguna';
    }
    return 'Siniloan, Laguna';
  } catch (e) {
    return 'Siniloan, Laguna';
  }
}

// ➕ Add Winner to Table List
function addWinnerToList() {
  const name = document.getElementById('winnerName').value.trim().toUpperCase();
  const address = document.getElementById('winnerAddress').value.trim().toUpperCase();
  const p1 = document.getElementById('accPart1').value.trim();
  const p2 = document.getElementById('accPart2').value.trim();
  const p3 = document.getElementById('accPart3').value.trim();

  if (!name) {
    alert('Please enter winner\'s name.');
    document.getElementById('winnerName').focus();
    return;
  }

  if (winnersList.length >= 40) {
    alert('Maximum 40 winners allowed per sheet.');
    return;
  }

  let accountNo = 'MANUAL-ENTRY';
  if (lastFetchedFullAccount) {
    accountNo = lastFetchedFullAccount;
  } else if (p1 && p3) {
    accountNo = `${p1}-${p2 || '000'}-${p3}`;
  }

  const city = getCityFromAccountNumber(accountNo);

  const newWinner = {
    id: winnersList.length + 1,
    account_no: accountNo,
    name: name,
    address: address,
    city: city
  };

  winnersList.push(newWinner);
  renderTable();
  autoSaveToStorage(); // 💾 Auto-save kapag may nadagdag
  clearForm();

  document.getElementById('accPart1').focus();
}

function renderTable() {
  const tbody = document.getElementById('winnersTableBody');
  tbody.innerHTML = '';

  let famy = 0;
  let siniloan = 0;

  if (winnersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-sec); padding: 30px;">Walang nakalistang winner.</td></tr>`;
  } else {
    winnersList.forEach((w, index) => {
      w.id = index + 1;
      if (w.city === 'Famy, Laguna') famy++;
      else siniloan++;

      const isFamy = w.city === 'Famy, Laguna';
      tbody.innerHTML += `
        <tr>
          <td style="text-align: center; font-weight: 700;">${w.id}</td>
          <td style="font-weight: 700; color: var(--primary); font-family: monospace;">${w.account_no}</td>
          <td style="font-weight: 600;">${w.name}</td>
          <td>${w.address}</td>
          <td><span class="${isFamy ? 'badge-famy' : 'badge-siniloan'}">${w.city}</span></td>
          <td style="text-align: center;">
            <button class="btn btn-danger" style="padding: 3px 6px; font-size: 0.72rem;" onclick="removeWinner(${index})" title="Remove Winner">
              <i class='bx bx-x'></i>
            </button>
          </td>
        </tr>
      `;
    });
  }

  document.getElementById('winnerCount').textContent = winnersList.length;
  document.getElementById('famyCount').textContent = famy;
  document.getElementById('siniloanCount').textContent = siniloan;
}

function removeWinner(index) {
  winnersList.splice(index, 1);
  renderTable();
  autoSaveToStorage(); // 💾 Auto-save kapag nagbawas
}

function clearAllWinners() {
  if (winnersList.length === 0) return;
  if (confirm('Are you sure you want to remove all winners?')) {
    winnersList = [];
    renderTable();
    localStorage.removeItem('siwadi_raffle_last_session'); // 🗑️ Burahin ang saved cache
  }
}

function clearForm() {
  document.getElementById('accPart1').value = '';
  document.getElementById('accPart2').value = 'XXX';
  document.getElementById('accPart3').value = '';
  document.getElementById('winnerName').value = '';
  document.getElementById('winnerAddress').value = '';
  lastFetchedFullAccount = '';
  document.getElementById('statusNotice').textContent = '💡 Ready to enter next account number.';
}

// ==========================================
// 💾 AUTOMATED LOCALSTORAGE & JSON BACKUP
// ==========================================

// Kusa nitong itinatago sa browser ang listahan tuwing may ginalaw ka
function autoSaveToStorage() {
  const sessionData = {
    drawMonth: document.getElementById('drawMonth').value,
    savedAt: new Date().toISOString(),
    winners: winnersList
  };
  localStorage.setItem('siwadi_raffle_last_session', JSON.stringify(sessionData));
}

// Kusa nitong ibinabalik ang na-save kapag na-refresh o naisara ang tab
function loadLastSavedSession() {
  const raw = localStorage.getItem('siwadi_raffle_last_session');
  if (!raw) return;

  try {
    const data = JSON.parse(raw);
    if (data && Array.isArray(data.winners) && data.winners.length > 0) {
      winnersList = data.winners;
      if (data.drawMonth) {
        document.getElementById('drawMonth').value = data.drawMonth;
      }
      renderTable();
      document.getElementById('statusNotice').innerHTML = `💡 Na-restore ang huling sesyon (${winnersList.length} winners) mula sa local memory.`;
    }
  } catch (e) {
    console.error('Error loading saved session:', e);
  }
}

// I-download ang sesyon bilang isang .JSON file para sa backup
function saveSessionToFile() {
  if (winnersList.length === 0) {
    alert('Walang tala sa listahan na maisa-save.');
    return;
  }

  const monthDisplay = document.getElementById('drawMonth').value;
  const payload = {
    system: "SIWADI PACD - Raffle Winners",
    drawMonth: monthDisplay,
    savedAt: new Date().toLocaleString(),
    totalWinners: winnersList.length,
    winners: winnersList
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const filename = `Raffle_Winners_${monthDisplay.replace(/\s+/g, '_')}.json`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// I-load pabalik ang isang na-save na .JSON file
function loadSessionFromFile(input) {
  if (!input.files || !input.files[0]) return;

  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data && Array.isArray(data.winners)) {
        winnersList = data.winners;
        if (data.drawMonth) {
          document.getElementById('drawMonth').value = data.drawMonth;
        }
        renderTable();
        autoSaveToStorage();
        alert(`✅ Matagumpay na nai-load ang ${winnersList.length} winners mula sa file.`);
      } else {
        alert('❌ Hindi tugma ang format ng napiling JSON file.');
      }
    } catch (err) {
      alert('❌ Error sa pagbasa ng JSON file: ' + err.message);
    }
    input.value = '';
  };

  reader.readAsText(file);
}

// ==========================================
// 📊 EXCEL EXPORT (Plain Columns & Values)
// ==========================================
function exportToExcel() {
  if (winnersList.length === 0) {
    alert('Please add at least one winner to export.');
    return;
  }

  const monthDisplay = document.getElementById('drawMonth').value;

  const excelData = [
    ['Name of Winners', 'Address', 'Account Number', 'City', 'Signature', 'Date Claimed']
  ];

  winnersList.forEach(w => {
    excelData.push([
      w.name,
      w.address,
      w.account_no,
      w.city,
      '',
      ''
    ]);
  });

  const ws = XLSX.utils.aoa_to_sheet(excelData);

  ws['!cols'] = [
    { wch: 32 },
    { wch: 36 },
    { wch: 18 },
    { wch: 18 },
    { wch: 20 },
    { wch: 16 }
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Winners List');

  const filename = `Winners_List_${monthDisplay.replace(/\s+/g, '_')}.xlsx`;
  XLSX.writeFile(wb, filename);

  alert(`✅ Winners List exported to Excel!\n\nFile: ${filename}\nTotal Winners: ${winnersList.length}`);
}

// ==========================================
// 📄 GENERATE WORD DOCUMENT (.DOCX) - 8.5" x 13"
// ==========================================
async function generateSignatureSheet() {
  if (winnersList.length === 0) {
    alert('Please add at least one winner to generate the sheet.');
    return;
  }

  const monthDisplay = document.getElementById('drawMonth').value;
  const currentDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const {
    Document,
    Packer,
    Paragraph,
    TextRun,
    Table,
    TableRow,
    TableCell,
    WidthType,
    AlignmentType,
    VerticalAlign,
    BorderStyle
  } = docx;

  const headerRow = new TableRow({
    tableHeader: true,
    children: [
      createCell('No.', 500, true, AlignmentType.CENTER),
      createCell('Name of Winners', 2500, true, AlignmentType.CENTER),
      createCell('Address', 3000, true, AlignmentType.CENTER),
      createCell('Account Number', 1600, true, AlignmentType.CENTER),
      createCell('Signature', 1800, true, AlignmentType.CENTER),
      createCell('Date Claimed', 1400, true, AlignmentType.CENTER)
    ]
  });

  const dataRows = winnersList.map(w => {
    return new TableRow({
      children: [
        createCell(String(w.id), 500, false, AlignmentType.CENTER),
        createCell(w.name, 2500, false, AlignmentType.LEFT),
        createCell(w.address, 3000, false, AlignmentType.LEFT),
        createCell(w.account_no, 1600, false, AlignmentType.CENTER),
        createCell('', 1800, false, AlignmentType.CENTER),
        createCell('', 1400, false, AlignmentType.CENTER)
      ]
    });
  });

  const winnersTable = new Table({
    width: { size: 10800, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    rows: [headerRow, ...dataRows]
  });

  const signatoriesTable = new Table({
    width: { size: 10800, type: WidthType.DXA },
    alignment: AlignmentType.CENTER,
    borders: {
      top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
      insideVertical: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
    },
    rows: [
      new TableRow({
        children: [
          createSignatoryCell(['PREPARED BY:'], AlignmentType.LEFT),
          createSignatoryCell(['VERIFIED BY:'], AlignmentType.CENTER),
          createSignatoryCell(['NOTED:'], AlignmentType.RIGHT)
        ]
      }),
      new TableRow({
        children: [
          createSignatoryCell(['', '', 'MIRASOL R. SINGIN', 'CSO - A'], AlignmentType.LEFT),
          createSignatoryCell(['', '', 'SUSAN G. VELASCO', 'DIV. - MGR. COMMERCIAL SERVICE'], AlignmentType.CENTER),
          createSignatoryCell(['', '', 'ENGR. ISIDORO V. REALEZA', 'GENERAL MANAGER'], AlignmentType.RIGHT)
        ]
      })
    ]
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: {
            width: 12240,  // 8.5 inches
            height: 18720  // 13.0 inches (Long Bond Paper)
          },
          margin: {
            top: 720,
            right: 720,
            bottom: 720,
            left: 720
          }
        }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({ text: 'LIST OF WINNERS', bold: true, size: 24 })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({ text: '"BIGAS PARA SA MAAGAP" RAFFLE PROMO', bold: true, size: 20 })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 40 },
          children: [
            new TextRun({ text: `FOR THE MONTH OF ${monthDisplay}`, bold: true, size: 18 })
          ]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 120 },
          children: [
            new TextRun({ text: 'DRAW BY GOOGLE RANDOM PICK AND FACEBOOK LIVE', italics: true, size: 16 })
          ]
        }),
        winnersTable,
        new Paragraph({ spacing: { before: 200, after: 100 }, children: [] }),
        signatoriesTable,
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240 },
          children: [
            new TextRun({ text: `Generated on: ${currentDate}`, italics: true, size: 14 })
          ]
        })
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const filename = `Winners_List_${monthDisplay.replace(/\s+/g, '_')}.docx`;
  
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  alert(`✅ Editable Word document generated and downloaded!\n\nFile: ${filename}\nPaper Size: 8.5" x 13"\nMonth: ${monthDisplay}`);
}

function createCell(text, widthDxa, isHeader = false, align = docx.AlignmentType.LEFT) {
  return new docx.TableCell({
    width: { size: widthDxa, type: docx.WidthType.DXA },
    verticalAlign: docx.VerticalAlign.CENTER,
    shading: isHeader ? { fill: 'F0F0F0' } : undefined,
    children: [
      new docx.Paragraph({
        alignment: align,
        children: [
          new docx.TextRun({
            text: text,
            bold: isHeader,
            size: 16
          })
        ]
      })
    ]
  });
}

function createSignatoryCell(lines, align = docx.AlignmentType.LEFT) {
  return new docx.TableCell({
    width: { size: 3600, type: docx.WidthType.DXA },
    children: lines.map((l, idx) => new docx.Paragraph({
      alignment: align,
      children: [
        new docx.TextRun({
          text: l,
          bold: idx === 0 || idx === 2,
          size: idx === 0 ? 18 : 16
        })
      ]
    }))
  });
}