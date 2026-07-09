import { state } from '../app.js';
import { FMT, getCurrentMonth, fechaToMes, parseMonto, esTipo, animateValue } from '../utils.js';

export async function loadDashboard() {
  const mes = document.getElementById('dashMes')?.value || getCurrentMonth();
  const cuenta = document.getElementById('dashCuenta')?.value || '';
  const txs = state.transacciones;

  const data = txs.filter(t => {
    if (fechaToMes(t.fecha) !== mes) return false;
    if (cuenta && t.cuenta !== cuenta) return false;
    return true;
  });

  let ingresos = 0, gastos = 0, pagos = 0, ahorro = 0;
  const porCat = {};
  data.forEach(t => {
    const m = parseMonto(t.monto);
    if (esTipo(t.tipo, 'ingreso')) ingresos += m;
    else if (esTipo(t.tipo, 'pago')) { pagos += m; porCat[t.categoria] = (porCat[t.categoria] || 0) + m; }
    else if (esTipo(t.tipo, 'ahorro')) { ahorro += m; porCat[t.categoria] = (porCat[t.categoria] || 0) + m; }
    else { gastos += m; porCat[t.categoria] = (porCat[t.categoria] || 0) + m; }
  });
  const balance = ingresos - gastos - pagos - ahorro;
  const tasa = ingresos > 0 ? ((balance / ingresos) * 100).toFixed(0) : 0;

  animateValue(document.getElementById('kpiIngresos'), 0, ingresos, 600);
  animateValue(document.getElementById('kpiGastos'), 0, gastos, 600);
  animateValue(document.getElementById('kpiPagos'), 0, pagos, 600);
  animateValue(document.getElementById('kpiBalance'), 0, balance, 600);
  animateValue(document.getElementById('kpiAhorroMonto'), 0, ahorro, 600);

  const balEl = document.getElementById('kpiBalance');
  if (balEl) balEl.className = 'value ' + (balance >= 0 ? 'green' : 'red');
  const ahorroEl = document.getElementById('kpiAhorro');
  if (ahorroEl) ahorroEl.textContent = tasa + '%';

  renderBarChart(mes, cuenta);
  renderDoughnut(porCat);
  loadAlerts();
}

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
  const entries = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (entries.length === 0) { el.innerHTML = '<div style="text-align:center;color:var(--text2);padding:40px">Sin gastos</div>'; return; }

  const total = entries.reduce((s, [, v]) => s + v, 0);
  const colors = ['#6c5ce7', '#00b894', '#e74c3c', '#0984e3', '#fdcb6e', '#e17055'];

  let offset = 0;
  const segments = entries.map(([cat, monto], i) => {
    const pct = (monto / total) * 100;
    const catData = state.categorias.find(c => c.nombre === cat);
    const color = catData?.color || colors[i % colors.length];
    const seg = `${color} ${offset}% ${offset + pct}%`;
    offset += pct;
    return { cat, monto, pct, color, icono: catData?.icono || '' };
  });

  const gradStr = segments.map(s => `${s.color} ${(offset - s.pct - (offset - segments.reduce((a, b) => a + b.pct, 0)))}%`);
  let grad = '';
  let pos = 0;
  segments.forEach(s => {
    grad += `${s.color} ${pos}% ${pos + s.pct}%, `;
    pos += s.pct;
  });
  grad = grad.slice(0, -2);

  el.innerHTML = `<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">
    <div style="width:140px;height:140px;border-radius:50%;background:conic-gradient(${grad});position:relative;flex-shrink:0">
      <div style="position:absolute;inset:30px;border-radius:50%;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:14px;color:var(--text)">${FMT.format(total)}</div>
    </div>
    <div style="flex:1;min-width:150px">${segments.map(s => `
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;font-size:13px">
        <div style="width:10px;height:10px;border-radius:50%;background:${s.color};flex-shrink:0"></div>
        <span style="flex:1">${s.icono} ${s.cat}</span>
        <strong>${s.pct.toFixed(0)}%</strong>
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
