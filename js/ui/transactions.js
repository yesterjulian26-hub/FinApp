import { state, populateSelects } from '../app.js';
import * as DB from '../db.js';
import { FMT, getCurrentMonth, formatDate, fechaToMes, parseMonto, esTipo, toast, openModal, closeModal } from '../utils.js';

export function initTransacciones() {
  const buscar = document.getElementById('txBuscar');
  if (buscar) buscar.addEventListener('input', () => { clearTimeout(buscar._t); buscar._t = setTimeout(loadTransacciones, 300); });
}

export async function loadTransacciones() {
  const mes = document.getElementById('txMes')?.value || getCurrentMonth();
  const cuenta = document.getElementById('txCuenta')?.value || '';
  const tipoFilter = document.getElementById('txTipoFilter')?.value || '';
  const buscar = (document.getElementById('txBuscar')?.value || '').toLowerCase();

  let txs = state.transacciones.filter(t => fechaToMes(t.fecha) === mes);
  if (cuenta) txs = txs.filter(t => t.cuenta === cuenta);
  if (tipoFilter) txs = txs.filter(t => esTipo(t.tipo, tipoFilter));
  if (buscar) txs = txs.filter(t =>
    (t.descripcion || '').toLowerCase().includes(buscar) ||
    (t.categoria || '').toLowerCase().includes(buscar)
  );

  txs.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const isMobile = window.innerWidth <= 768;
  const container = document.getElementById('txContent');
  if (!container) return;

  if (txs.length === 0) {
    container.innerHTML = '<div class="empty-state"><div class="icon">📋</div><h3>Sin transacciones</h3><p>Agrega tu primera transaccion</p></div>';
    return;
  }

  if (isMobile) {
    container.innerHTML = txs.map(t => {
      const tipo = String(t.tipo).toLowerCase();
      const icon = getCatIcon(t.categoria);
      return `<div class="tx-mobile-card">
        <div class="tx-mobile-top">
          <div><span class="tx-mobile-cat">${icon} ${t.categoria}</span>
            <span class="tx-mobile-desc">${t.descripcion || ''}</span></div>
          <span class="tx-mobile-monto ${tipo}">${tipo === 'ingreso' ? '+' : '-'}${FMT.format(parseMonto(t.monto))}</span>
        </div>
        <div class="tx-mobile-bottom">
          <span>${formatDate(t.fecha)}</span>
          <span>${t.cuenta || 'General'}</span>
          <div>
            <button class="btn-icon" onclick="window.txEdit('${t.id}')">✏️</button>
            <button class="btn-icon" onclick="window.txDelete('${t.id}')">🗑️</button>
          </div>
        </div>
      </div>`;
    }).join('');
  } else {
    container.innerHTML = `<table class="data-table"><thead><tr>
      <th>Fecha</th><th>Tipo</th><th>Categoria</th><th>Descripcion</th><th>Monto</th><th>Cuenta</th><th></th>
    </tr></thead><tbody>${txs.map(t => {
      const tipo = String(t.tipo).toLowerCase();
      const icon = getCatIcon(t.categoria);
      return `<tr>
        <td>${formatDate(t.fecha)}</td>
        <td><span class="badge ${tipo}">${t.tipo}</span></td>
        <td>${icon} ${t.categoria}</td>
        <td>${t.descripcion || ''}</td>
        <td class="${tipo === 'ingreso' ? 'green' : 'red'}" style="font-weight:600">${FMT.format(parseMonto(t.monto))}</td>
        <td>${t.cuenta || 'General'}</td>
        <td>
          <button class="btn-icon" onclick="window.txEdit('${t.id}')">✏️</button>
          <button class="btn-icon" onclick="window.txDelete('${t.id}')">🗑️</button>
        </td></tr>`;
    }).join('')}</tbody></table>`;
  }
}

function getCatIcon(name) {
  const c = state.categorias.find(cat => cat.nombre === name);
  return c?.icono || '';
}

window.saveTx = async function () {
  const p = {
    fecha: document.getElementById('txFecha').value,
    tipo: document.getElementById('txTipo').value,
    categoria: document.getElementById('txCategoria').value,
    cuenta: document.getElementById('txCuentaSel').value || 'General',
    descripcion: document.getElementById('txDescripcion').value,
    monto: document.getElementById('txMonto').value
  };
  if (!p.monto || !p.categoria) { toast('Completa los campos'); return; }
  const tx = await DB.addTransaccion(p);
  state.transacciones.push(tx);
  closeModal('modalTx');
  toast('Transaccion guardada');
  loadTransacciones();
  document.getElementById('txDescripcion').value = '';
  document.getElementById('txMonto').value = '';
};

window.txEdit = function (id) {
  const tx = state.transacciones.find(t => t.id === id);
  if (!tx) return;
  document.getElementById('editTxId').value = tx.id;
  document.getElementById('editTxFecha').value = tx.fecha;
  document.getElementById('editTxTipo').value = String(tx.tipo).toLowerCase();
  document.getElementById('editTxCategoria').value = tx.categoria;
  document.getElementById('editTxCuenta').value = tx.cuenta || 'General';
  document.getElementById('editTxDescripcion').value = tx.descripcion || '';
  document.getElementById('editTxMonto').value = parseMonto(tx.monto);
  openModal('modalEditTx');
};

window.saveEditTx = async function () {
  const id = document.getElementById('editTxId').value;
  const changes = {
    fecha: document.getElementById('editTxFecha').value,
    tipo: document.getElementById('editTxTipo').value,
    categoria: document.getElementById('editTxCategoria').value,
    cuenta: document.getElementById('editTxCuenta').value,
    descripcion: document.getElementById('editTxDescripcion').value,
    monto: document.getElementById('editTxMonto').value
  };
  await DB.editTransaccion(id, changes);
  const tx = state.transacciones.find(t => t.id === id);
  if (tx) Object.assign(tx, changes, { monto: parseFloat(changes.monto) || 0 });
  closeModal('modalEditTx');
  toast('Transaccion actualizada');
  loadTransacciones();
};

window.txDelete = async function (id) {
  if (!confirm('Eliminar esta transaccion?')) return;
  await DB.deleteTransaccion(id);
  state.transacciones = state.transacciones.filter(t => t.id !== id);
  toast('Eliminada');
  loadTransacciones();
};

window.exportarTransacciones = function () {
  const mes = document.getElementById('txMes')?.value || getCurrentMonth();
  let txs = state.transacciones.filter(t => fechaToMes(t.fecha) === mes);
  if (!txs.length) { toast('No hay transacciones'); return; }
  const headers = ['Fecha', 'Tipo', 'Categoria', 'Descripcion', 'Monto', 'Cuenta'];
  const rows = txs.map(t => [t.fecha, t.tipo, t.categoria, t.descripcion || '', parseMonto(t.monto), t.cuenta || 'General']);
  let csv = '﻿' + headers.join(',') + '\n' + rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `transacciones_${mes}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Exportado');
};

window.loadTransacciones = loadTransacciones;
