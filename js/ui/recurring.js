import { state, populateSelects } from '../app.js';
import * as DB from '../db.js';
import { FMT, formatDate, parseMonto, toast, openModal, closeModal } from '../utils.js';

export async function loadRecurrentes(skipFetch) {
  if (!skipFetch) state.recurrentes = await DB.getRecurrentes();
  const recurrentes = state.recurrentes;
  const grid = document.getElementById('recGrid');
  if (!grid) return;
  if (recurrentes.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">🔁</div><h3>Sin recurrentes</h3><p>Agrega pagos o ingresos automáticos</p></div>';
    return;
  }
  const hoy = new Date().toISOString().slice(0, 10);
  grid.innerHTML = recurrentes.map(r => {
    const vencido = r.proximaFecha && r.proximaFecha <= hoy;
    return `<div class="card meta-card">
      <div class="meta-header">
        <h3>${r.tipo === 'Ingreso' ? '📥' : '📤'} ${r.descripcion}</h3>
        <div style="display:flex;gap:4px">
          <button class="btn-icon" onclick="window.openRecurrenteEdit('${r.id}')" title="Editar">✏️</button>
          <button class="btn-icon" onclick="window.deleteRecurrente('${r.id}')">🗑️</button>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin:6px 0">
        <span class="badge ${r.tipo === 'Ingreso' ? 'ingreso' : 'gasto'}">${r.tipo}</span>
        <span style="font-size:12px;color:var(--text2)">${r.categoria}</span>
        <span style="font-size:12px;color:var(--text2)">${r.frecuencia}</span>
      </div>
      <div style="font-size:20px;font-weight:700">${FMT.format(parseMonto(r.monto))}</div>
      <div style="font-size:12px;margin-top:4px;color:${vencido ? 'var(--red)' : 'var(--text2)'}">
        ${vencido ? '⚠️ Vencido' : 'Próximo'}: ${r.proximaFecha ? formatDate(r.proximaFecha) : 'N/A'}
      </div>
      ${r.cuenta ? `<div style="font-size:12px;color:var(--text2)">Cuenta: ${r.cuenta}</div>` : ''}
    </div>`;
  }).join('');
}

window.openRecurrenteEdit = function (id) {
  const r = state.recurrentes.find(x => x.id === id);
  if (!r) return;
  document.getElementById('recEditId').value = id;
  document.getElementById('modalRecurrenteTitle').textContent = 'Editar Recurrente';
  document.getElementById('recTipo').value = r.tipo || 'Gasto';
  document.getElementById('recFrec').value = r.frecuencia || 'Mensual';
  document.getElementById('recCategoria').value = r.categoria || '';
  document.getElementById('recCuenta').value = r.cuenta || '';
  document.getElementById('recDesc').value = r.descripcion || '';
  document.getElementById('recMonto').value = r.monto || '';
  document.getElementById('recFecha').value = r.proximaFecha || '';
  openModal('modalRecurrente');
};

window.openRecurrenteNew = function () {
  document.getElementById('recEditId').value = '';
  document.getElementById('modalRecurrenteTitle').textContent = 'Nueva Recurrente';
  document.getElementById('recDesc').value = '';
  document.getElementById('recMonto').value = '';
  document.getElementById('recFecha').value = '';
  openModal('modalRecurrente');
};

window.saveRecurrente = async function () {
  const editId = document.getElementById('recEditId').value;
  const descripcion = document.getElementById('recDesc').value;
  const tipo = document.getElementById('recTipo').value;
  const categoria = document.getElementById('recCategoria').value;
  const monto = document.getElementById('recMonto').value;
  const frecuencia = document.getElementById('recFrec').value;
  const proximaFecha = document.getElementById('recFecha').value;
  const cuenta = document.getElementById('recCuenta').value;
  if (!descripcion || !monto || !proximaFecha) { toast('Completa los campos'); return; }
  try {
    if (editId) {
      const updated = await DB.updateRecurrente(editId, { descripcion, tipo, categoria, monto, frecuencia, proximaFecha, cuenta });
      const r = state.recurrentes.find(x => x.id === editId);
      if (r) Object.assign(r, updated);
      closeModal('modalRecurrente');
      toast('Recurrente actualizado');
    } else {
      const rec = await DB.addRecurrente({ descripcion, tipo, categoria, monto, frecuencia, proximaFecha, cuenta });
      state.recurrentes.push(rec);
      closeModal('modalRecurrente');
      toast('Recurrente creado');
    }
    loadRecurrentes(true);
  } catch (err) {
    toast('Error al guardar: ' + err.message);
  }
};

window.deleteRecurrente = async function (id) {
  if (!confirm('Eliminar?')) return;
  try {
    await DB.deleteRecurrente(id);
    state.recurrentes = state.recurrentes.filter(r => r.id !== id);
    toast('Eliminado');
    loadRecurrentes(true);
  } catch (err) {
    toast('Error al eliminar: ' + err.message);
  }
};

window.processRecurrentesBtn = async function () {
  try {
    const creadas = await DB.processRecurrentes();
    if (creadas.length) {
      state.transacciones.push(...creadas);
      state.recurrentes = await DB.getRecurrentes();
    }
    toast(`${creadas.length} transacciones procesadas`);
    loadRecurrentes(true);
  } catch (err) {
    toast('Error al procesar: ' + err.message);
  }
};

window.loadRecurrentes = loadRecurrentes;
