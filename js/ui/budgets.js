import { state } from '../app.js';
import * as DB from '../db.js';
import { FMT, getCurrentMonth, fechaToMes, parseMonto, esTipo, toast, openModal, closeModal } from '../utils.js';

export async function loadPresupuestos() {
  const mes = document.getElementById('presMes')?.value || getCurrentMonth();
  const presupuestos = await DB.getPresupuestos();

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
        <button class="btn-icon" onclick="window.deletePres('${p.id}')">🗑️</button></div>
      <div class="meta-amounts">${FMT.format(gastado)} de ${FMT.format(limite)}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${color}"></div></div>
      <div class="progress-pct" style="color:${color}">${pct.toFixed(0)}% usado</div>
    </div>`;
  }).join('');
}

window.savePres = async function () {
  const categoria = document.getElementById('presCat').value;
  const montoLimite = document.getElementById('presLimite').value;
  if (!montoLimite || !categoria) { toast('Completa los campos'); return; }
  await DB.addPresupuesto({ categoria, montoLimite });
  closeModal('modalPres');
  toast('Presupuesto creado');
  loadPresupuestos();
};

window.deletePres = async function (id) {
  if (!confirm('Eliminar este presupuesto?')) return;
  await DB.deletePresupuesto(id);
  toast('Eliminado');
  loadPresupuestos();
};

window.loadPresupuestos = loadPresupuestos;
