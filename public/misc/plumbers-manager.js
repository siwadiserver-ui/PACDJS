let plumbersList = [];

document.addEventListener('DOMContentLoaded', () => {
  loadPlumbers();
});

async function loadPlumbers() {
  const tbody = document.getElementById('tableBody');
  try {
    const res = await fetch('/api/plumbers/list');
    plumbersList = await res.json();
    renderTable(plumbersList);
  } catch (err) {
    console.error('Error:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error loading: ${err.message}</td></tr>`;
  }
}

function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  const countLabel = document.getElementById('plumberCount');
  tbody.innerHTML = '';

  countLabel.textContent = `${data.length} Plumbers Total`;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-sec);">Walang tubero sa listahan.</td></tr>`;
    return;
  }

data.forEach((p, idx) => {
    const tr = document.createElement('tr');
    const catClass = (p.CATEGORY || '').toUpperCase() === 'REGULAR' ? 'cat-regular' : 'cat-jo';
    
    // ✅ Tumanggap ng 1, '1', o true
    const isActive = (p.IS_ACTIVE === 1 || p.IS_ACTIVE === '1' || p.IS_ACTIVE === true);

    const activeBadge = isActive 
      ? `<span class="badge-active">ACTIVE</span>` 
      : `<span class="badge-inactive">INACTIVE</span>`;

    tr.innerHTML = `
      <td><strong>${idx + 1}</strong></td>
      <td><strong>${p.NAME}</strong></td>
      <td><span class="badge-cat ${catClass}">${p.CATEGORY}</span></td>
      <td>${activeBadge}</td>
      <td style="text-align: center;">
        <button onclick="editPlumber(${p.ID})" style="border:none; background:transparent; color: var(--primary); cursor:pointer; font-size:1.1rem;" title="Edit"><i class='bx bx-edit'></i></button>
        <button onclick="deletePlumber(${p.ID}, '${p.NAME}')" style="border:none; background:transparent; color: var(--danger); cursor:pointer; font-size:1.1rem;" title="Delete"><i class='bx bx-trash'></i></button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function filterPlumbers(q) {
  const query = q.trim().toUpperCase();
  if (!query) return renderTable(plumbersList);

  const filtered = plumbersList.filter(p => 
    p.NAME.toUpperCase().includes(query) || 
    p.CATEGORY.toUpperCase().includes(query)
  );
  renderTable(filtered);
}

async function savePlumber() {
  const editId = document.getElementById('editingId').value;
  const payload = {
    id: editId || null,
    name: document.getElementById('plumberName').value.trim().toUpperCase(),
    category: document.getElementById('plumberCategory').value,
    active: document.getElementById('plumberActive').checked
  };

  if (!payload.name) {
    alert('Pakilagay ang pangalan ng tubero.');
    return;
  }

  const endpoint = editId ? '/api/plumbers/update' : '/api/plumbers/create';

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
      loadPlumbers();
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

function editPlumber(id) {
  const p = plumbersList.find(item => item.ID === id);
  if (!p) return;

  document.getElementById('editingId').value = p.ID;
  document.getElementById('plumberName').value = p.NAME;
  document.getElementById('plumberCategory').value = p.CATEGORY || 'REGULAR';
  
  // ✅ Tumanggap ng 1, '1', o true para sa checkbox
  document.getElementById('plumberActive').checked = (p.IS_ACTIVE === 1 || p.IS_ACTIVE === '1' || p.IS_ACTIVE === true);

  document.getElementById('formHeaderTitle').textContent = `Edit Plumber: ${p.NAME}`;
  document.getElementById('btnSubmit').innerHTML = `<i class='bx bx-check'></i> Update Plumber`;
  document.getElementById('btnCancel').style.display = 'inline-block';
}

function clearForm() {
  document.getElementById('editingId').value = '';
  document.getElementById('plumberName').value = '';
  document.getElementById('plumberCategory').value = 'REGULAR';
  document.getElementById('plumberActive').checked = true;

  document.getElementById('formHeaderTitle').textContent = 'Add New Plumber';
  document.getElementById('btnSubmit').innerHTML = `<i class='bx bx-save'></i> Save Plumber`;
  document.getElementById('btnCancel').style.display = 'none';
}

async function deletePlumber(id, name) {
  if (!confirm(`Sigurado ka bang nais mong tanggalin si ${name} sa Plumber Pool?`)) return;

  try {
    const res = await fetch('/api/plumbers/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    const result = await res.json();
    if (result.success) {
      loadPlumbers();
      clearForm();
    } else {
      alert('❌ Error: ' + result.error);
    }
  } catch (e) {
    alert('❌ Error: ' + e.message);
  }
}