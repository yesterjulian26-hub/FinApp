import { state, populateSelects } from '../app.js';
import * as DB from '../db.js';
import { FMT, parseMonto, esTipo, toast, openModal, closeModal, CUENTA_ICONS } from '../utils.js';

export async function loadCuentas() {
  state.cuentas = await DB.getCuentas();
  const grid = document.getElementById('cuentasGrid');
  if (!grid) return;
  if (state.cuentas.length === 0) {
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="icon">🏦</div><h3>Sin cuentas</h3><p>Agrega tu primera cuenta</p></div>';
    populateSelects();
    return;
  }

  const txs = state.transacciones;
  grid.innerHTML = state.cuentas.map(c => {
    let saldo = parseMonto(c.saldoInicial);
    txs.forEach(t => {
      if ((t.cuenta || 'General') !== c.nombre) return;
      const m = parseMonto(t.monto);
      saldo += esTipo(t.tipo, 'ingreso') ? m : -m;
    });
    const icon = CUENTA_ICONS[c.tipo] || '💰';
    return `<div class="card meta-card">
      <div class="meta-header"><h3>${icon} ${c.nombre}</h3>
        <button class="btn-icon" onclick="window.deleteCuenta('${c.id}')">🗑️</button></div>
      <div style="font-size:12px;color:var(--text2);margin-bottom:8px">${c.tipo}</div>
      <div style="font-size:22px;font-weight:700;color:${saldo >= 0 ? 'var(--accent2)' : 'var(--red)'}">${FMT.format(saldo)}</div>
    </div>`;
  }).join('');
  populateSelects();
}

window.saveCuenta = async function () {
  const nombre = document.getElementById('cuentaNombre').value;
  const tipo = document.getElementById('cuentaTipo').value;
  const saldoInicial = document.getElementById('cuentaSaldo').value || '0';
  if (!nombre) { toast('Ingresa un nombre'); return; }
  await DB.addCuenta({ nombre, tipo, saldoInicial });
  closeModal('modalCuenta');
  toast('Cuenta creada');
  loadCuentas();
};

window.deleteCuenta = async function (id) {
  if (!confirm('Eliminar esta cuenta?')) return;
  await DB.deleteCuenta(id);
  toast('Eliminada');
  loadCuentas();
};

window.openTransferencia = function () {
  document.getElementById('transfFecha').value = new Date().toISOString().slice(0, 10);
  document.getElementById('transfMonto').value = '';
  document.getElementById('transfDesc').value = '';
  openModal('modalTransferir');
};

window.saveTransferencia = async function () {
  const origen = document.getElementById('transfOrigen').value;
  const destino = document.getElementById('transfDestino').value;
  const monto = document.getElementById('transfMonto').value;
  const fecha = document.getElementById('transfFecha').value;
  const descripcion = document.getElementById('transfDesc').value;
  if (!origen || !destino) { toast('Selecciona origen y destino'); return; }
  if (origen === destino) { toast('Deben ser diferentes'); return; }
  if (!monto || parseFloat(monto) <= 0) { toast('Monto invalido'); return; }
  await DB.transferir({ origen, destino, monto, fecha, descripcion });
  state.transacciones = await DB.getTransacciones();
  closeModal('modalTransferir');
  toast('Transferencia registrada');
  loadCuentas();
};

window.loadCuentas = loadCuentas;
