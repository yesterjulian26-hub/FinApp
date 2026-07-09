import { state } from '../app.js';
import { FMT, getCurrentMonth, fechaToMes, parseMonto, esTipo } from '../utils.js';

export async function loadReportes() {
  const mes = document.getElementById('repMes')?.value || getCurrentMonth();
  const txs = state.transacciones.filter(t => fechaToMes(t.fecha) === mes);

  const ingresos = txs.filter(t => esTipo(t.tipo, 'ingreso')).reduce((s, t) => s + parseMonto(t.monto), 0);
  const gastos = txs.filter(t => esTipo(t.tipo, 'gasto') || esTipo(t.tipo, 'pago') || esTipo(t.tipo, 'ahorro')).reduce((s, t) => s + parseMonto(t.monto), 0);
  const balance = ingresos - gastos;
  const tasa = ingresos > 0 ? ((ingresos - gastos) / ingresos * 100) : 0;

  document.getElementById('repIngresos').textContent = FMT.format(ingresos);
  document.getElementById('repGastos').textContent = FMT.format(gastos);
  document.getElementById('repBalance').textContent = FMT.format(balance);
  document.getElementById('repBalance').style.color = balance >= 0 ? 'var(--accent2)' : 'var(--red)';
  document.getElementById('repTasa').textContent = tasa.toFixed(1) + '%';

  const byCategoria = {};
  txs.filter(t => esTipo(t.tipo, 'gasto') || esTipo(t.tipo, 'pago') || esTipo(t.tipo, 'ahorro')).forEach(t => {
    byCategoria[t.categoria] = (byCategoria[t.categoria] || 0) + parseMonto(t.monto);
  });

  const sorted = Object.entries(byCategoria).sort((a, b) => b[1] - a[1]);
  const catBody = document.getElementById('repCatBody');
  if (catBody) {
    catBody.innerHTML = sorted.map(([cat, monto]) => {
      const pct = gastos > 0 ? (monto / gastos * 100) : 0;
      const icon = (state.categorias.find(c => c.nombre === cat) || {}).icono || '';
      return `<tr>
        <td>${icon} ${cat}</td>
        <td style="font-weight:600">${FMT.format(monto)}</td>
        <td>${pct.toFixed(1)}%</td>
        <td><div class="progress-bar" style="width:120px"><div class="progress-fill" style="width:${pct}%"></div></div></td>
      </tr>`;
    }).join('');
  }

  renderTrendChart(mes);
  renderInsights(mes, ingresos, gastos, sorted);
}

function renderTrendChart(currentMes) {
  const canvas = document.getElementById('repTrendChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.parentElement.clientWidth;
  const H = canvas.height = 200;
  ctx.clearRect(0, 0, W, H);

  const months = [];
  const [y, m] = currentMes.split('-').map(Number);
  for (let i = 5; i >= 0; i--) {
    let nm = m - i, ny = y;
    if (nm <= 0) { nm += 12; ny--; }
    months.push(`${ny}-${String(nm).padStart(2, '0')}`);
  }

  const ingData = months.map(mes =>
    state.transacciones.filter(t => fechaToMes(t.fecha) === mes && esTipo(t.tipo, 'ingreso'))
      .reduce((s, t) => s + parseMonto(t.monto), 0));
  const gasData = months.map(mes =>
    state.transacciones.filter(t => fechaToMes(t.fecha) === mes && (esTipo(t.tipo, 'gasto') || esTipo(t.tipo, 'pago') || esTipo(t.tipo, 'ahorro')))
      .reduce((s, t) => s + parseMonto(t.monto), 0));

  const maxVal = Math.max(...ingData, ...gasData, 1);
  const pad = { t: 20, b: 30, l: 10, r: 10 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;

  const drawLine = (data, color) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    data.forEach((v, i) => {
      const x = pad.l + (i / (data.length - 1)) * chartW;
      const yp = pad.t + chartH - (v / maxVal) * chartH;
      i === 0 ? ctx.moveTo(x, yp) : ctx.lineTo(x, yp);
    });
    ctx.stroke();
    data.forEach((v, i) => {
      const x = pad.l + (i / (data.length - 1)) * chartW;
      const yp = pad.t + chartH - (v / maxVal) * chartH;
      ctx.beginPath();
      ctx.arc(x, yp, 4, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
    });
  };

  drawLine(ingData, '#00b894');
  drawLine(gasData, '#e17055');

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text2') || '#999';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  months.forEach((mes, i) => {
    const x = pad.l + (i / (months.length - 1)) * chartW;
    ctx.fillText(mes.slice(5), x, H - 5);
  });
}

function renderInsights(mes, ingresos, gastos, sorted) {
  const container = document.getElementById('repInsights');
  if (!container) return;
  const insights = [];

  if (gastos > ingresos) insights.push('⚠️ Gastaste más de lo que ingresaste este mes.');
  if (sorted.length > 0) insights.push(`💡 Tu mayor gasto fue en "${sorted[0][0]}" con ${FMT.format(sorted[0][1])}.`);

  const [y, m] = mes.split('-').map(Number);
  let pm = m - 1, py = y;
  if (pm <= 0) { pm = 12; py--; }
  const prevMes = `${py}-${String(pm).padStart(2, '0')}`;
  const prevGastos = state.transacciones.filter(t => fechaToMes(t.fecha) === prevMes && (esTipo(t.tipo, 'gasto') || esTipo(t.tipo, 'pago') || esTipo(t.tipo, 'ahorro')))
    .reduce((s, t) => s + parseMonto(t.monto), 0);
  if (prevGastos > 0) {
    const diff = ((gastos - prevGastos) / prevGastos * 100).toFixed(0);
    insights.push(diff > 0 ? `📈 Gastos subieron ${diff}% vs mes anterior.` : `📉 Gastos bajaron ${Math.abs(diff)}% vs mes anterior.`);
  }

  const tasaAhorro = ingresos > 0 ? ((ingresos - gastos) / ingresos * 100) : 0;
  if (tasaAhorro >= 20) insights.push('🎉 Excelente tasa de ahorro!');
  else if (tasaAhorro >= 0) insights.push('💪 Intenta ahorrar al menos un 20% de tus ingresos.');

  container.innerHTML = insights.length
    ? insights.map(i => `<div class="insight-item">${i}</div>`).join('')
    : '<div class="insight-item">No hay suficientes datos para generar insights.</div>';
}

window.loadReportes = loadReportes;
