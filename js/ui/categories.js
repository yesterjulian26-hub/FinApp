import { state, populateSelects } from '../app.js';
import * as DB from '../db.js';
import { toast, openModal, closeModal } from '../utils.js';

export async function loadCategorias() {
  state.categorias = await DB.getCategorias();
  const tbody = document.getElementById('catBody');
  if (!tbody) return;

  tbody.innerHTML = state.categorias.map(c => {
    const tipo = String(c.tipo).toLowerCase();
    return `<tr>
      <td><span style="font-size:18px;margin-right:6px">${c.icono || ''}</span> ${c.nombre}</td>
      <td><span class="badge ${tipo}">${tipo === 'ingreso' ? 'Ingreso' : tipo === 'pago' ? 'Pago' : 'Gasto'}</span></td>
      <td style="display:flex;gap:4px">
        <button class="btn-icon" onclick="window.openCatEdit('${c.id}','${c.nombre}','${c.icono || ''}','${c.color || ''}')" title="Personalizar">🎨</button>
        <button class="btn-icon" onclick="window.deleteCat('${c.id}')">🗑️</button>
      </td></tr>`;
  }).join('');
  populateSelects();
}

window.saveCat = async function () {
  const nombre = document.getElementById('catNombre').value;
  const tipo = document.getElementById('catTipo').value;
  if (!nombre) { toast('Ingresa un nombre'); return; }
  await DB.addCategoria({ nombre, tipo });
  closeModal('modalCat');
  toast('Categoria creada');
  document.getElementById('catNombre').value = '';
  loadCategorias();
};

window.deleteCat = async function (id) {
  if (!confirm('Eliminar esta categoria?')) return;
  await DB.deleteCategoria(id);
  toast('Eliminada');
  loadCategorias();
};

window.openCatEdit = function (id, nombre, icono, color) {
  document.getElementById('catEditId').value = id;
  document.getElementById('catEditLabel').textContent = nombre;
  document.getElementById('catEditIcono').value = icono;
  document.getElementById('catEditColor').value = color || '#6c5ce7';
  openModal('modalCatEdit');
};

window.saveCatEdit = async function () {
  const id = document.getElementById('catEditId').value;
  await DB.updateCategoria(id, {
    icono: document.getElementById('catEditIcono').value,
    color: document.getElementById('catEditColor').value
  });
  closeModal('modalCatEdit');
  toast('Categoria personalizada');
  loadCategorias();
};

window.loadCategorias = loadCategorias;
