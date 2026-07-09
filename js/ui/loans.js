import { state } from '../app.js';
import * as DB from '../db.js';
import { FMT, formatDate, parseMonto, toast, openModal, closeModal } from '../utils.js';

export async function loadPrestamos() {
  const prestamos = await DB.getPrestamos();
  const grid = document.getElementById('prestamosGrid');
  if (!grid) return;
  if (prestamos.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">🏦</div><h3>Sin préstamos</h3><p>Registra tu primer préstamo</p></div>';
    return;
  }
  grid.innerHTML = prestamos.map(p => {
    const total = parseMonto(p.montoTotal);
    const cuotas = p.cuotas_detalle || [];
    const pagadas = cuotas.filter(c => c.estado === 'Pagada').length;
    const pendientes = cuotas.filter(c => c.estado === 'Pendiente');
    const proxima = pendientes.sort((a, b) => (a.fechaVencimiento || '').localeCompare(b.fechaVencimiento || ''))[0];
    const montoCuota = parseMonto(p.montoCuota);
    const pagado = pagadas * montoCuota;
    const pct = total > 0 ? Math.min((pagado / total) * 100, 100) : 0;
    const hoy = new Date().toISOString().slice(0, 10);
    const vencidas = pendientes.filter(c => c.fechaVencimiento < hoy).length;

    return `<div class="card meta-card">
      <div class="meta-header">
        <h3>${p.tipo === 'Debo' ? '📤' : '📥'} ${p.entidad}</h3>
        <span class="meta-badge ${p.tipo === 'Debo' ? 'activa' : 'completada'}">${p.tipo}</span>
      </div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:4px">${p.descripcion || ''}</div>
      <div class="meta-amounts">${FMT.format(pagado)} de ${FMT.format(total)}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:var(--accent)"></div></div>
      <div class="progress-pct">${pagadas}/${cuotas.length} cuotas · ${pct.toFixed(0)}%</div>
      ${vencidas > 0 ? `<div class="pres-alert danger" style="margin-top:6px">🚨 ${vencidas} cuota(s) vencida(s)</div>` : ''}
      ${proxima ? `<div style="font-size:12px;margin-top:6px;color:var(--text2)">Próxima: ${formatDate(proxima.fechaVencimiento)} · ${FMT.format(montoCuota)}</div>` : ''}
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
        <button class="btn btn-primary btn-sm" onclick="window.verCuotas('${p.id}')">📅 Cuotas</button>
        <button class="btn-icon" onclick="window.deletePrestamo('${p.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

window.savePrestamo = async function () {
  const nombre = document.getElementById('prestEntidad').value;
  const montoTotal = document.getElementById('prestMonto').value;
  const numCuotas = parseInt(document.getElementById('prestCuotas').value);
  const fechaInicio = document.getElementById('prestFecha').value;
  const cuenta = document.getElementById('prestCuenta').value;
  if (!nombre || !montoTotal || !numCuotas || !fechaInicio) { toast('Completa los campos'); return; }
  const montoCuota = (parseFloat(montoTotal) / numCuotas).toFixed(2);
  await DB.addPrestamo({ nombre, montoTotal, montoCuota, cuotas: numCuotas, fechaInicio, cuenta });
  closeModal('modalPrestamo');
  toast('Préstamo creado con ' + numCuotas + ' cuotas');
  loadPrestamos();
};

window.deletePrestamo = async function (id) {
  if (!confirm('Eliminar este préstamo y todas sus cuotas?')) return;
  await DB.deletePrestamo(id);
  toast('Eliminado');
  loadPrestamos();
};

window.verCuotas = async function (id) {
  const p = await DB.getPrestamo(id);
  if (!p) return;
  const cuotas = (p.cuotas_detalle || []).sort((a, b) => (a.fechaVencimiento || '').localeCompare(b.fechaVencimiento || ''));
  document.getElementById('cuotasPrestId').value = id;
  document.getElementById('cuotasTitle').textContent = `Cuotas - ${p.entidad}`;
  const tbody = document.getElementById('cuotasBody');
  const hoy = new Date().toISOString().slice(0, 10);
  tbody.innerHTML = cuotas.map((c, i) => {
    const vencida = c.estado === 'Pendiente' && c.fechaVencimiento < hoy;
    return `<tr style="${vencida ? 'background:rgba(255,0,0,0.06)' : ''}">
      <td>${i + 1}</td>
      <td><input type="date" value="${c.fechaVencimiento}" onchange="window.updateCuotaFecha('${id}','${c.id}',this.value)" style="border:none;background:transparent;color:inherit;font-size:13px"></td>
      <td>${FMT.format(parseMonto(p.montoCuota))}</td>
      <td><span class="badge ${c.estado === 'Pagada' ? 'ingreso' : vencida ? 'gasto' : 'pago'}">${c.estado}${vencida ? ' ⚠️' : ''}</span></td>
      <td>${c.estado === 'Pendiente' ? `<button class="btn btn-primary btn-sm" onclick="window.pagarCuotaBtn('${id}','${c.id}')">Pagar</button>` : `<span style="color:var(--accent2)">✓</span>`}</td>
    </tr>`;
  }).join('');
  openModal('modalCuotas');
};

window.pagarCuotaBtn = async function (prestId, cuotaId) {
  const result = await DB.pagarCuota(prestId, cuotaId);
  if (result.tx) state.transacciones.push(result.tx);
  toast('Cuota pagada');
  window.verCuotas(prestId);
  loadPrestamos();
};

window.updateCuotaFecha = async function (prestId, cuotaId, fecha) {
  await DB.updateFechaCuota(prestId, cuotaId, fecha);
  toast('Fecha actualizada');
};

window.loadPrestamos = loadPrestamos;
