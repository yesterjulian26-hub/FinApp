import { state } from '../app.js';
import { FMT, getCurrentMonth, fechaToMes, parseMonto, esTipo, animateValue } from '../utils.js';

function bucketize(txs) {
  let ingresos = 0, gastos = 0, pagos = 0, ahorro = 0;
  const porCat = {};
  txs.forEach(t => {
    const m = parseMonto(t.monto);
    if (esTipo(t.tipo, 'ingreso')) ingresos += m;
    else if (esTipo(t.tipo, 'pago')) { pagos += m; addCat(porCat, t.categoria, m); }
    else if (esTipo(t.tipo, 'ahorro')) { ahorro += m; addCat(porCat, t.categoria, m); }
    else { gastos += m; addCat(porCat, t.categoria, m); }
  });
  return { ingresos, gastos, pagos, ahorro, porCat };
}

function addCat(porCat, categoria, monto) {
  if (!porCat[categoria]) porCat[categoria] = { monto: 0, count: 0 };
  porCat[categoria].monto += monto;
  porCat[categoria].count += 1;
}

function proyeccionRecurrentesMes(mes, cuenta) {
  const inicio = `${mes}-01`;
  const [y, m] = mes.split('-').map(Number);
  const fin = new Date(y, m, 0).toISOString().slice(0, 10);
  let ingresos = 0, gastos = 0, pagos = 0, ahorro = 0, count = 0;

  (state.recurrentes || []).forEach(r => {
    if (!r.proximaFecha) return;
    if (cuenta && r.cuenta !== cuenta) return;
    const frec = String(r.frecuencia || '').toLowerCase();
    const tipo = String(r.tipo || '').toLowerCase();
    const monto = parseMonto(r.monto);
    const d = new Date(r.proximaFecha);
    let guard = 0;
    while (guard < 60) {
      const fechaStr = d.toISOString().slice(0, 10);
      if (fechaStr > fin) break;
      if (fechaStr >= inicio) {
        if (tipo === 'ingreso') ingresos += monto;
        else if (tipo === 'pago') pagos += monto;
        else if (tipo === 'ahorro') ahorro += monto;
        else gastos += monto;
        count++;
      }
      if (frec === 'semanal') d.setDate(d.getDate() + 7);
      else if (frec === 'quincenal') d.setDate(d.getDate() + 15);
      else if (frec === 'anual') d.setFullYear(d.getFullYear() + 1);
      else d.setMonth(d.getMonth() + 1);
      guard++;
    }
  });

  return { ingresos, gastos, pagos, ahorro, count };
}

function mesAnterior(mes) {
  const [y, m] = mes.split('-').map(Number);
  let pm = m - 1, py = y;
  if (pm <= 0) { pm = 12; py--; }
  return `${py}-${String(pm).padStart(2, '0')}`;
}

function renderDelta(elId, actual, previo, masEsBueno) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (previo <= 0) { el.style.display = 'none'; return; }
  const pct = ((actual - previo) / previo) * 100;
  const subio = pct >= 0;
  const esBueno = masEsBueno ? subio : !subio;
  el.style.display = 'inline-flex';
  el.className = 'delta-badge ' + (esBueno ? 'up-good' : 'up-bad');
  el.textContent = `${subio ? '↗' : '↘'} ${Math.abs(pct).toFixed(1)}%`;
}

export async function loadDashboard() {
  applyStoredBalanceVisibility();
  const mes = document.getElementById('dashMes')?.value || getCurrentMonth();
  const cuenta = document.getElementById('dashCuenta')?.value || '';
  const txs = state.transacciones;

  const data = txs.filter(t => {
    if (fechaToMes(t.fecha) !== mes) return false;
    if (cuenta && t.cuenta !== cuenta) return false;
    return true;
  });
  const dataPrev = txs.filter(t => {
    if (fechaToMes(t.fecha) !== mesAnterior(mes)) return false;
    if (cuenta && t.cuenta !== cuenta) return false;
    return true;
  });

  const { ingresos: ingresosReal, gastos: gastosReal, pagos: pagosReal, ahorro: ahorroReal, porCat } = bucketize(data);
  const { ingresos: ingresosPrev, gastos: gastosPrev } = bucketize(dataPrev);

  const esMesActual = mes === getCurrentMonth();
  const preview = esMesActual ? proyeccionRecurrentesMes(mes, cuenta) : { ingresos: 0, gastos: 0, pagos: 0, ahorro: 0, count: 0 };

  const ingresos = ingresosReal + preview.ingresos;
  const gastos = gastosReal + preview.gastos;
  const pagos = pagosReal + preview.pagos;
  const ahorro = ahorroReal + preview.ahorro;
  const balance = ingresos - gastos - pagos - ahorro;
  const tasa = ingresos > 0 ? ((balance / ingresos) * 100).toFixed(0) : 0;

  animateValue(document.getElementById('kpiIngresos'), 0, ingresos, 600);
  animateValue(document.getElementById('kpiGastos'), 0, gastos, 600);
  animateValue(document.getElementById('kpiPagos'), 0, pagos, 600);
  animateValue(document.getElementById('kpiBalance'), 0, balance, 600);
  animateValue(document.getElementById('kpiAhorroMonto'), 0, ahorro, 600);

  renderDelta('deltaIngresos', ingresos, ingresosPrev, true);
  renderDelta('deltaGastos', gastos, gastosPrev, false);

  const balEl = document.getElementById('kpiBalance');
  if (balEl) balEl.className = 'balance-hero-value ' + (balance >= 0 ? 'green' : 'red');
  const ahorroEl = document.getElementById('kpiAhorro');
  if (ahorroEl) ahorroEl.textContent = tasa + '%';

  const previstoEl = document.getElementById('previstoNote');
  if (previstoEl) {
    const netoPrevisto = preview.ingresos - preview.gastos - preview.pagos - preview.ahorro;
    if (preview.count > 0) {
      previstoEl.style.display = 'block';
      previstoEl.textContent = `📅 Incluye ${netoPrevisto >= 0 ? '+' : ''}${FMT.format(netoPrevisto)} previsto de ${preview.count} movimiento${preview.count === 1 ? '' : 's'} recurrente${preview.count === 1 ? '' : 's'} pendiente${preview.count === 1 ? '' : 's'} este mes`;
    } else {
      previstoEl.style.display = 'none';
    }
  }

  renderBarChart(mes, cuenta);
  renderDoughnut(porCat);
  loadAlerts();
}

function applyStoredBalanceVisibility() {
  const wrap = document.getElementById('balanceValueWrap');
  const btn = document.getElementById('balanceEyeBtn');
  if (!wrap) return;
  const hidden = localStorage.getItem('finapp_hide_balance') === 'true';
  wrap.classList.toggle('hidden', hidden);
  if (btn) btn.textContent = hidden ? '🙈' : '👁️';
}

window.toggleBalanceVisibility = function () {
  const wrap = document.getElementById('balanceValueWrap');
  const btn = document.getElementById('balanceEyeBtn');
  if (!wrap) return;
  const hidden = wrap.classList.toggle('hidden');
  localStorage.setItem('finapp_hide_balance', hidden ? 'true' : 'false');
  if (btn) btn.textContent = hidden ? '🙈' : '👁️';
};

function renderBarChart(selectedMes, cuenta) {
  const txs = state.transacciones;
  const months = {};
  txs.forEach(t => {
    if (cuenta && t.cuenta !== cuenta) return;
    const m = fechaToMes(t.fecha);
    if (!m) return;
    if (!months[m]) months[m] = { ingresos: 0, gastos: 0, pagos: 0 };
    const monto = parseMonto(t.monto);
    if (esTipo(t.tipo, 'ingreso')) months[m].ingresos += monto;
    else if (esTipo(t.tipo, 'pago')) months[m].pagos += monto;
    else months[m].gastos += monto;
  });

  const sorted = Object.keys(months).sort().slice(-6);
  const maxVal = Math.max(...sorted.map(m => Math.max(months[m].ingresos, months[m].gastos + months[m].pagos)), 1);

  const el = document.getElementById('barChart');
  if (!el) return;
  el.innerHTML = sorted.map(m => {
    const d = months[m];
    const hI = (d.ingresos / maxVal * 150).toFixed(0);
    const hG = ((d.gastos + d.pagos) / maxVal * 150).toFixed(0);
    const isSel = m === selectedMes;
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;min-width:50px">
      <div style="display:flex;gap:3px;align-items:flex-end;height:150px">
        <div style="width:18px;height:${hI}px;background:var(--accent2);border-radius:4px 4px 0 0;opacity:${isSel?1:.5}"></div>
        <div style="width:18px;height:${hG}px;background:var(--red);border-radius:4px 4px 0 0;opacity:${isSel?1:.5}"></div>
      </div>
      <span style="font-size:11px;font-weight:${isSel?700:400};color:${isSel?'var(--accent)':'var(--text2)'}">${m.slice(5)}</span>
    </div>`;
  }).join('');
}

function renderDoughnut(porCat) {
  const el = document.getElementById('doughnutChart');
  if (!el) return;
  const entries = Object.entries(porCat).sort((a, b) => b[1].monto - a[1].monto).slice(0, 6);
  if (entries.length === 0) { el.innerHTML = '<div style="text-align:center;color:var(--text2);padding:40px">Sin gastos</div>'; return; }

  const total = entries.reduce((s, [, v]) => s + v.monto, 0);
  const colors = ['#6c5ce7', '#00b894', '#e74c3c', '#0984e3', '#fdcb6e', '#e17055'];

  const segments = entries.map(([cat, v], i) => {
    const pct = (v.monto / total) * 100;
    const catData = state.categorias.find(c => c.nombre === cat);
    const color = catData?.color || colors[i % colors.length];
    return { cat, monto: v.monto, count: v.count, pct, color, icono: catData?.icono || '📦' };
  });

  let grad = '';
  let pos = 0;
  segments.forEach(s => {
    grad += `${s.color} ${pos}% ${pos + s.pct}%, `;
    pos += s.pct;
  });
  grad = grad.slice(0, -2);

  el.innerHTML = `<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
    <div style="width:140px;height:140px;border-radius:50%;background:conic-gradient(${grad});position:relative;flex-shrink:0">
      <div style="position:absolute;inset:30px;border-radius:50%;background:var(--bg2);display:flex;flex-direction:column;align-items:center;justify-content:center">
        <span style="font-size:10px;color:var(--text2);font-weight:600;text-transform:uppercase">Total</span>
        <span style="font-weight:800;font-size:14px;color:var(--text)">${FMT.format(total)}</span>
      </div>
    </div>
    <div style="flex:1;min-width:200px">${segments.map(s => `
      <div class="cat-row">
        <div class="cat-avatar" style="background:${s.color}22;color:${s.color}">${s.icono}</div>
        <div class="cat-row-info">
          <div class="cat-row-name">${s.cat}</div>
          <div class="cat-row-count">${s.count} transacci${s.count === 1 ? 'ón' : 'ones'}</div>
        </div>
        <div class="cat-row-amounts">
          <div class="cat-row-amount">${FMT.format(s.monto)}</div>
          <div class="cat-row-pct">${s.pct.toFixed(0)}%</div>
        </div>
      </div>`).join('')}
    </div>
  </div>`;
}

async function loadAlerts() {
  const banner = document.getElementById('alertBanner');
  if (!banner) return;
  const alerts = [];
  const today = new Date();
  const in7 = new Date(today); in7.setDate(in7.getDate() + 7);

  try {
    const [prestRes, presRes] = await Promise.all([
      import('../db.js').then(m => m.getPrestamos()),
      import('../db.js').then(m => m.getPresupuestos())
    ]);

    prestRes.filter(p => p.estado === 'Activo').forEach(pr => {
      (pr.cuotas_detalle || []).forEach(c => {
        if (c.estado === 'Pagada') return;
        const fv = new Date(c.fechaVencimiento);
        if (fv <= in7) {
          const overdue = fv < today;
          alerts.push({
            type: overdue ? 'danger' : 'warn',
            text: `${overdue ? '🚨 Vencida' : '⏰ Proxima'}: Cuota #${c.numero} de "${pr.nombre}" — ${FMT.format(parseMonto(pr.montoCuota))} el ${c.fechaVencimiento}`
          });
        }
      });
    });

    const mes = getCurrentMonth();
    const spent = {};
    state.transacciones.filter(t => fechaToMes(t.fecha) === mes && !esTipo(t.tipo, 'ingreso'))
      .forEach(t => { spent[t.categoria] = (spent[t.categoria] || 0) + parseMonto(t.monto); });

    presRes.forEach(p => {
      const limite = parseMonto(p.montoLimite);
      const gastado = spent[p.categoria] || 0;
      const pct = limite > 0 ? (gastado / limite) * 100 : 0;
      if (pct >= 100) alerts.push({ type: 'danger', text: `🚨 Presupuesto "${p.categoria}" excedido: ${pct.toFixed(0)}%` });
      else if (pct >= 80) alerts.push({ type: 'warn', text: `⚠️ Presupuesto "${p.categoria}" al ${pct.toFixed(0)}%` });
    });
  } catch (e) {}

  banner.style.display = alerts.length ? 'block' : 'none';
  banner.innerHTML = alerts.map(a => `<div class="alert-card ${a.type}">${a.text}</div>`).join('');
}

// Make loadDashboard callable from onchange
window.loadDashboard = loadDashboard;
