let materialsList = [];

document.addEventListener('DOMContentLoaded', () => {
  loadMaterials();
});

async function loadMaterials() {
  const tbody = document.getElementById('tableBody');
  try {
    const res = await fetch('/api/materials/all');
    const json = await res.json();
    if (json.success) {
      materialsList = json.data;
      renderTable(materialsList);
    } else {
      throw new Error(json.message);
    }
  } catch (err) {
    console.error('Error:', err);
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--danger);">Error loading: ${err.message}</td></tr>`;
  }
}

function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  const countLabel = document.getElementById('materialCount');
  tbody.innerHTML = '';

  countLabel.textContent = `${data.length} Total Materials`;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-sec);">Walang materyales sa listahan.</td></tr>`;
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');
    const isActive = (item.IS_ACTIVE === 1 || item.IS_ACTIVE === '1' || item.IS_ACTIVE === true);
    const activeBadge = isActive 
      ? `<span class="badge-active">ACTIVE</span>` 
      : `<span class="badge-inactive">INACTIVE</span>`;

    tr.innerHTML = `
      <td><strong>${item.DISPLAY_ORDER || 0}</strong></td>
      <td><strong>${item.MATERIAL_NAME}</strong></td>
      <td>${item.CATEGORY || 'PLUMBING'}</td>
      <td>${activeBadge}</td>
      <td style="text-align: center;">
        <button onclick="editMaterial(${item.ID})" style="border:none; background:transparent; color: var(--primary); cursor:pointer; font-size:1.1rem;" title="Edit"><i class='bx bx-edit'></i></button>
        <button onclick="deleteMaterial(${item.ID}, '${item.MATERIAL_NAME}')" style="border:none; background:transparent; color: var(--danger); cursor:pointer; font-size:1.1rem;" title="Delete"><i class='bx bx-trash'></i></button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function filterMaterials(q) {
  const query = q.trim().toUpperCase();
  if (!query) return renderTable(materialsList);

  const filtered = materialsList.filter(item => 
    item.MATERIAL_NAME.toUpperCase().includes(query) || 
    (item.CATEGORY && item.CATEGORY.toUpperCase().includes(query))
  );
  renderTable(filtered);
}

async function saveMaterial() {
  const editId = document.getElementById('editingId').value;
  const payload = {
    id: editId || null,
    materialName: document.getElementById('materialName').value.trim().toUpperCase(),
    category: document.getElementById('materialCategory').value.trim().toUpperCase(),
    displayOrder: parseInt(document.getElementById('displayOrder').value, 10) || 0,
    isActive: document.getElementById('materialActive').checked
  };

  if (!payload.materialName) {
    alert('Pakilagay ang Material Name.');
    return;
  }

  const endpoint = editId ? '/api/materials/update' : '/api/materials/create';

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
      loadMaterials();
    } else {
      alert('❌ Error: ' + result.message);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

function editMaterial(id) {
  const item = materialsList.find(a => a.ID === id);
  if (!item) return;

  document.getElementById('editingId').value = item.ID;
  document.getElementById('materialName').value = item.MATERIAL_NAME;
  document.getElementById('materialCategory').value = item.CATEGORY || 'PLUMBING';
  document.getElementById('displayOrder').value = item.DISPLAY_ORDER || 0;
  document.getElementById('materialActive').checked = (item.IS_ACTIVE === 1 || item.IS_ACTIVE === '1' || item.IS_ACTIVE === true);

  document.getElementById('formHeaderTitle').textContent = `Edit Material: ${item.MATERIAL_NAME}`;
  document.getElementById('btnSubmit').innerHTML = `<i class='bx bx-check'></i> Update Material`;
  document.getElementById('btnCancel').style.display = 'inline-block';
}

function clearForm() {
  document.getElementById('editingId').value = '';
  document.getElementById('materialName').value = '';
  document.getElementById('materialCategory').value = 'PLUMBING';
  document.getElementById('displayOrder').value = '0';
  document.getElementById('materialActive').checked = true;

  document.getElementById('formHeaderTitle').textContent = 'Add New Material';
  document.getElementById('btnSubmit').innerHTML = `<i class='bx bx-save'></i> Save Material`;
  document.getElementById('btnCancel').style.display = 'none';
}

async function deleteMaterial(id, name) {
  if (!confirm(`Sigurado ka bang nais mong tanggalin ang "${name}" sa Materials Pool?`)) return;

  try {
    const res = await fetch(`/api/materials/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
      loadMaterials();
      clearForm();
    } else {
      alert('❌ Error: ' + result.message);
    }
  } catch (e) {
    alert('❌ Error: ' + e.message);
  }
}