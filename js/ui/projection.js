import { state } from '../app.js';
import { FMT, getCurrentMonth, fechaToMes, parseMonto, esTipo } from '../utils.js';

export async function loadProyeccion() {
  const txs = state.transacciones;
  const hoy = new Date();
  const months = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const ingHist = months.map(m => txs.filter(t => fechaToMes(t.fecha) === m && esTipo(t.tipo, 'ingreso')).reduce((s, t) => s + parseMonto(t.monto), 0));
  const gasHist = months.map(m => txs.filter(t => fechaToMes(t.fecha) === m && (esTipo(t.tipo, 'gasto') || esTipo(t.tipo, 'pago'))).reduce((s, t) => s + parseMonto(t.monto), 0));

  const avgIng = ingHist.reduce((a, b) => a + b, 0) / Math.max(ingHist.filter(v => v > 0).length, 1);
  const avgGas = gasHist.reduce((a, b) => a + b, 0) / Math.max(gasHist.filter(v => v > 0).length, 1);

  const trend = (arr) => {
    const n = arr.length;
    if (n < 2) return 0;
    const xm = (n - 1) / 2;
    const ym = arr.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    arr.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2; });
    return den === 0 ? 0 : num / den;
  };

  const trendIng = trend(ingHist);
  const trendGas = trend(gasHist);

  const futureMonths = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    futureMonths.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const projIng = futureMonths.map((_, i) => Math.max(0, avgIng + trendIng * (i + 1)));
  const projGas = futureMonths.map((_, i) => Math.max(0, avgGas + trendGas * (i + 1)));
  const projBal = projIng.map((ing, i) => ing - projGas[i]);

  let saldoAcum = 0;
  const cuentas = state.cuentas || [];
  cuentas.forEach(c => { saldoAcum += parseMonto(c.saldoInicial); });
  txs.forEach(t => {
    const m = parseMonto(t.monto);
    saldoAcum += esTipo(t.tipo, 'ingreso') ? m : -m;
  });

  const acumulado = projBal.map(b => { saldoAcum += b; return saldoAcum; });

  const tbody = document.getElementById('projBody');
  if (tbody) {
    tbody.innerHTML = futureMonths.map((mes, i) => `<tr>
      <td>${mes}</td>
      <td style="color:var(--accent2)">${FMT.format(projIng[i])}</td>
      <td style="color:var(--red)">${FMT.format(projGas[i])}</td>
      <td style="color:${projBal[i] >= 0 ? 'var(--accent2)' : 'var(--red)'}; font-weight:600">${FMT.format(projBal[i])}</td>
      <td style="font-weight:700;color:${acumulado[i] >= 0 ? 'var(--accent2)' : 'var(--red)'}">${FMT.format(acumulado[i])}</td>
    </tr>`).join('');
  }

  renderProjectionChart(futureMonths, projIng, projGas, acumulado);

  const insightsEl = document.getElementById('projInsights');
  if (insightsEl) {
    const insights = [];
    if (trendGas > 0) insights.push('📈 Tendencia de gastos al alza. Considera ajustar tu presupuesto.');
    if (trendIng > 0) insights.push('📈 Tus ingresos muestran tendencia positiva.');
    if (acumulado[5] < 0) insights.push('⚠️ Proyección muestra saldo negativo en 6 meses.');
    if (avgGas > avgIng) insights.push('🚨 Tus gastos promedio superan tus ingresos.');
    if (avgIng > avgGas * 1.3) insights.push('🎉 Buena salud financiera. Mantienes un margen de ahorro saludable.');
    insightsEl.innerHTML = insights.length
      ? insights.map(i => `<div class="insight-item">${i}</div>`).join('')
      : '<div class="insight-item">Agrega más transacciones para mejorar la proyección.</div>';
  }
}

function renderProjectionChart(months, ing, gas, acum) {
  const canvas = document.getElementById('projChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width = canvas.parentElement.clientWidth;
  const H = canvas.height = 220;
  ctx.clearRect(0, 0, W, H);

  const allVals = [...ing, ...gas, ...acum];
  const maxVal = Math.max(...allVals, 1);
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 1;
  const pad = { t: 20, b: 30, l: 10, r: 10 };
  const chartW = W - pad.l - pad.r;
  const chartH = H - pad.t - pad.b;

  const drawLine = (data, color, dashed) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.setLineDash(dashed ? [6, 4] : []);
    data.forEach((v, i) => {
      const x = pad.l + (i / (data.length - 1)) * chartW;
      const yp = pad.t + chartH - ((v - minVal) / range) * chartH;
      i === 0 ? ctx.moveTo(x, yp) : ctx.lineTo(x, yp);
    });
    ctx.stroke();
    ctx.setLineDash([]);
  };

  drawLine(ing, '#00b894', true);
  drawLine(gas, '#e17055', true);
  drawLine(acum, '#6c5ce7', false);

  ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--text2') || '#999';
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'center';
  months.forEach((mes, i) => {
    const x = pad.l + (i / (months.length - 1)) * chartW;
    ctx.fillText(mes.slice(5), x, H - 5);
  });
}

window.loadProyeccion = loadProyeccion;
