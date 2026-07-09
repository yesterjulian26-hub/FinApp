import * as DB from '../db.js';
import { FMT, formatDate, parseMonto, toast, openModal, closeModal } from '../utils.js';

export async function loadMetas() {
  const metas = await DB.getMetas();
  const grid = document.getElementById('metasGrid');
  if (!grid) return;
  if (metas.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">🎯</div><h3>Sin metas</h3><p>Crea tu primera meta de ahorro</p></div>';
    return;
  }
  grid.innerHTML = metas.map(m => {
    const objetivo = parseMonto(m.montoObjetivo);
    const actual = parseMonto(m.montoActual);
    const pct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0;
    const isComplete = m.estado === 'Completada';
    return `<div class="card meta-card">
      <div class="meta-header"><h3>${m.nombre}</h3>
        <span class="meta-badge ${isComplete ? 'completada' : 'activa'}">${m.estado}</span></div>
      ${m.fechaLimite ? `<div style="font-size:12px;color:var(--text2);margin-bottom:8px">Meta: ${formatDate(m.fechaLimite)}</div>` : ''}
      <div class="meta-amounts">${FMT.format(actual)} de ${FMT.format(objetivo)}</div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%;background:${isComplete ? 'var(--accent2)' : 'var(--accent)'}"></div></div>
      <div class="progress-pct">${pct.toFixed(0)}%</div>
      <div style="display:flex;gap:6px;margin-top:12px">
        ${!isComplete ? `<button class="btn btn-primary btn-sm" onclick="window.abonarMeta('${m.id}')">+ Abonar</button>` : ''}
        <button class="btn-icon" onclick="window.deleteMeta('${m.id}')">🗑️</button>
      </div>
    </div>`;
  }).join('');
}

window.saveMeta = async function () {
  const nombre = document.getElementById('metaNombre').value;
  const montoObjetivo = document.getElementById('metaMonto').value;
  const fechaLimite = document.getElementById('metaFecha').value;
  if (!nombre || !montoObjetivo) { toast('Completa los campos'); return; }
  await DB.addMeta({ nombre, montoObjetivo, fechaLimite });
  closeModal('modalMeta');
  toast('Meta creada');
  loadMetas();
};

window.abonarMeta = async function (id) {
  const monto = prompt('Monto a abonar:');
  if (!monto || isNaN(monto)) return;
  const result = await DB.abonarMeta(id, monto);
  toast(result.estado === 'Completada' ? 'Meta completada!' : 'Abono registrado');
  loadMetas();
};

window.deleteMeta = async function (id) {
  if (!confirm('Eliminar esta meta?')) return;
  await DB.deleteMeta(id);
  toast('Eliminada');
  loadMetas();
};

window.loadMetas = loadMetas;
