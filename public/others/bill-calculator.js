// 📊 TARIFF RATES DATA
const TARIFF_DATA = {
  "RESIDENTIAL(101)": {
    '1/2"': { min_charge: 200.00, rates: { "11-20": 21.13, "21-30": 23.25, "31-40": 26.00, "41-50": 30.00, "51-Up": 34.40 } }
  },
  "COMMERCIAL(301)": {
    '1/2"': { min_charge: 400.00, rates: { "11-20": 42.26, "21-30": 46.50, "31-40": 52.00, "41-50": 60.00, "51-Up": 68.80 } },
    '3/4"': { min_charge: 640.00, rates: { "11-20": 42.26, "21-30": 46.50, "31-40": 52.00, "41-50": 60.00, "51-Up": 68.80 } },
    '1"':   { min_charge: 1280.00, rates: { "11-20": 42.26, "21-30": 46.50, "31-40": 52.00, "41-50": 60.00, "51-Up": 68.80 } }
  },
  "SEMI-COM'L. A": {
    '1/2"': { min_charge: 350.00, rates: { "11-20": 36.98, "21-30": 40.69, "31-40": 45.50, "41-50": 52.50, "51-Up": 60.20 } }
  },
  "SEMI-COM'L. B": {
    '1/2"': { min_charge: 300.00, rates: { "11-20": 31.70, "21-30": 34.88, "31-40": 39.00, "41-50": 45.00, "51-Up": 51.60 } }
  },
  "SEMI-COM'L. C": {
    '1/2"': { min_charge: 250.00, rates: { "11-20": 26.41, "21-30": 29.06, "31-40": 32.50, "41-50": 37.50, "51-Up": 43.00 } }
  },
  "BULK/WHOLESALE": {
    '1/2"': { min_charge: 600.00, rates: { "11-20": 63.39, "21-30": 69.75, "31-40": 78.00, "41-50": 90.00, "51-Up": 103.20 } }
  }
};

let currentWaterBill = null;
let materialItems = [];
let lastFetchedFullAccount = '';

document.addEventListener('DOMContentLoaded', () => {
  onClassChange();
  setupKeyboardEvents();
});

function setupKeyboardEvents() {
  const p1 = document.getElementById('accPart1');
  const p3 = document.getElementById('accPart3');

  p1?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter' || p1.value.length === 3) p3?.focus();
  });

  p3?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') autoFetchAccount();
  });
}

// 🔍 Concessionaire Auto-Fetch
// 🔍 Concessionaire Auto-Fetch (Patterned mula sa Senior Citizen Module)
async function autoFetchAccount() {
  const p1 = (document.getElementById('accPart1')?.value || '').trim();
  const p3 = (document.getElementById('accPart3')?.value || '').trim();

  if (!p1 || !p3) {
    document.getElementById('statusNotice').textContent = '⚠️ Pakikompleto ang Part 1 at Part 3.';
    return;
  }

  document.getElementById('statusNotice').innerHTML = `<i class='bx bx-loader-alt bx-spin'></i> Hinahanap ang concessionaire...`;

  try {
    const res = await fetch(`/api/commercial/excel/search-customer?part1=${encodeURIComponent(p1)}&part3=${encodeURIComponent(p3)}`);
    const data = await res.json();

    if (data.success && data.found && data.customer) {
      const c = data.customer;

      // Pangalan at Address
      document.getElementById('custName').value = (c.ACCOUNT_NAME || c.NAME || '').trim().toUpperCase();
      document.getElementById('custAddress').value = (c.ADDRESS || '').trim().toUpperCase();

      // Account Number Parts
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

      // Classification Auto-select kung mayroon sa database customer record
      const cls = (c.CLASSIFICATION || c.CLASS || '').toUpperCase();
      if (cls) {
        for (const k of Object.keys(TARIFF_DATA)) {
          if (cls.includes(k) || k.includes(cls)) {
            document.getElementById('selClass').value = k;
            onClassChange();
            break;
          }
        }
      }

      document.getElementById('statusNotice').textContent = '✅ Nahanap ang Concessionaire!';
      document.getElementById('inpConsumption')?.focus();
    } else {
      lastFetchedFullAccount = '';
      document.getElementById('accPart2').value = 'XXX';
      document.getElementById('statusNotice').textContent = '❌ Walang natagpuang Concessionaire. Pwede mong i-type manually.';
      document.getElementById('custName')?.focus();
    }
  } catch (e) {
    console.error('Fetch error:', e);
    document.getElementById('statusNotice').textContent = '❌ Error fetching customer: ' + e.message;
  }
}

// 🔀 Tabs Switcher
function switchCalcTab(tabId, element) {
  document.querySelectorAll('.tab-item').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab-panel-body').forEach(el => el.classList.remove('active'));

  element.classList.add('active');
  document.getElementById(tabId)?.classList.add('active');
}

function onClassChange() {
  const cls = document.getElementById('selClass').value;
  const meterSelect = document.getElementById('selMeterSize');
  meterSelect.innerHTML = '';

  const sizes = Object.keys(TARIFF_DATA[cls] || {});
  sizes.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = s;
    meterSelect.appendChild(opt);
  });
}

// 🚰 🌟 COMPUTE WATER BILL (Exact Tier Calculation)
// 🚰 Server-assisted Water Bill Calculation
async function computeWaterBill() {
  const cls = document.getElementById('selClass').value;
  const meterSize = document.getElementById('selMeterSize').value;
  const consStr = document.getElementById('inpConsumption').value;

  if (consStr === '' || isNaN(consStr) || Number(consStr) < 0) {
    alert('Please enter a valid whole number for consumption.');
    return;
  }

  try {
    const res = await fetch('/api/bill-calculator/compute-water', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        classification: cls,
        meterSize: meterSize,
        consumption: parseInt(consStr, 10)
      })
    });

    const json = await res.json();
    if (json.success) {
      currentWaterBill = json.data;

      // Render breakdown
      const bList = document.getElementById('breakdownList');
      bList.innerHTML = currentWaterBill.detailed_steps.map(s => `<div class="breakdown-step">${s}</div>`).join('');
      document.getElementById('totalBillDisplay').textContent = `Php ${currentWaterBill.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    } else {
      alert('Computation error: ' + json.message);
    }
  } catch (err) {
    console.error('Fetch compute error:', err);
  }
}

// 📦 MATERIALS CALCULATOR
function addMaterialItem() {
  const desc = document.getElementById('inpItemDesc').value.trim().toUpperCase();
  const amtStr = document.getElementById('inpItemAmount').value;

  if (!desc) {
    alert('Please enter item description.');
    document.getElementById('inpItemDesc').focus();
    return;
  }

  const amt = parseFloat(amtStr);
  if (isNaN(amt) || amt <= 0) {
    alert('Please enter a valid amount.');
    document.getElementById('inpItemAmount').focus();
    return;
  }

  materialItems.push({ description: desc, amount: amt });
  renderMaterialsTable();

  document.getElementById('inpItemDesc').value = '';
  document.getElementById('inpItemAmount').value = '';
  document.getElementById('inpItemDesc').focus();
}

function removeMaterialItem(index) {
  materialItems.splice(index, 1);
  renderMaterialsTable();
}

function clearMaterialItems() {
  materialItems = [];
  renderMaterialsTable();
}

function renderMaterialsTable() {
  const tbody = document.getElementById('materialsTableBody');
  tbody.innerHTML = '';

  let total = 0;
  if (materialItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-sec); padding: 20px;">Walang nakalistang aytem.</td></tr>`;
  } else {
    materialItems.forEach((item, idx) => {
      total += item.amount;
      tbody.innerHTML += `
        <tr>
          <td>${idx + 1}</td>
          <td><strong>${item.description}</strong></td>
          <td style="text-align: right;">Php ${item.amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
          <td style="text-align: center;">
            <button class="btn btn-danger" style="padding: 2px 6px; font-size: 0.72rem;" onclick="removeMaterialItem(${idx})"><i class='bx bx-x'></i></button>
          </td>
        </tr>
      `;
    });
  }

  document.getElementById('materialsTotalDisplay').textContent = `Php ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// 🖨️ A6 PDF / RECEIPT PRINT WINDOWS
function printWaterBillA6() {
  if (!currentWaterBill) {
    alert('Please calculate a water bill first.');
    return;
  }

  const name = document.getElementById('custName').value.trim() || 'N/A';
  const address = document.getElementById('custAddress').value.trim() || 'N/A';
  const accNo = lastFetchedFullAccount || `${document.getElementById('accPart1').value}-${document.getElementById('accPart2').value}-${document.getElementById('accPart3').value}`;
  const now = new Date().toLocaleString();

  const printWindow = window.open('', '_blank', 'width=450,height=650');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Water_Bill_Receipt</title>
      <style>
        @page { size: 105mm 148mm; margin: 6mm; }
        * { font-family: 'Courier New', Courier, monospace; font-size: 9pt; }
        .text-center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
      </style>
    </head>
    <body>
      <div class="text-center bold" style="font-size: 11pt;">SINILOAN WATER DISTRICT</div>
      <div class="text-center">WATER BILL COMPUTATION</div>
      <div class="text-center" style="font-size: 7.5pt;">${now}</div>
      <div class="divider"></div>

      <div><strong>NAME:</strong> ${name}</div>
      <div><strong>ACC #:</strong> ${accNo}</div>
      <div><strong>ADDR:</strong> ${address}</div>
      <div class="divider"></div>

      <div><strong>CLASS:</strong> ${currentWaterBill.classification}</div>
      <div><strong>SIZE:</strong> ${currentWaterBill.meter_size}</div>
      <div><strong>CONSUMPTION:</strong> ${currentWaterBill.consumption} cu.m.</div>
      <div><strong>MIN CHARGE:</strong> Php ${currentWaterBill.min_charge.toFixed(2)}</div>
      <div class="divider"></div>

      <div class="bold">CALCULATION:</div>
      ${currentWaterBill.detailed_steps.map(s => `<div style="font-size: 8pt;">${s}</div>`).join('')}
      <div class="divider"></div>

      <div class="bold" style="font-size: 11pt; display: flex; justify-content: space-between;">
        <span>TOTAL:</span>
        <span>Php ${currentWaterBill.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div class="divider"></div>

      <div class="text-center" style="font-size: 7pt; margin-top: 8px;">Computer Generated Receipt</div>
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

function printMaterialsA6() {
  if (materialItems.length === 0) {
    alert('Please add items to the bill first.');
    return;
  }

  const name = document.getElementById('custName').value.trim() || 'N/A';
  const address = document.getElementById('custAddress').value.trim() || 'N/A';
  const accNo = lastFetchedFullAccount || `${document.getElementById('accPart1').value}-${document.getElementById('accPart2').value}-${document.getElementById('accPart3').value}`;
  const now = new Date().toLocaleString();

  let total = 0;
  const rows = materialItems.map((item, i) => {
    total += item.amount;
    return `
      <div style="display: flex; justify-content: space-between; font-size: 8pt;">
        <span>${i + 1}. ${item.description}</span>
        <span>Php ${item.amount.toFixed(2)}</span>
      </div>
    `;
  }).join('');

  const printWindow = window.open('', '_blank', 'width=450,height=650');
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Materials_Bill_Receipt</title>
      <style>
        @page { size: 105mm 148mm; margin: 6mm; }
        * { font-family: 'Courier New', Courier, monospace; font-size: 9pt; }
        .text-center { text-align: center; }
        .bold { font-weight: bold; }
        .divider { border-top: 1px dashed #000; margin: 4px 0; }
      </style>
    </head>
    <body>
      <div class="text-center bold" style="font-size: 11pt;">SINILOAN WATER DISTRICT</div>
      <div class="text-center">MATERIALS & BILLS COMPUTATION</div>
      <div class="text-center" style="font-size: 7.5pt;">${now}</div>
      <div class="divider"></div>

      <div><strong>NAME:</strong> ${name}</div>
      <div><strong>ACC #:</strong> ${accNo}</div>
      <div><strong>ADDR:</strong> ${address}</div>
      <div class="divider"></div>

      <div class="bold">ITEMS (${materialItems.length}):</div>
      ${rows}
      <div class="divider"></div>

      <div class="bold" style="font-size: 11pt; display: flex; justify-content: space-between;">
        <span>TOTAL:</span>
        <span>Php ${total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
      </div>
      <div class="divider"></div>

      <div class="text-center" style="font-size: 7pt; margin-top: 8px;">Thank you for your business!</div>
      <script>
        window.onload = function() { window.print(); };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}