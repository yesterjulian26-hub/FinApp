import { state, populateSelects } from '../app.js';
import * as DB from '../db.js';
import { FMT, formatDate, getCurrentMonth, parseMonto, toast, openModal, closeModal } from '../utils.js';

let metasCache = [];

export async function loadMetas(skipFetch) {
  if (!skipFetch) metasCache = await DB.getMetas();
  const metas = metasCache;
  const grid = document.getElementById('metasGrid');
  if (!grid) return;
  if (metas.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">🎯</div><h3>Sin metas</h3><p>Crea tu primera meta de ahorro</p></div>';
    return;
  }
  const mesActual = getCurrentMonth();
  grid.innerHTML = metas.map(m => {
    const objetivo = parseMonto(m.montoObjetivo);
    const actual = parseMonto(m.montoActual);
    const pct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0;
    const isComplete = m.estado === 'Completada';
    const meses = m.meses || 0;
    const mensualidad = parseMonto(m.montoMensual);
    const mesesAbonados = m.mesesAbonados || 0;
    const yaAbonoEsteMes = m.ultimoAbonoMes === mesActual;
    return `<div class="card meta-card">
      <div class="meta-header"><h3>🎯 ${m.nombre}</h3>
        <span class="meta-badge ${isComplete ? 'completada' : 'activa'}">${m.estado}</span></div>
      ${m.fechaLimite ? `<div style="font-size:12px;color:var(--text2);margin-bottom:4px">Meta: ${formatDate(m.fechaLimite)}</div>` : ''}
      ${meses > 0 ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px">📅 ${mesesAbonados}/${meses} meses · ${FMT.format(mensualidad)}/mes</div>` : ''}
      <div class="meta-amounts">${FMT.format(actual)} de ${FMT.format(objetivo)}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${isComplete ? 'var(--accent2)' : 'var(--accent)'}"></div></div>
      <div class="progress-pct">${pct.toFixed(0)}%</div>
      <div style="display:flex;gap:6px;margin-top:12px;flex-wrap:wrap">
        ${!isComplete && meses > 0 ? `<button class="btn btn-primary btn-sm" ${yaAbonoEsteMes ? 'disabled' : ''} onclick="window.abonarMesMeta('${m.id}')">${yaAbonoEsteMes ? '✓ Mes abonado' : `+ Abonar mes (${FMT.format(mensualidad)})`}</button>` : ''}
        ${!isComplete ? `<button class="btn btn-secondary btn-sm" onclick="window.abonarMontoMeta('${m.id}')">+ Monto personalizado</button>` : ''}
        <button class="btn-icon" onclick="window.openMetaModal('${m.id}')" title="Editar">✏️</button>
        <button class="btn-icon" onclick="window.deleteMeta('${m.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

function refreshDashboardIfActive() {
  if (document.getElementById('page-dashboard')?.classList.contains('active')) {
    window.loadDashboard?.();
  }
}

window.openMetaModal = function (id) {
  const meta = id ? metasCache.find(m => m.id === id) : null;
  document.getElementById('metaEditId').value = id || '';
  document.getElementById('metaNombre').value = meta ? meta.nombre : '';
  document.getElementById('metaMonto').value = meta ? parseMonto(meta.montoObjetivo) : '';
  document.getElementById('metaMeses').value = meta ? (meta.meses || '') : '';
  document.getElementById('metaFecha').value = meta ? (meta.fechaLimite || '') : '';
  document.getElementById('metaCuenta').value = meta ? (meta.cuenta || 'General') : 'General';
  document.getElementById('modalMetaTitle').textContent = meta ? 'Editar Meta de Ahorro' : 'Nueva Meta de Ahorro';
  openModal('modalMeta');
};

window.saveMeta = async function () {
  const id = document.getElementById('metaEditId').value;
  const nombre = document.getElementById('metaNombre').value;
  const montoObjetivo = document.getElementById('metaMonto').value;
  const meses = document.getElementById('metaMeses').value;
  const fechaLimite = document.getElementById('metaFecha').value;
  const cuenta = document.getElementById('metaCuenta').value;
  if (!nombre || !montoObjetivo || !meses) { toast('Completa nombre, monto y meses'); return; }

  if (id) {
    const updated = await DB.editarMeta(id, { nombre, montoObjetivo, meses, fechaLimite, cuenta });
    const meta = metasCache.find(m => m.id === id);
    if (meta) Object.assign(meta, updated);
    toast('Meta actualizada');
  } else {
    const meta = await DB.addMeta({ nombre, montoObjetivo, meses, fechaLimite, cuenta });
    metasCache.push(meta);
    toast('Meta creada');
    if (meta.categoriaAhorro) {
      state.categorias.push(meta.categoriaAhorro);
      state.categorias.sort((a, b) => a.nombre.localeCompare(b.nombre));
      populateSelects();
    }
  }
  closeModal('modalMeta');
  loadMetas(true);
};

window.abonarMontoMeta = async function (id) {
  const monto = prompt('Monto a abonar:');
  if (monto === null) return;
  const cantidad = parseFloat(monto);
  if (!cantidad || cantidad <= 0) { toast('Monto inválido'); return; }
  try {
    const result = await DB.abonarMontoMeta(id, cantidad);
    const meta = metasCache.find(m => m.id === id);
    if (meta) Object.assign(meta, { montoActual: result.montoActual, estado: result.estado });
    if (result.tx) state.transacciones.push(result.tx);
    toast(result.estado === 'Completada' ? '🎉 Meta completada!' : `Abono de ${FMT.format(result.monto)} registrado`);
    loadMetas(true);
    refreshDashboardIfActive();
  } catch (err) {
    toast(err.message);
  }
};

window.abonarMesMeta = async function (id) {
  try {
    const result = await DB.abonarMesMeta(id);
    const meta = metasCache.find(m => m.id === id);
    if (meta) Object.assign(meta, {
      montoActual: result.montoActual,
      estado: result.estado,
      mesesAbonados: result.mesesAbonados,
      ultimoAbonoMes: getCurrentMonth()
    });
    if (result.tx) state.transacciones.push(result.tx);
    toast(result.estado === 'Completada' ? '🎉 Meta completada!' : `Abono de ${FMT.format(result.cuota)} registrado`);
    loadMetas(true);
    refreshDashboardIfActive();
  } catch (err) {
    toast(err.message);
  }
};

window.deleteMeta = async function (id) {
  if (!confirm('Eliminar esta meta?')) return;
  await DB.deleteMeta(id);
  metasCache = metasCache.filter(m => m.id !== id);
  toast('Eliminada');
  loadMetas(true);
};

window.loadMetas = loadMetas;
