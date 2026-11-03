let agreementsList = [];
let lastFetchedFullAccount = '';

document.addEventListener('DOMContentLoaded', () => {
  loadSavedAgreements();
  setupEnterKeyNav();
});

function setupEnterKeyNav() {
  const p1 = document.getElementById('accPart1');
  const p3 = document.getElementById('accPart3');

  p1.addEventListener('keyup', (e) => {
    if (e.key === 'Enter' || p1.value.length === 3) p3.focus();
  });

  p3.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') onAccountEnter();
  });
}

// 🔍 Search Customer Logic
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
        lastFetchedFullAccount = c.ACCOUNT_NUMBER;
      }

      const accName = (c.ACCOUNT_NAME || '').toUpperCase();
      document.getElementById('registeredName').value = accName;
      // Default: kung walang hiwalay na rep, auto-populate muna ang Signee
      document.getElementById('customerName').value = accName;
      document.getElementById('customerAddress').value = (c.ADDRESS || '').toUpperCase();
      document.getElementById('totalAmount').focus();
    }
  } catch (e) {
    console.error('Account search error:', e);
  }
}

// 🧮 Calculate Payments & Generate Schedule Text
function calculatePayments() {
  const amountVal = parseFloat(document.getElementById('totalAmount').value) || 0;
  const months = parseInt(document.getElementById('monthsCount').value, 10) || 1;
  const scheduleBox = document.getElementById('schedulePreview');

  if (amountVal <= 0) {
    scheduleBox.textContent = 'Payment schedule will appear here...';
    return [];
  }

  const monthlyPayment = amountVal / months;
  const currentDate = new Date();
  const schedule = [];

  for (let i = 0; i < months; i++) {
    const paymentDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i, 1);
    const monthName = paymentDate.toLocaleString('tl-PH', { month: 'long', year: 'numeric' }).toUpperCase();
    
    if (i === 0) {
      schedule.push(`${monthName} -- ₱${monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
    } else {
      schedule.push(`${monthName} -- ₱${monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} + WATER BILL`);
    }
  }

  scheduleBox.textContent = schedule.join('\n');
  return schedule;
}

// 💾 Save to Memory & LocalStorage
function saveAgreementToList() {
  const editingId = document.getElementById('editingRecordId').value;
  const p1 = document.getElementById('accPart1').value.trim();
  const p2 = document.getElementById('accPart2').value.trim();
  const p3 = document.getElementById('accPart3').value.trim();
  const regName = document.getElementById('registeredName').value.trim().toUpperCase();
  const name = document.getElementById('customerName').value.trim().toUpperCase();
  const address = document.getElementById('customerAddress').value.trim().toUpperCase();
  const amount = parseFloat(document.getElementById('totalAmount').value) || 0;
  const months = parseInt(document.getElementById('monthsCount').value, 10) || 3;
  const reason = document.getElementById('reasonText').value.trim();

  // Kapag walang nilagay sa signee, gagamitin ang registered name
  const finalSigneeName = name || regName;
  const finalRegName = regName || finalSigneeName;

  if (!finalSigneeName || amount <= 0) {
    alert('Pakilagay ang pangalan at tamang halaga.');
    return;
  }

  const accountNo = (p1 && p3) ? `${p1}-${p2}-${p3}` : (lastFetchedFullAccount || 'MANUAL-ENTRY');
  const monthlyPayment = amount / months;

  if (editingId) {
    const index = agreementsList.findIndex(item => item.id == editingId);
    if (index !== -1) {
      agreementsList[index] = {
        ...agreementsList[index],
        accountNo,
        registeredName: finalRegName,
        name: finalSigneeName,
        address,
        amount,
        months,
        monthlyPayment,
        reason
      };
      alert('✅ Na-update ang Compromise Agreement!');
    }
  } else {
    const agreementItem = {
      id: Date.now(),
      accountNo,
      registeredName: finalRegName,
      name: finalSigneeName,
      address,
      amount,
      months,
      monthlyPayment,
      reason,
      createdDate: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    };
    agreementsList.unshift(agreementItem);
    alert('✅ Naitala ang bagong Compromise Agreement!');
  }

  renderTable();
  autoSaveToStorage();
  clearForm();
}

function renderTable() {
  const tbody = document.getElementById('agreementTableBody');
  tbody.innerHTML = '';

  if (agreementsList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-sec); padding: 25px;">Walang naitalang agreement sa memory.</td></tr>`;
    document.getElementById('totalCount').textContent = '0';
    return;
  }

  agreementsList.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${item.accountNo}</strong></td>
      <td><span style="color: var(--primary); font-weight: 700;">${item.registeredName || item.name}</span></td>
      <td>${item.name}</td>
      <td>₱${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td>${item.months} mos.</td>
      <td>₱${item.monthlyPayment.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
      <td>${item.createdDate}</td>
      <td style="text-align: center;">
        <button type="button" class="btn-std" style="padding: 2px 6px; font-size: 0.72rem; color: var(--danger);" onclick="event.stopPropagation(); deleteAgreement(${index})">
          <i class='bx bx-trash'></i>
        </button>
      </td>
    `;
    tr.addEventListener('click', () => loadIntoForm(item));
    tbody.appendChild(tr);
  });

  document.getElementById('totalCount').textContent = agreementsList.length;
}

function loadIntoForm(item) {
  document.getElementById('editingRecordId').value = item.id;
  
  if (item.accountNo && item.accountNo.includes('-')) {
    const parts = item.accountNo.split('-');
    document.getElementById('accPart1').value = parts[0] || '';
    document.getElementById('accPart2').value = parts[1] || 'XXX';
    document.getElementById('accPart3').value = parts[2] || '';
    lastFetchedFullAccount = item.accountNo;
  } else {
    lastFetchedFullAccount = item.accountNo;
  }
  
  document.getElementById('registeredName').value = item.registeredName || item.name;
  document.getElementById('customerName').value = item.name;
  document.getElementById('customerAddress').value = item.address;
  document.getElementById('totalAmount').value = item.amount;
  document.getElementById('monthsCount').value = item.months;
  document.getElementById('reasonText').value = item.reason || 'nasirang linya ng tubig.';
  
  document.getElementById('btnSaveRecord').innerHTML = "<i class='bx bx-save'></i> Update Record";
  calculatePayments();
}

function clearForm() {
  document.getElementById('editingRecordId').value = '';
  document.getElementById('accPart1').value = '';
  document.getElementById('accPart2').value = 'XXX';
  document.getElementById('accPart3').value = '';
  document.getElementById('registeredName').value = '';
  document.getElementById('customerName').value = '';
  document.getElementById('customerAddress').value = '';
  document.getElementById('totalAmount').value = '';
  document.getElementById('monthsCount').value = '3';
  document.getElementById('reasonText').value = 'nasirang linya ng tubig.';
  document.getElementById('schedulePreview').textContent = 'Payment schedule will appear here...';
  document.getElementById('btnSaveRecord').innerHTML = "<i class='bx bx-plus-circle'></i> Save to List";
  lastFetchedFullAccount = '';
}

function deleteAgreement(idx) {
  if (confirm('Nais mo bang tanggalin ang kasunduang ito sa listahan?')) {
    const isEditingDeleted = agreementsList[idx].id == document.getElementById('editingRecordId').value;
    agreementsList.splice(idx, 1);
    renderTable();
    autoSaveToStorage();
    if (isEditingDeleted) clearForm();
  }
}

function clearAllAgreements() {
  if (agreementsList.length === 0) return;
  if (confirm('Sigurado ka bang nais mong linisin ang lahat ng nakatalang agreements?')) {
    agreementsList = [];
    renderTable();
    clearForm();
    localStorage.removeItem('siwadi_compromise_agreements');
  }
}

// ==========================================
// 💾 LOCALSTORAGE & JSON BACKUP
// ==========================================
function autoSaveToStorage() {
  localStorage.setItem('siwadi_compromise_agreements', JSON.stringify(agreementsList));
}

function loadSavedAgreements() {
  const raw = localStorage.getItem('siwadi_compromise_agreements');
  if (!raw) return;
  try {
    agreementsList = JSON.parse(raw) || [];
    renderTable();
  } catch (e) {
    console.error(e);
  }
}

function saveSessionToFile() {
  if (agreementsList.length === 0) {
    alert('Walang data na maisa-save.');
    return;
  }
  const payload = {
    system: "SIWADI PACD - Compromise Agreement",
    savedAt: new Date().toLocaleString(),
    total: agreementsList.length,
    agreements: agreementsList
  };
  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const filename = `Compromise_Agreements_${new Date().toISOString().slice(0, 10)}.json`;

  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function loadSessionFromFile(input) {
  if (!input.files || !input.files[0]) return;
  const file = input.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data && Array.isArray(data.agreements)) {
        agreementsList = data.agreements;
        renderTable();
        autoSaveToStorage();
        alert(`✅ Matagumpay na nai-load ang ${agreementsList.length} kasunduan.`);
      } else {
        alert('❌ Hindi tugma ang format ng JSON file.');
      }
    } catch (err) {
      alert('❌ Error sa pagbasa: ' + err.message);
    }
    input.value = '';
  };
  reader.readAsText(file);
}

// 🖨️ Direct A4 Printout
function printAgreement() {
  const regName = (document.getElementById('registeredName').value.trim() || document.getElementById('customerName').value.trim()).toUpperCase();
  const signeeName = (document.getElementById('customerName').value.trim() || regName).toUpperCase();
  const address = document.getElementById('customerAddress').value.trim().toUpperCase();
  const amount = parseFloat(document.getElementById('totalAmount').value) || 0;
  const months = parseInt(document.getElementById('monthsCount').value, 10) || 3;
  const p1 = document.getElementById('accPart1').value.trim();
  const p2 = document.getElementById('accPart2').value.trim();
  const p3 = document.getElementById('accPart3').value.trim();
  const reason = document.getElementById('reasonText').value.trim();

  if (!signeeName || amount <= 0) {
    alert('Pakikompleto ang mga detalye bago mag-print.');
    return;
  }

  const accountNo = (p1 && p3) ? `${p1}-${p2}-${p3}` : (lastFetchedFullAccount || 'MANUAL-ENTRY');
  const schedule = calculatePayments();
  const now = new Date();
  const currentMonthYear = now.toLocaleString('tl-PH', { month: 'long', year: 'numeric' });

  const bodyHtml = `
    <p style="margin-bottom: 14px; text-indent: 28px;">
      Ako, si <strong>${signeeName}</strong>, may sapat na gulang, naninirahan at may pahatirang sulat sa <strong>${address}</strong> ay may kabatiran na ang kabuuang halaga na aking pananagutan sa <strong>SINILOAN WATER DISTRICT (SIWADI)</strong> ay may halagang <strong>₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong> sa kadahilanang ${reason}
    </p>
    <p style="margin-bottom: 14px; text-indent: 28px;">
      Ang halagang nabanggit ay aking babayaran sa loob ng <strong>${months}</strong> buwan simula ngayong <strong>${currentMonthYear}</strong> ayon sa sumusunod na talaan ng hulog:
    </p>
    
    <div class="no-split" style="margin: 14px 0 18px 0; font-family: monospace; font-size: 9.5pt; background: #fafafa; border: 1px solid #000; padding: 10px 14px; line-height: 1.6;">
      <div style="font-weight: bold; margin-bottom: 6px; text-decoration: underline;">PAYMENT SCHEDULE:</div>
      <div style="display: flex; flex-direction: column; gap: 4px;">
        ${schedule.map(s => `<div>• ${s}</div>`).join('')}
      </div>
    </div>

    <p style="margin-bottom: 14px; text-indent: 28px;">
      Sa katunayan ng lahat, ako ay kusang-loob na lumagda ng aking pangalan ngayong ika-<strong>${now.getDate()}</strong> ng <strong>${currentMonthYear}</strong> dito sa Siniloan, Laguna.
    </p>

    <div style="margin-top: 14px; font-size: 9.5pt; line-height: 1.5;">
      <div><strong>Account No.:</strong> ${accountNo}</div>
      <div><strong>Account Name:</strong> ${regName}</div>
    </div>
  `;

  document.getElementById('printBodyContent').innerHTML = bodyHtml;
  window.print();
}

// 📄 GENERATE WORD (.DOCX)
async function downloadWordDocument() {
  const regName = (document.getElementById('registeredName').value.trim() || document.getElementById('customerName').value.trim()).toUpperCase();
  const signeeName = (document.getElementById('customerName').value.trim() || regName).toUpperCase();
  const address = document.getElementById('customerAddress').value.trim().toUpperCase();
  const amount = parseFloat(document.getElementById('totalAmount').value) || 0;
  const months = parseInt(document.getElementById('monthsCount').value, 10) || 3;
  const p1 = document.getElementById('accPart1').value.trim();
  const p2 = document.getElementById('accPart2').value.trim();
  const p3 = document.getElementById('accPart3').value.trim();
  const reason = document.getElementById('reasonText').value.trim();

  if (!signeeName || amount <= 0) {
    alert('Pakikompleto ang pangalan at halaga bago mag-download.');
    return;
  }

  const accountNo = (p1 && p3) ? `${p1}-${p2}-${p3}` : (lastFetchedFullAccount || 'MANUAL-ENTRY');
  const schedule = calculatePayments();

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
    BorderStyle
  } = docx;

  const now = new Date();
  const currentMonthYear = now.toLocaleString('tl-PH', { month: 'long', year: 'numeric' });
  const currentDay = now.getDate();

  const scheduleParagraphs = schedule.map(line => {
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 40 },
      children: [new TextRun({ text: `• ${line}`, size: 21 })]
    });
  });

  const signatoriesTable = new Table({
    width: { size: 10000, type: WidthType.DXA },
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
          createSignatoryCell(['PINATUNAYAN / NIREREKOMENDA:'], AlignmentType.LEFT),
          createSignatoryCell(['SINANG-AYUNAN:'], AlignmentType.RIGHT)
        ]
      }),
      new TableRow({
        children: [
          createSignatoryCell(['', '', 'SUSAN G. VELASCO', 'Division Manager, Commercial Services'], AlignmentType.LEFT),
          createSignatoryCell(['', '', 'ENGR. ISIDORO V. REALEZA', 'General Manager'], AlignmentType.RIGHT)
        ]
      })
    ]
  });

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 720, right: 720, bottom: 720, left: 720 }
        }
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'Siniloan Water District', bold: true, size: 26 })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: 'SINILOAN, LAGUNA, Philippines, 4014 | Telephone: (049) 511-8572 | Fax No: (049) 521-8578', size: 16 })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 220, after: 180 },
          children: [new TextRun({ text: 'P A N G A K O N G   P A G B A B A Y A D', bold: true, size: 22 })]
        }),

        new Paragraph({
          spacing: { after: 120 },
          children: [new TextRun({ text: `Ako, si ${signeeName}, may sapat na gulang, naninirahan at may pahatirang sulat sa ${address} ay may kabatiran na ang kabuuang halaga na aking pananagutan sa SINILOAN WATER DISTRICT (SIWADI) ay may halagang ₱${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })} sa kadahilanang ${reason}`, size: 21 })]
        }),
        new Paragraph({
          spacing: { after: 100 },
          children: [new TextRun({ text: `Ang halagang nabanggit ay aking babayaran sa loob ng ${months} buwan simula ngayong ${currentMonthYear} ayon sa sumusunod na talaan ng hulog:`, size: 21 })]
        }),
        new Paragraph({
          spacing: { before: 100, after: 60 },
          children: [new TextRun({ text: 'PAYMENT SCHEDULE:', bold: true, size: 21 })]
        }),
        ...scheduleParagraphs,
        new Paragraph({
          spacing: { before: 120, after: 120 },
          children: [new TextRun({ text: `Sa katunayan ng lahat, ako ay kusang-loob na lumagda ng aking pangalan ngayong ika-${currentDay} ng ${currentMonthYear} dito sa Siniloan, Laguna.`, size: 21 })]
        }),
        new Paragraph({ children: [new TextRun({ text: `Account No.: ${accountNo}`, bold: true, size: 19 })] }),
        new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: `Account Name: ${regName}`, bold: true, size: 19 })] }),

        new Paragraph({
          alignment: AlignmentType.RIGHT,
          children: [new TextRun({ text: '_______________________________', size: 21 })]
        }),
        new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { after: 240 },
          children: [new TextRun({ text: 'Lagda ng Concessionaire / Kinatawan', bold: true, size: 17 })]
        }),

        signatoriesTable
      ]
    }]
  });

  const blob = await Packer.toBlob(doc);
  const filename = `Pangako_${accountNo.replace(/-/g, '_')}.docx`;
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function createSignatoryCell(lines, align = docx.AlignmentType.LEFT) {
  return new docx.TableCell({
    width: { size: 5400, type: docx.WidthType.DXA },
    children: lines.map((l, idx) => new docx.Paragraph({
      alignment: align,
      children: [
        new docx.TextRun({
          text: l,
          bold: idx === 0 || idx === 2,
          size: idx === 0 ? 17 : 20
        })
      ]
    }))
  });
}