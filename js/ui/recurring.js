import { state, populateSelects } from '../app.js';
import * as DB from '../db.js';
import { FMT, formatDate, parseMonto, toast, openModal, closeModal } from '../utils.js';

export async function loadRecurrentes() {
  const recurrentes = await DB.getRecurrentes();
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
        <button class="btn-icon" onclick="window.deleteRecurrente('${r.id}')">🗑️</button>
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

window.saveRecurrente = async function () {
  const descripcion = document.getElementById('recDesc').value;
  const tipo = document.getElementById('recTipo').value;
  const categoria = document.getElementById('recCategoria').value;
  const monto = document.getElementById('recMonto').value;
  const frecuencia = document.getElementById('recFrec').value;
  const proximaFecha = document.getElementById('recFecha').value;
  const cuenta = document.getElementById('recCuenta').value;
  if (!descripcion || !monto || !proximaFecha) { toast('Completa los campos'); return; }
  await DB.addRecurrente({ descripcion, tipo, categoria, monto, frecuencia, proximaFecha, cuenta });
  closeModal('modalRecurrente');
  toast('Recurrente creado');
  loadRecurrentes();
};

window.deleteRecurrente = async function (id) {
  if (!confirm('Eliminar?')) return;
  await DB.deleteRecurrente(id);
  toast('Eliminado');
  loadRecurrentes();
};

window.processRecurrentesBtn = async function () {
  const count = await DB.processRecurrentes();
  state.transacciones = await DB.getTransacciones();
  toast(`${count} transacciones procesadas`);
  loadRecurrentes();
};

window.loadRecurrentes = loadRecurrentes;
