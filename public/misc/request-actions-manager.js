let actionsList = [];

document.addEventListener('DOMContentLoaded', () => {
  loadActions();
});

async function loadActions() {
  const tbody = document.getElementById('tableBody');
  try {
    const res = await fetch('/api/request-actions/all');
    const json = await res.json();
    if (json.success) {
      actionsList = json.data;
      renderTable(actionsList);
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
  const countLabel = document.getElementById('actionCount');
  tbody.innerHTML = '';

  countLabel.textContent = `${data.length} Configured Actions`;

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-sec);">Walang configured actions.</td></tr>`;
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
      <td><strong>${item.ACTION_NAME}</strong></td>
      <td>${item.CATEGORY || 'SERVICE_REQUEST'}</td>
      <td>${activeBadge}</td>
      <td style="text-align: center;">
        <button onclick="editAction(${item.ID})" style="border:none; background:transparent; color: var(--primary); cursor:pointer; font-size:1.1rem;" title="Edit"><i class='bx bx-edit'></i></button>
        <button onclick="deleteAction(${item.ID}, '${item.ACTION_NAME}')" style="border:none; background:transparent; color: var(--danger); cursor:pointer; font-size:1.1rem;" title="Delete"><i class='bx bx-trash'></i></button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

function filterActions(q) {
  const query = q.trim().toUpperCase();
  if (!query) return renderTable(actionsList);

  const filtered = actionsList.filter(item => 
    item.ACTION_NAME.toUpperCase().includes(query) || 
    (item.CATEGORY && item.CATEGORY.toUpperCase().includes(query))
  );
  renderTable(filtered);
}

async function saveAction() {
  const editId = document.getElementById('editingId').value;
  const payload = {
    id: editId || null,
    actionName: document.getElementById('actionName').value.trim().toUpperCase(),
    category: document.getElementById('actionCategory').value.trim().toUpperCase(),
    displayOrder: parseInt(document.getElementById('displayOrder').value, 10) || 0,
    isActive: document.getElementById('actionActive').checked
  };

  if (!payload.actionName) {
    alert('Pakilagay ang Action Name.');
    return;
  }

  const endpoint = editId ? '/api/request-actions/update' : '/api/request-actions/create';

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
      loadActions();
    } else {
      alert('❌ Error: ' + result.message);
    }
  } catch (err) {
    alert('❌ Error: ' + err.message);
  }
}

function editAction(id) {
  const item = actionsList.find(a => a.ID === id);
  if (!item) return;

  document.getElementById('editingId').value = item.ID;
  document.getElementById('actionName').value = item.ACTION_NAME;
  document.getElementById('actionCategory').value = item.CATEGORY || 'SERVICE_REQUEST';
  document.getElementById('displayOrder').value = item.DISPLAY_ORDER || 0;
  document.getElementById('actionActive').checked = (item.IS_ACTIVE === 1 || item.IS_ACTIVE === '1' || item.IS_ACTIVE === true);

  document.getElementById('formHeaderTitle').textContent = `Edit Action: ${item.ACTION_NAME}`;
  document.getElementById('btnSubmit').innerHTML = `<i class='bx bx-check'></i> Update Action`;
  document.getElementById('btnCancel').style.display = 'inline-block';
}

function clearForm() {
  document.getElementById('editingId').value = '';
  document.getElementById('actionName').value = '';
  document.getElementById('actionCategory').value = 'SERVICE_REQUEST';
  document.getElementById('displayOrder').value = '0';
  document.getElementById('actionActive').checked = true;

  document.getElementById('formHeaderTitle').textContent = 'Add Action Taken';
  document.getElementById('btnSubmit').innerHTML = `<i class='bx bx-save'></i> Save Action`;
  document.getElementById('btnCancel').style.display = 'none';
}

async function deleteAction(id, name) {
  if (!confirm(`Sigurado ka bang nais mong tanggalin ang "${name}"?`)) return;

  try {
    const res = await fetch(`/api/request-actions/${id}`, {
      method: 'DELETE'
    });
    const result = await res.json();
    if (result.success) {
      loadActions();
      clearForm();
    } else {
      alert('❌ Error: ' + result.message);
    }
  } catch (e) {
    alert('❌ Error: ' + e.message);
  }
}