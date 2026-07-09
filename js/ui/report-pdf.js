import { state } from '../app.js';
import * as DB from '../db.js';
import { FMT, getCurrentMonth, fechaToMes, formatDate, parseMonto, esTipo, toast } from '../utils.js';

function saldoCuenta(cuenta) {
  let saldo = parseMonto(cuenta.saldoInicial);
  state.transacciones.forEach(t => {
    if ((t.cuenta || 'General') !== cuenta.nombre) return;
    const m = parseMonto(t.monto);
    saldo += esTipo(t.tipo, 'ingreso') ? m : -m;
  });
  return saldo;
}

function ultimosMeses(mesRef, cantidad) {
  const [y, m] = mesRef.split('-').map(Number);
  const meses = [];
  for (let i = cantidad - 1; i >= 0; i--) {
    let nm = m - i, ny = y;
    if (nm <= 0) { nm += 12; ny--; }
    meses.push(`${ny}-${String(nm).padStart(2, '0')}`);
  }
  return meses;
}

function proximosMeses(mesRef, cantidad) {
  const [y, m] = mesRef.split('-').map(Number);
  const meses = [];
  for (let i = 1; i <= cantidad; i++) {
    let nm = m + i, ny = y;
    while (nm > 12) { nm -= 12; ny++; }
    meses.push(`${ny}-${String(nm).padStart(2, '0')}`);
  }
  return meses;
}

function tendenciaLineal(arr) {
  const n = arr.length;
  if (n < 2) return 0;
  const xm = (n - 1) / 2;
  const ym = arr.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  arr.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2; });
  return den === 0 ? 0 : num / den;
}

export async function generatePDF() {
  toast('Generando reporte...');
  const mes = document.getElementById('repMes')?.value || getCurrentMonth();

  const [metas, presupuestos, prestamos] = await Promise.all([
    DB.getMetas(), DB.getPresupuestos(), DB.getPrestamos()
  ]);

  const txsMes = state.transacciones.filter(t => fechaToMes(t.fecha) === mes);
  const ingresos = txsMes.filter(t => esTipo(t.tipo, 'ingreso')).reduce((s, t) => s + parseMonto(t.monto), 0);
  const gastos = txsMes.filter(t => esTipo(t.tipo, 'gasto')).reduce((s, t) => s + parseMonto(t.monto), 0);
  const pagos = txsMes.filter(t => esTipo(t.tipo, 'pago')).reduce((s, t) => s + parseMonto(t.monto), 0);
  const ahorro = txsMes.filter(t => esTipo(t.tipo, 'ahorro')).reduce((s, t) => s + parseMonto(t.monto), 0);
  const balance = ingresos - gastos - pagos - ahorro;
  const tasaAhorro = ingresos > 0 ? (((ingresos - gastos - pagos - ahorro) / ingresos) * 100) : 0;

  const byCategoria = {};
  txsMes.filter(t => !esTipo(t.tipo, 'ingreso')).forEach(t => {
    byCategoria[t.categoria] = (byCategoria[t.categoria] || 0) + parseMonto(t.monto);
  });
  const totalGastado = gastos + pagos + ahorro;
  const sortedCat = Object.entries(byCategoria).sort((a, b) => b[1] - a[1]);

  const cuentasInfo = (state.cuentas || []).map(c => ({ nombre: c.nombre, tipo: c.tipo, saldo: saldoCuenta(c) }));
  const patrimonioTotal = cuentasInfo.reduce((s, c) => s + c.saldo, 0);

  const trendMeses = ultimosMeses(mes, 6);
  const trendData = trendMeses.map(tm => {
    const mtxs = state.transacciones.filter(t => fechaToMes(t.fecha) === tm);
    const ing = mtxs.filter(t => esTipo(t.tipo, 'ingreso')).reduce((s, t) => s + parseMonto(t.monto), 0);
    const gas = mtxs.filter(t => !esTipo(t.tipo, 'ingreso')).reduce((s, t) => s + parseMonto(t.monto), 0);
    return { mes: tm, ingresos: ing, gastos: gas, balance: ing - gas };
  });

  const insights = [];
  if (balance < 0) insights.push('⚠️ Los gastos, pagos y ahorros del mes superaron los ingresos.');
  if (sortedCat.length > 0) insights.push(`💡 La mayor salida de dinero fue en "${sortedCat[0][0]}" con ${FMT.format(sortedCat[0][1])}.`);
  if (tasaAhorro >= 20) insights.push('🎉 Excelente tasa de ahorro este mes.');
  else if (ingresos > 0) insights.push('💪 Intenta ahorrar al menos un 20% de tus ingresos.');
  const vencidas = prestamos.reduce((s, p) => s + (p.cuotas_detalle || []).filter(c => c.estado === 'Pendiente' && c.fechaVencimiento < new Date().toISOString().slice(0, 10)).length, 0);
  if (vencidas > 0) insights.push(`🚨 Tienes ${vencidas} cuota(s) de préstamo vencida(s).`);

  // ── Proyección: cuotas de préstamo conocidas + tendencia de gastos variables ──
  const cuotasPorMes = {};
  prestamos.forEach(p => {
    (p.cuotas_detalle || []).forEach(c => {
      if (c.estado !== 'Pendiente') return;
      const cm = fechaToMes(c.fechaVencimiento);
      cuotasPorMes[cm] = (cuotasPorMes[cm] || 0) + parseMonto(p.montoCuota);
    });
  });

  const histIngresos = trendMeses.map(tm =>
    state.transacciones.filter(t => fechaToMes(t.fecha) === tm && esTipo(t.tipo, 'ingreso')).reduce((s, t) => s + parseMonto(t.monto), 0));
  const histGastosVariables = trendMeses.map(tm =>
    state.transacciones.filter(t => fechaToMes(t.fecha) === tm && !esTipo(t.tipo, 'ingreso') && t.categoria !== 'Prestamo').reduce((s, t) => s + parseMonto(t.monto), 0));

  const avgIng = histIngresos.reduce((a, b) => a + b, 0) / Math.max(histIngresos.filter(v => v > 0).length, 1);
  const avgGasVar = histGastosVariables.reduce((a, b) => a + b, 0) / Math.max(histGastosVariables.filter(v => v > 0).length, 1);
  const trendIng = tendenciaLineal(histIngresos);
  const trendGasVar = tendenciaLineal(histGastosVariables);

  let acumProyectado = patrimonioTotal;
  const proyeccionData = proximosMeses(mes, 6).map((fm, i) => {
    const ingresosProy = Math.max(0, avgIng + trendIng * (i + 1));
    const gastosVariablesProy = Math.max(0, avgGasVar + trendGasVar * (i + 1));
    const cuotasProy = cuotasPorMes[fm] || 0;
    const balanceProy = ingresosProy - gastosVariablesProy - cuotasProy;
    acumProyectado += balanceProy;
    return { mes: fm, ingresos: ingresosProy, gastosVariables: gastosVariablesProy, cuotas: cuotasProy, balance: balanceProy, acumulado: acumProyectado };
  });

  // ── Recomendaciones: alertas por % del ingreso ──
  const recomendaciones = [];
  if (ingresos > 0) {
    const pctGastos = (gastos / ingresos) * 100;
    const pctDeuda = (pagos / ingresos) * 100;
    const pctAhorro = (ahorro / ingresos) * 100;

    if (pctGastos > 50) recomendaciones.push(`Tus gastos variables representan el ${pctGastos.toFixed(0)}% de tus ingresos (${FMT.format(gastos)}), por encima del 50% recomendado. Revisa tus gastos discrecionales.`);
    if (pctDeuda > 30) recomendaciones.push(`Tus pagos de deuda/préstamos representan el ${pctDeuda.toFixed(0)}% de tus ingresos (${FMT.format(pagos)}). Se recomienda mantener este ratio por debajo del 30-36%.`);
    if (pctAhorro < 20) recomendaciones.push(`Ahorraste el ${pctAhorro.toFixed(0)}% de tus ingresos (${FMT.format(ahorro)}), por debajo de la meta recomendada del 20%.`);
    else recomendaciones.push(`Tu tasa de ahorro del ${pctAhorro.toFixed(0)}% cumple o supera la meta recomendada del 20%.`);

    sortedCat.forEach(([cat, monto]) => {
      const pctCat = (monto / ingresos) * 100;
      if (pctCat >= 15) recomendaciones.push(`La categoría "${cat}" consume el ${pctCat.toFixed(0)}% de tus ingresos (${FMT.format(monto)}). Vale la pena revisarla.`);
    });
  }
  const mesNegativo = proyeccionData.find(p => p.acumulado < 0);
  if (mesNegativo) recomendaciones.push(`⚠️ Si el patrón actual continúa, tu saldo acumulado proyectado se vuelve negativo hacia ${mesNegativo.mes} (considerando las cuotas de préstamos ya programadas).`);
  if (!recomendaciones.length) recomendaciones.push('No se detectaron alertas de porcentaje sobre tus ingresos este mes.');

  const user = state.user;
  const nombre = user?.displayName || user?.email || 'Usuario';
  const fechaGeneracion = new Date().toLocaleDateString('es-DO', { day: 'numeric', month: 'long', year: 'numeric' });
  const mesLabel = new Date(mes + '-02').toLocaleDateString('es-DO', { month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Reporte Financiero — ${mes}</title>
<style>
  :root{--accent:#6c5ce7;--accent2:#00b894;--red:#e17055;--blue:#0984e3;--text:#1a1a2e;--text2:#636e72;--border:#e5e7eb}
  *{box-sizing:border-box}
  body{font-family:-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;padding:40px;color:var(--text);max-width:850px}
  header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid var(--accent);padding-bottom:16px;margin-bottom:24px}
  header .brand{display:flex;align-items:center;gap:10px}
  header .brand .logo{font-size:28px}
  header .brand h1{font-size:20px;margin:0;color:var(--accent)}
  header .meta{text-align:right;font-size:12px;color:var(--text2);line-height:1.6}
  h2{font-size:15px;color:var(--accent);border-bottom:1px solid var(--border);padding-bottom:6px;margin:28px 0 12px}
  h2:first-of-type{margin-top:0}
  table{width:100%;border-collapse:collapse;margin:8px 0 16px;font-size:12.5px}
  th,td{padding:7px 10px;border-bottom:1px solid var(--border);text-align:left}
  th{background:#f5f6fa;font-weight:600;color:var(--text2);font-size:11px;text-transform:uppercase;letter-spacing:.3px}
  tr:last-child td{border-bottom:none}
  .summary{display:flex;gap:14px;margin:8px 0 20px;flex-wrap:wrap}
  .sum-card{flex:1;min-width:110px;padding:14px;border-radius:10px;text-align:center;background:#f8f9fc}
  .sum-card h3{margin:0 0 4px;font-size:11px;color:var(--text2);font-weight:600;text-transform:uppercase}
  .sum-card .val{font-size:19px;font-weight:700}
  .green{color:var(--accent2)}.red{color:var(--red)}.purple{color:var(--accent)}.orange{color:var(--blue)}
  .hero{background:linear-gradient(135deg,var(--accent),#8e7ff0);color:#fff;border-radius:14px;padding:20px 24px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
  .hero div:first-child .label{font-size:12px;opacity:.85;margin-bottom:4px}
  .hero div:first-child .val{font-size:28px;font-weight:700}
  .hero div:last-child{text-align:right;font-size:12px;opacity:.9}
  .badge{display:inline-block;padding:2px 9px;border-radius:12px;font-size:10.5px;font-weight:700}
  .badge.ok{background:rgba(0,184,148,.15);color:var(--accent2)}
  .badge.warn{background:rgba(231,112,85,.15);color:var(--red)}
  .bar-row{display:flex;align-items:center;gap:8px;margin-bottom:6px}
  .bar-row .lbl{width:150px;font-size:12px;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .bar-track{flex:1;height:8px;background:#eef0f5;border-radius:6px;overflow:hidden}
  .bar-fill{height:100%;background:var(--accent)}
  .insight-item{background:#f8f9fc;border-left:3px solid var(--accent);padding:8px 12px;margin-bottom:6px;border-radius:0 6px 6px 0;font-size:12.5px}
  .empty{color:var(--text2);font-size:12.5px;font-style:italic}
  footer{margin-top:36px;padding-top:14px;border-top:1px solid var(--border);text-align:center;color:#b2bec3;font-size:11px}
  @media print{body{padding:20px}.hero{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>

<header>
  <div class="brand"><span class="logo">💎</span><div><h1>FinApp</h1><div style="font-size:11px;color:var(--text2)">Reporte Financiero Personal</div></div></div>
  <div class="meta">${nombre}<br>${user?.email || ''}<br>Generado el ${fechaGeneracion}</div>
</header>

<div class="hero">
  <div><div class="label">PATRIMONIO TOTAL (todas las cuentas)</div><div class="val">${FMT.format(patrimonioTotal)}</div></div>
  <div>Periodo del reporte<br><strong style="font-size:14px;color:#fff">${mesLabel}</strong></div>
</div>

<h2>Resumen del Mes</h2>
<div class="summary">
  <div class="sum-card"><h3>Ingresos</h3><div class="val green">${FMT.format(ingresos)}</div></div>
  <div class="sum-card"><h3>Gastos</h3><div class="val red">${FMT.format(gastos)}</div></div>
  <div class="sum-card"><h3>Pagos</h3><div class="val orange">${FMT.format(pagos)}</div></div>
  <div class="sum-card"><h3>Ahorro</h3><div class="val purple">${FMT.format(ahorro)}</div></div>
  <div class="sum-card"><h3>Balance</h3><div class="val ${balance >= 0 ? 'green' : 'red'}">${FMT.format(balance)}</div></div>
</div>

<h2>Cuentas</h2>
${cuentasInfo.length ? `<table><thead><tr><th>Cuenta</th><th>Tipo</th><th>Saldo actual</th></tr></thead>
<tbody>${cuentasInfo.map(c => `<tr><td>${c.nombre}</td><td>${c.tipo}</td><td style="font-weight:600;color:${c.saldo >= 0 ? 'var(--accent2)' : 'var(--red)'}">${FMT.format(c.saldo)}</td></tr>`).join('')}</tbody></table>`
    : '<div class="empty">Sin cuentas registradas.</div>'}

<h2>Metas de Ahorro</h2>
${metas.length ? metas.map(m => {
    const objetivo = parseMonto(m.montoObjetivo), actual = parseMonto(m.montoActual);
    const pct = objetivo > 0 ? Math.min((actual / objetivo) * 100, 100) : 0;
    return `<div class="bar-row"><div class="lbl">${m.nombre}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
    <div style="width:150px;text-align:right;font-size:11.5px;color:var(--text2)">${FMT.format(actual)} / ${FMT.format(objetivo)} (${pct.toFixed(0)}%)</div></div>`;
  }).join('') : '<div class="empty">Sin metas de ahorro registradas.</div>'}

<h2>Préstamos</h2>
${prestamos.length ? `<table><thead><tr><th>Nombre</th><th>Tipo</th><th>Total</th><th>Cuotas</th><th>Tasa</th><th>Estado</th></tr></thead>
<tbody>${prestamos.map(p => {
      const pagadasN = (p.cuotas_detalle || []).filter(c => c.estado === 'Pagada').length;
      return `<tr><td>${p.nombre}</td><td>${p.tipo || 'Debo'}</td><td>${FMT.format(parseMonto(p.montoTotal))}</td>
      <td>${pagadasN}/${p.cuotas || 0}</td><td>${p.tasaMensual || 0}%/mes</td>
      <td><span class="badge ${p.estado === 'Completado' ? 'ok' : 'warn'}">${p.estado}</span></td></tr>`;
    }).join('')}</tbody></table>` : '<div class="empty">Sin préstamos registrados.</div>'}

<h2>Presupuestos del Mes</h2>
${presupuestos.length ? `<table><thead><tr><th>Categoría</th><th>Límite</th><th>Gastado</th><th>%</th></tr></thead>
<tbody>${presupuestos.map(p => {
      const limite = parseMonto(p.montoLimite);
      const gastado = byCategoria[p.categoria] || 0;
      const pct = limite > 0 ? (gastado / limite * 100) : 0;
      return `<tr><td>${p.categoria}</td><td>${FMT.format(limite)}</td><td>${FMT.format(gastado)}</td>
      <td><span class="badge ${pct >= 100 ? 'warn' : 'ok'}">${pct.toFixed(0)}%</span></td></tr>`;
    }).join('')}</tbody></table>` : '<div class="empty">Sin presupuestos registrados.</div>'}

<h2>Gastos por Categoría</h2>
${sortedCat.length ? `<table><thead><tr><th>Categoría</th><th>Monto</th><th>%</th></tr></thead>
<tbody>${sortedCat.map(([cat, monto]) => {
      const pct = totalGastado > 0 ? (monto / totalGastado * 100).toFixed(1) : '0.0';
      return `<tr><td>${cat}</td><td>${FMT.format(monto)}</td><td>${pct}%</td></tr>`;
    }).join('')}</tbody></table>` : '<div class="empty">Sin gastos este mes.</div>'}

<h2>Tendencia (últimos 6 meses)</h2>
<table><thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos totales</th><th>Balance</th></tr></thead>
<tbody>${trendData.map(d => `<tr><td>${d.mes}</td><td style="color:var(--accent2)">${FMT.format(d.ingresos)}</td>
  <td style="color:var(--red)">${FMT.format(d.gastos)}</td>
  <td style="font-weight:600;color:${d.balance >= 0 ? 'var(--accent2)' : 'var(--red)'}">${FMT.format(d.balance)}</td></tr>`).join('')}</tbody></table>

<h2>Proyección Financiera (próximos 6 meses)</h2>
<div class="empty" style="margin-bottom:8px">Incluye las cuotas de préstamos ya programadas y una proyección de tus gastos variables según tu tendencia reciente.</div>
<table><thead><tr><th>Mes</th><th>Ingresos proy.</th><th>Gastos variables proy.</th><th>Cuotas préstamos</th><th>Balance proy.</th><th>Acumulado</th></tr></thead>
<tbody>${proyeccionData.map(d => `<tr><td>${d.mes}</td><td style="color:var(--accent2)">${FMT.format(d.ingresos)}</td>
  <td style="color:var(--red)">${FMT.format(d.gastosVariables)}</td>
  <td style="color:var(--blue)">${FMT.format(d.cuotas)}</td>
  <td style="font-weight:600;color:${d.balance >= 0 ? 'var(--accent2)' : 'var(--red)'}">${FMT.format(d.balance)}</td>
  <td style="font-weight:700;color:${d.acumulado >= 0 ? 'var(--accent2)' : 'var(--red)'}">${FMT.format(d.acumulado)}</td></tr>`).join('')}</tbody></table>

<h2>Recomendaciones</h2>
${recomendaciones.map(r => `<div class="insight-item">${r}</div>`).join('')}

<h2>Insights</h2>
${insights.length ? insights.map(i => `<div class="insight-item">${i}</div>`).join('') : '<div class="empty">No hay suficientes datos para generar insights.</div>'}

<h2>Transacciones del Mes</h2>
${txsMes.length ? `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Categoría</th><th>Descripción</th><th>Cuenta</th><th>Monto</th></tr></thead>
<tbody>${txsMes.sort((a, b) => (a.fecha || '').localeCompare(b.fecha || '')).map(t =>
      `<tr><td>${formatDate(t.fecha)}</td><td>${t.tipo}</td><td>${t.categoria}</td><td>${t.descripcion || ''}</td><td>${t.cuenta || 'General'}</td>
    <td style="color:${esTipo(t.tipo, 'ingreso') ? 'var(--accent2)' : 'var(--red)'}">${esTipo(t.tipo, 'ingreso') ? '+' : '-'}${FMT.format(parseMonto(t.monto))}</td></tr>`
    ).join('')}</tbody></table>` : '<div class="empty">Sin transacciones este mes.</div>'}

<footer>Generado por FinApp el ${fechaGeneracion} · Reporte confidencial de ${nombre}</footer>
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) { toast('Permite ventanas emergentes para generar el PDF'); return; }
  w.document.write(html);
  w.document.close();
  setTimeout(() => { w.print(); }, 500);
  toast('Reporte generado — usa Ctrl+P para guardar como PDF');
}

window.generatePDF = generatePDF;
