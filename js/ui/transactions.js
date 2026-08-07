import { state, populateSelects } from '../app.js';
import * as DB from '../db.js';
import { FMT, getCurrentMonth, formatDate, fechaToMes, parseMonto, esTipo, toast, openModal, closeModal } from '../utils.js';

export function initTransacciones() {
  const buscar = document.getElementById('txBuscar');
  if (buscar) buscar.addEventListener('input', () => { clearTimeout(buscar._t); buscar._t = setTimeout(loadTransacciones, 300); });
}

const TX_PAGE_SIZE = 50;
let txVisibleCount = TX_PAGE_SIZE;

export async function loadTransacciones(keepPage) {
  if (!keepPage) txVisibleCount = TX_PAGE_SIZE;

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

  const total = txs.length;
  const visible = txs.slice(0, txVisibleCount);
  const pagination = txVisibleCount < total
    ? `<div style="text-align:center;padding:16px">
        <button class="btn btn-secondary btn-sm" onclick="window.loadMoreTransacciones()">Mostrar más (${visible.length} de ${total})</button>
      </div>`
    : '';

  if (isMobile) {
    container.innerHTML = visible.map(t => {
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
    }).join('') + pagination;
  } else {
    container.innerHTML = `<table class="data-table"><thead><tr>
      <th>Fecha</th><th>Tipo</th><th>Categoria</th><th>Descripcion</th><th>Monto</th><th>Cuenta</th><th></th>
    </tr></thead><tbody>${visible.map(t => {
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
    }).join('')}</tbody></table>${pagination}`;
  }
}

window.loadMoreTransacciones = function () {
  txVisibleCount += TX_PAGE_SIZE;
  loadTransacciones(true);
};

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

// ── Registro por voz ─────────────────────────────────────────

function normalizarTexto(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

const VOICE_MESES = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
  noviembre: 11, diciembre: 12
};

function parseVoiceTransaction(text) {
  let norm = normalizarTexto(text);

  let tipo = 'gasto';
  if (/\b(recibi|ingrese|gane|cobre|deposite|me pagaron|salario|sueldo)\b/.test(norm)) tipo = 'ingreso';
  else if (/\b(ahorre|abone a mi meta|meta de ahorro)\b/.test(norm)) tipo = 'ahorro';
  else if (/\b(pague la cuota|cuota del?|abone al prestamo|pago del prestamo)\b/.test(norm)) tipo = 'pago';
  else if (/\b(gaste|compre|pague)\b/.test(norm)) tipo = 'gasto';

  // Fecha: se busca primero una fecha explícita ("15 de agosto") y se elimina
  // del texto para que ese número no se confunda luego con el monto.
  const hoy = new Date();
  let fecha = hoy.toISOString().slice(0, 10);
  const mesesPattern = Object.keys(VOICE_MESES).join('|');
  const fechaRegex = new RegExp(`\\b(\\d{1,2})\\s+de\\s+(${mesesPattern})(?:\\s+de\\s+(\\d{4}))?\\b`);
  const fechaMatch = norm.match(fechaRegex);
  if (fechaMatch) {
    const dia = parseInt(fechaMatch[1]);
    const mesNum = VOICE_MESES[fechaMatch[2]];
    const anio = fechaMatch[3] ? parseInt(fechaMatch[3]) : hoy.getFullYear();
    const d = new Date(anio, mesNum - 1, dia, 12);
    if (!isNaN(d.getTime())) fecha = d.toISOString().slice(0, 10);
    norm = norm.replace(fechaMatch[0], ' ');
  } else if (/\bantier\b|\banteayer\b/.test(norm)) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 2);
    fecha = d.toISOString().slice(0, 10);
  } else if (/\bayer\b/.test(norm)) {
    const d = new Date(hoy);
    d.setDate(d.getDate() - 1);
    fecha = d.toISOString().slice(0, 10);
  }

  let monto = 0;
  const milMatch = norm.match(/(\d+(?:[.,]\d+)?)\s*mil/);
  if (milMatch) {
    monto = parseFloat(milMatch[1].replace(',', '.')) * 1000;
  } else {
    const numMatch = norm.match(/\d+(?:[.,]\d+)?/);
    if (numMatch) monto = parseFloat(numMatch[0].replace(',', '.'));
  }

  let categoria = '';
  const cats = (state.categorias || []).slice().sort((a, b) => b.nombre.length - a.nombre.length);
  for (const c of cats) {
    if (norm.includes(normalizarTexto(c.nombre))) { categoria = c.nombre; break; }
  }

  let cuenta = '';
  const cuentas = (state.cuentas || []).slice().sort((a, b) => b.nombre.length - a.nombre.length);
  for (const c of cuentas) {
    if (norm.includes(normalizarTexto(c.nombre))) { cuenta = c.nombre; break; }
  }

  return { tipo, monto, categoria, cuenta, fecha, descripcion: text };
}

let voiceRecognition = null;
function getVoiceRecognition() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return null;
  if (!voiceRecognition) {
    voiceRecognition = new SR();
    voiceRecognition.lang = 'es-DO';
    voiceRecognition.interimResults = false;
    voiceRecognition.maxAlternatives = 1;
  }
  return voiceRecognition;
}

// ── Espectro de audio en vivo (Web Audio API) ─────────────────

let voiceStream = null;
let voiceAudioCtx = null;
let voiceAnimFrame = null;

function stopVoiceSpectrum() {
  if (voiceAnimFrame) { cancelAnimationFrame(voiceAnimFrame); voiceAnimFrame = null; }
  if (voiceStream) { voiceStream.getTracks().forEach(t => t.stop()); voiceStream = null; }
  if (voiceAudioCtx) { voiceAudioCtx.close().catch(() => {}); voiceAudioCtx = null; }
}

async function startVoiceSpectrum(container) {
  if (!navigator.mediaDevices?.getUserMedia) return;
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    return;
  }
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  voiceAudioCtx = new AudioCtx();
  const source = voiceAudioCtx.createMediaStreamSource(voiceStream);
  const analyser = voiceAudioCtx.createAnalyser();
  analyser.fftSize = 64;
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const bars = container.querySelectorAll('.voice-bar');

  function draw() {
    analyser.getByteFrequencyData(data);
    bars.forEach((bar, i) => {
      const v = data[i % data.length] / 255;
      bar.style.height = `${6 + v * 44}px`;
    });
    voiceAnimFrame = requestAnimationFrame(draw);
  }
  draw();
}

window.startVoiceTx = function () {
  const rec = getVoiceRecognition();
  if (!rec) { toast('Tu navegador no soporta dictado por voz. Prueba con Chrome.'); return; }

  openModal('modalTx');
  const statusEl = document.getElementById('voiceStatus');
  const spectrumEl = document.getElementById('voiceSpectrum');
  const micBtn = document.getElementById('voiceMicBtn');

  if (statusEl) statusEl.style.display = 'none';
  if (spectrumEl) spectrumEl.style.display = 'flex';
  if (micBtn) micBtn.classList.add('listening');
  if (spectrumEl) startVoiceSpectrum(spectrumEl);

  let resultMessage = null;

  rec.onresult = (e) => {
    const text = e.results[0][0].transcript;
    const parsed = parseVoiceTransaction(text);
    document.getElementById('txTipo').value = parsed.tipo;
    document.getElementById('txFecha').value = parsed.fecha;
    if (parsed.monto) document.getElementById('txMonto').value = parsed.monto;
    if (parsed.categoria) document.getElementById('txCategoria').value = parsed.categoria;
    if (parsed.cuenta) document.getElementById('txCuentaSel').value = parsed.cuenta;
    document.getElementById('txDescripcion').value = parsed.descripcion;
    resultMessage = `✅ Entendí: "${text}" — revisa los campos y guarda.`;
  };
  rec.onerror = () => {
    resultMessage = '❌ No se entendió, intenta de nuevo.';
  };
  rec.onend = () => {
    stopVoiceSpectrum();
    if (spectrumEl) spectrumEl.style.display = 'none';
    if (micBtn) micBtn.classList.remove('listening');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = resultMessage || '❌ No se detectó voz, intenta de nuevo.';
      setTimeout(() => { statusEl.style.display = 'none'; }, 5000);
    }
  };
  rec.start();
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

// ── Importar CSV ──────────────────────────────────────────────

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field); field = '';
    } else if (c === '\n') {
      row.push(field); rows.push(row); row = []; field = '';
    } else if (c !== '\r') {
      field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

function normalizeHeader(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

const CSV_COLUMN_ALIASES = {
  fecha: ['fecha', 'date', 'dia'],
  descripcion: ['descripcion', 'concepto', 'description', 'detalle', 'referencia'],
  monto: ['monto', 'amount', 'valor', 'importe', 'cantidad'],
  tipo: ['tipo', 'type'],
  categoria: ['categoria', 'category', 'rubro'],
  cuenta: ['cuenta', 'account', 'tarjeta']
};

function resolveCsvColumns(headerRow) {
  const norm = headerRow.map(normalizeHeader);
  const idx = {};
  for (const [field, aliases] of Object.entries(CSV_COLUMN_ALIASES)) {
    const i = norm.findIndex(h => aliases.includes(h));
    if (i >= 0) idx[field] = i;
  }
  return idx;
}

function parseCsvDate(s) {
  s = (s || '').trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

function csvRowsToTransactions(rows) {
  if (rows.length < 2) return null;
  const idx = resolveCsvColumns(rows[0]);
  if (idx.fecha === undefined || idx.monto === undefined) return null;

  return rows.slice(1).map(r => {
    const montoRaw = (r[idx.monto] || '0').replace(/[^0-9.,\-]/g, '').replace(',', '.');
    const montoNum = parseFloat(montoRaw) || 0;
    let tipo = idx.tipo !== undefined ? (r[idx.tipo] || '').toLowerCase().trim() : '';
    if (!['ingreso', 'gasto', 'pago', 'ahorro'].includes(tipo)) {
      tipo = montoNum < 0 ? 'gasto' : 'ingreso';
    }
    return {
      fecha: parseCsvDate(r[idx.fecha]),
      tipo,
      categoria: idx.categoria !== undefined ? (r[idx.categoria] || 'Otros').trim() : 'Otros',
      descripcion: idx.descripcion !== undefined ? (r[idx.descripcion] || '').trim() : '',
      monto: Math.abs(montoNum),
      cuenta: idx.cuenta !== undefined ? (r[idx.cuenta] || 'General').trim() : 'General'
    };
  }).filter(t => t.monto > 0);
}

let pendingImportRows = null;

window.handleCsvFile = function (e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const rows = parseCSV(String(reader.result));
    const parsed = csvRowsToTransactions(rows);
    if (!parsed) { toast('No se detectaron columnas de Fecha y Monto en el CSV'); e.target.value = ''; return; }
    if (!parsed.length) { toast('No se encontraron transacciones válidas en el archivo'); e.target.value = ''; return; }

    pendingImportRows = parsed;
    document.getElementById('importCsvSummary').textContent =
      `Se detectaron ${parsed.length} transacciones. Revisa una muestra antes de importar:`;
    document.getElementById('importCsvPreview').innerHTML = parsed.slice(0, 8).map(t =>
      `<tr><td>${formatDate(t.fecha)}</td><td>${t.tipo}</td><td>${t.categoria}</td><td>${t.descripcion}</td><td>${FMT.format(t.monto)}</td></tr>`
    ).join('') + (parsed.length > 8 ? `<tr><td colspan="5" style="text-align:center;color:var(--text2)">... y ${parsed.length - 8} más</td></tr>` : '');
    openModal('modalImportCsv');
    e.target.value = '';
  };
  reader.readAsText(file);
};

window.confirmImportCsv = async function () {
  if (!pendingImportRows || !pendingImportRows.length) return;
  const rows = pendingImportRows;
  pendingImportRows = null;
  closeModal('modalImportCsv');
  toast('Importando transacciones...');
  try {
    const created = await DB.importTransacciones(rows);
    state.transacciones.push(...created);
    toast(`${created.length} transacciones importadas`);
    loadTransacciones();
  } catch (err) {
    toast('Error al importar: ' + err.message);
  }
};

window.loadTransacciones = loadTransacciones;
