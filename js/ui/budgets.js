import { state } from '../app.js';
import * as DB from '../db.js';
import { FMT, getCurrentMonth, fechaToMes, parseMonto, esTipo, toast, openModal, closeModal } from '../utils.js';

let presupuestosCache = [];

export async function loadPresupuestos(skipFetch) {
  const mes = document.getElementById('presMes')?.value || getCurrentMonth();
  if (!skipFetch) presupuestosCache = await DB.getPresupuestos();
  const presupuestos = presupuestosCache;

  const txs = state.transacciones.filter(t => fechaToMes(t.fecha) === mes);
  const spent = {};
  txs.filter(t => esTipo(t.tipo, 'gasto') || esTipo(t.tipo, 'pago')).forEach(t => {
    spent[t.categoria] = (spent[t.categoria] || 0) + parseMonto(t.monto);
  });

  const grid = document.getElementById('presGrid');
  if (!grid) return;
  if (presupuestos.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">📋</div><h3>Sin presupuestos</h3><p>Crea tu primer presupuesto mensual</p></div>';
    return;
  }

  grid.innerHTML = presupuestos.map(p => {
    const limite = parseMonto(p.montoLimite);
    const gastado = spent[p.categoria] || 0;
    const pct = limite > 0 ? Math.min((gastado / limite) * 100, 100) : 0;
    const color = pct > 90 ? 'var(--red)' : pct > 70 ? 'var(--orange)' : 'var(--accent2)';
    const badge = pct >= 100 ? '<span class="pres-alert danger">🚨 Excedido</span>' : pct >= 80 ? '<span class="pres-alert warn">⚠️ Casi al limite</span>' : '';
    return `<div class="card meta-card">
      <div class="meta-header"><h3>${p.categoria}</h3>${badge}
        <div style="display:flex;gap:4px">
          <button class="btn-icon" onclick="window.openPresEdit('${p.id}')" title="Editar">✏️</button>
          <button class="btn-icon" onclick="window.deletePres('${p.id}')">🗑️</button>
        </div></div>
      <div class="meta-amounts">${FMT.format(gastado)} de ${FMT.format(limite)}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="progress-pct" style="color:${color}">${pct.toFixed(0)}% usado</div>
    </div>`;
  }).join('');
}

window.openPresEdit = function (id) {
  const p = presupuestosCache.find(x => x.id === id);
  if (!p) return;
  document.getElementById('presEditId').value = id;
  document.getElementById('modalPresTitle').textContent = 'Editar Presupuesto';
  const catSelect = document.getElementById('presCat');
  catSelect.value = p.categoria;
  catSelect.disabled = true;
  document.getElementById('presLimite').value = p.montoLimite;
  openModal('modalPres');
};

window.openPresNew = function () {
  document.getElementById('presEditId').value = '';
  document.getElementById('modalPresTitle').textContent = 'Nuevo Presupuesto';
  document.getElementById('presCat').disabled = false;
  document.getElementById('presLimite').value = '';
  openModal('modalPres');
};

window.savePres = async function () {
  const editId = document.getElementById('presEditId').value;
  const categoria = document.getElementById('presCat').value;
  const montoLimite = document.getElementById('presLimite').value;
  if (!montoLimite || !categoria) { toast('Completa los campos'); return; }

  if (editId) {
    const updated = await DB.updatePresupuesto(editId, { montoLimite });
    const p = presupuestosCache.find(x => x.id === editId);
    if (p) Object.assign(p, updated);
    document.getElementById('presCat').disabled = false;
    closeModal('modalPres');
    toast('Presupuesto actualizado');
  } else {
    const pres = await DB.addPresupuesto({ categoria, montoLimite });
    const idx = presupuestosCache.findIndex(p => p.id === pres.id);
    if (idx >= 0) presupuestosCache[idx] = pres; else presupuestosCache.push(pres);
    closeModal('modalPres');
    toast('Presupuesto creado');
  }
  loadPresupuestos(true);
};

window.deletePres = async function (id) {
  if (!confirm('Eliminar este presupuesto?')) return;
  await DB.deletePresupuesto(id);
  presupuestosCache = presupuestosCache.filter(p => p.id !== id);
  toast('Eliminado');
  loadPresupuestos(true);
};

window.loadPresupuestos = loadPresupuestos;
