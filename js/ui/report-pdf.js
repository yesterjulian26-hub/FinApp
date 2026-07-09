import { state } from '../app.js';
import { FMT, getCurrentMonth, fechaToMes, parseMonto, esTipo, toast } from '../utils.js';

export async function generatePDF() {
  const mes = document.getElementById('repMes')?.value || getCurrentMonth();
  const txs = state.transacciones.filter(t => fechaToMes(t.fecha) === mes);

  const ingresos = txs.filter(t => esTipo(t.tipo, 'ingreso')).reduce((s, t) => s + parseMonto(t.monto), 0);
  const gastos = txs.filter(t => esTipo(t.tipo, 'gasto') || esTipo(t.tipo, 'pago')).reduce((s, t) => s + parseMonto(t.monto), 0);
  const balance = ingresos - gastos;

  const byCategoria = {};
  txs.filter(t => esTipo(t.tipo, 'gasto') || esTipo(t.tipo, 'pago')).forEach(t => {
    byCategoria[t.categoria] = (byCategoria[t.categoria] || 0) + parseMonto(t.monto);
  });
  const sorted = Object.entries(byCategoria).sort((a, b) => b[1] - a[1]);

  const user = state.user;
  const nombre = user?.displayName || user?.email || 'Usuario';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Reporte ${mes}</title>
<style>
  body{font-family:system-ui,sans-serif;margin:40px;color:#2d3436;max-width:800px}
  h1{color:#6c5ce7;margin-bottom:4px}
  .sub{color:#636e72;font-size:14px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse;margin:16px 0}
  th,td{padding:8px 12px;border-bottom:1px solid #dfe6e9;text-align:left;font-size:13px}
  th{background:#f5f6fa;font-weight:600}
  .summary{display:flex;gap:20px;margin:20px 0}
  .sum-card{flex:1;padding:16px;border-radius:12px;text-align:center}
  .sum-card h3{margin:0 0 4px;font-size:13px;color:#636e72}
  .sum-card .val{font-size:22px;font-weight:700}
  .green{color:#00b894}.red{color:#e17055}.blue{color:#6c5ce7}
  @media print{body{margin:20px}}
</style></head><body>
<h1>📊 Reporte Financiero</h1>
<div class="sub">${nombre} · ${mes}</div>
<div class="summary">
  <div class="sum-card" style="background:#f0fff4"><h3>Ingresos</h3><div class="val green">${FMT.format(ingresos)}</div></div>
  <div class="sum-card" style="background:#fff5f5"><h3>Gastos</h3><div class="val red">${FMT.format(gastos)}</div></div>
  <div class="sum-card" style="background:#f5f0ff"><h3>Balance</h3><div class="val blue">${FMT.format(balance)}</div></div>
</div>
<h2>Gastos por Categoría</h2>
<table><thead><tr><th>Categoría</th><th>Monto</th><th>%</th></tr></thead>
<tbody>${sorted.map(([cat, monto]) => {
  const pct = gastos > 0 ? (monto / gastos * 100).toFixed(1) : '0.0';
  return `<tr><td>${cat}</td><td>${FMT.format(monto)}</td><td>${pct}%</td></tr>`;
}).join('')}</tbody></table>
<h2>Transacciones del Mes</h2>
<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Monto</th></tr></thead>
<tbody>${txs.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map(t =>
  `<tr><td>${t.fecha}</td><td>${t.tipo}</td><td>${t.categoria}</td><td>${t.descripcion || ''}</td>
  <td style="color:${esTipo(t.tipo, 'ingreso') ? '#00b894' : '#e17055'}">${FMT.format(parseMonto(t.monto))}</td></tr>`
).join('')}</tbody></table>
<div style="margin-top:30px;text-align:center;color:#b2bec3;font-size:12px">Generado por FinApp · ${new Date().toLocaleDateString()}</div>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { toast('Permite ventanas emergentes para generar el PDF'); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); }, 500);
  toast('PDF generado - usa Ctrl+P para guardar');
}

window.generatePDF = generatePDF;
