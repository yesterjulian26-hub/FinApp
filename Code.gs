// ============================================================
// FINANZAS PERSONALES — Google Apps Script Backend (Multi-User)
// Soporta hasta 30 usuarios con Firebase Auth
//
// Hojas:
//   Usuarios:       UID, Email, Nombre, FotoURL, FechaRegistro, OnboardingCompleto, PerfilIA
//   Transacciones:  ID, UID, Fecha, Tipo, Categoria, Descripcion, Monto, Cuenta
//   Presupuestos:   UID, Categoria, MontoMensual
//   Categorias:     UID, Tipo, Nombre
//   Metas:          ID, UID, Nombre, MontoObjetivo, MontoActual, FechaLimite, Estado
//   Cuentas:        ID, UID, Nombre, Tipo, SaldoInicial
//   Recurrentes:    ID, UID, Tipo, Categoria, Descripcion, Monto, Cuenta, Frecuencia, ProximaFecha
//   Prestamos:      ID, UID, Nombre, MontoTotal, MontoCuota, Cuotas, CuotasPagadas, TasaMensual, FechaInicio, Cuenta, Estado
//   CuotasPrestamo: ID, PrestamoID, UID, Numero, FechaVencimiento, FechaPago, Estado
// ============================================================

const SHEET_ID = '1Mqxeo3tZe32LyQYbsZcBN5NLi225PTn66rA6DdLT6yk';
const MAX_USERS = 30;

function getSheet(name) {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(name);
}

// ── Ensure all sheets exist with correct headers ────────────
function ensureSheets() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheets = {
    'Usuarios':      ['UID','Email','Nombre','FotoURL','FechaRegistro','OnboardingCompleto','PerfilIA','Recordatorios'],
    'Transacciones': ['ID','UID','Fecha','Tipo','Categoria','Descripcion','Monto','Cuenta'],
    'Presupuestos':  ['UID','Categoria','MontoMensual'],
    'Categorias':    ['UID','Tipo','Nombre','Icono','Color'],
    'Metas':         ['ID','UID','Nombre','MontoObjetivo','MontoActual','FechaLimite','Estado'],
    'Cuentas':       ['ID','UID','Nombre','Tipo','SaldoInicial'],
    'Recurrentes':   ['ID','UID','Tipo','Categoria','Descripcion','Monto','Cuenta','Frecuencia','ProximaFecha'],
    'Prestamos':     ['ID','UID','Nombre','MontoTotal','MontoCuota','Cuotas','CuotasPagadas','TasaMensual','FechaInicio','Cuenta','Estado'],
    'CuotasPrestamo':['ID','PrestamoID','UID','Numero','FechaVencimiento','FechaPago','Estado']
  };
  for (const [name, headers] of Object.entries(sheets)) {
    let sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.appendRow(headers);
    } else {
      const lastCol = sheet.getLastColumn();
      const currentHeaders = lastCol > 0 ? sheet.getRange(1, 1, 1, Math.min(lastCol, headers.length)).getValues()[0] : [];
      const needsHeaderFix = headers.some((h, i) => currentHeaders[i] !== h);
      if (needsHeaderFix) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      }
      if (lastCol > headers.length) {
        sheet.deleteColumns(headers.length + 1, lastCol - headers.length);
      }
    }
  }
}

// ── Router ──────────────────────────────────────────────────
function doGet(e)  { return handleRequest(e); }
function doPost(e) { return handleRequest(e); }

function handleRequest(e) {
  ensureSheets();
  let p = e.parameter || {};
  // Merge POST body JSON into parameters
  if (e.postData && e.postData.contents) {
    try {
      const body = JSON.parse(e.postData.contents);
      p = Object.assign({}, p, body);
    } catch(ex) {}
  }
  const action = p.action || '';
  let result;

  try {
    // Public actions (no auth required)
    const publicActions = ['registerUser', 'checkUser'];

    // Get UID from request
    const uid = p.uid || '';

    if (!publicActions.includes(action) && !uid) {
      result = { error: 'Autenticación requerida', code: 'AUTH_REQUIRED' };
    } else {
      switch (action) {
        // ── Auth & Users ──
        case 'registerUser':       result = registerUser(e); break;
        case 'checkUser':          result = checkUser(p); break;
        case 'updateUser':         result = updateUser(p); break;
        case 'completeOnboarding': result = completeOnboarding(p); break;
        case 'getUserStats':       result = getUserStats(p); break;

        // ── Transacciones ──
        case 'getTransacciones':    result = getTransacciones(p); break;
        case 'addTransaccion':      result = addTransaccion(p); break;
        case 'deleteTransaccion':   result = deleteTransaccion(p); break;
        case 'editTransaccion':     result = editTransaccion(p); break;
        case 'importTransacciones': result = importTransacciones(e); break;
        case 'getResumen':          result = getResumen(p); break;

        // ── Presupuestos ──
        case 'getPresupuestos':     result = getPresupuestos(p); break;
        case 'addPresupuesto':      result = addPresupuesto(p); break;
        case 'deletePresupuesto':   result = deletePresupuesto(p); break;

        // ── Categorías ──
        case 'getCategorias':       result = getCategorias(p); break;
        case 'addCategoria':        result = addCategoria(p); break;
        case 'deleteCategoria':     result = deleteCategoria(p); break;
        case 'updateCategoria':     result = updateCategoria(p); break;

        // ── Metas ──
        case 'getMetas':            result = getMetas(p); break;
        case 'addMeta':             result = addMeta(p); break;
        case 'updateMeta':          result = updateMeta(p); break;
        case 'deleteMeta':          result = deleteMeta(p); break;
        case 'abonarMeta':          result = abonarMeta(p); break;

        // ── Cuentas ──
        case 'getCuentas':          result = getCuentas(p); break;
        case 'addCuenta':           result = addCuenta(p); break;
        case 'deleteCuenta':        result = deleteCuenta(p); break;

        // ── Recurrentes ──
        case 'getRecurrentes':      result = getRecurrentes(p); break;
        case 'addRecurrente':       result = addRecurrente(p); break;
        case 'deleteRecurrente':    result = deleteRecurrente(p); break;
        case 'processRecurrentes':  result = processRecurrentes(p); break;

        // ── Préstamos ──
        case 'getPrestamos':        result = getPrestamos(p); break;
        case 'addPrestamo':         result = addPrestamo(p); break;
        case 'deletePrestamo':      result = deletePrestamo(p); break;
        case 'pagarCuota':          result = pagarCuota(p); break;
        case 'updateFechaCuota':    result = updateFechaCuota(p); break;
        case 'processPrestamos':    result = processPrestamos(p); break;

        // ── Transferencias ──
        case 'transferir':          result = transferir(p); break;

        // ── Proyección ──
        case 'getProyeccion':       result = getProyeccion(p); break;

        // ── Reportes ──
        case 'getReporteMensual':   result = getReporteMensual(p); break;

        // ── Preferencias ──
        case 'getPreferencias':     result = getPreferencias(p); break;
        case 'updatePreferencias':  result = updatePreferencias(p); break;

        // ── Perfil IA ──
        case 'getPerfilIA':         result = getPerfilIA(p); break;
        case 'updatePerfilIA':      result = updatePerfilIA(e); break;

        // ── Asesor IA ──
        case 'chatIA':              result = chatIA(e); break;

        case 'debug':
          result = debugSheets(p);
          break;
        case 'resetAllData':
          result = resetAllData(p);
          break;

        default:
          result = { error: 'Acción no reconocida: ' + action };
      }
    }
  } catch (err) {
    result = { error: err.message };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function resetAllData(p) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheetsToClean = ['Transacciones','Categorias','Presupuestos','Metas','Cuentas','Recurrentes'];
  const log = [];
  sheetsToClean.forEach(name => {
    const sheet = ss.getSheetByName(name);
    if (sheet && sheet.getLastRow() > 1) {
      sheet.deleteRows(2, sheet.getLastRow() - 1);
      log.push(name + ': limpiada');
    }
  });
  // Reset onboarding for all users so they see it fresh
  const userSheet = ss.getSheetByName('Usuarios');
  if (userSheet) {
    const data = userSheet.getDataRange().getValues();
    for (let i = 1; i < data.length; i++) {
      userSheet.getRange(i + 1, 6).setValue('No');
    }
    log.push('Usuarios: onboarding reseteado');
  }
  return { success: true, log };
}

function debugSheets(p) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheetNames = ss.getSheets().map(s => s.getName());
  const info = {};
  sheetNames.forEach(name => {
    const sheet = ss.getSheetByName(name);
    const data = sheet.getDataRange().getValues();
    info[name] = {
      headers: data[0] || [],
      rowCount: data.length - 1,
      sample: data.slice(1, 4)
    };
  });
  return { success: true, sheets: sheetNames, info, uid: p.uid };
}

// ── Helpers ──────────────────────────────────────────────────
function generateId() {
  return String(Date.now()) + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
}

function sheetToArray(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return [];
  const headers = data[0];
  return data.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
}

function filterByUser(rows, uid) {
  return rows.filter(r => String(r.UID) === String(uid));
}

function parseMonto(val) {
  if (typeof val === 'number') return val;
  const str = String(val).replace(/[^0-9.\-]/g, '');
  return parseFloat(str) || 0;
}

function parseFecha(val) {
  if (val instanceof Date) return val;
  const s = String(val);
  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) return new Date(parseInt(dmy[3]), parseInt(dmy[2]) - 1, parseInt(dmy[1]));
  return new Date(s);
}

function fechaToMes(val) {
  const d = parseFecha(val);
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function esTipo(valor, tipo) {
  return String(valor).toLowerCase() === tipo.toLowerCase();
}

function formatMontoRD(num) {
  return 'RD$' + num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ══════════════════════════════════════════════════════════════
// USUARIOS
// ══════════════════════════════════════════════════════════════

function registerUser(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    // Try from parameters
    body = e.parameter;
  }

  const uid = body.uid;
  const email = body.email || '';
  const nombre = body.nombre || '';
  const foto = body.foto || '';

  if (!uid) return { error: 'UID requerido' };

  const sheet = getSheet('Usuarios');
  const users = sheetToArray(sheet);

  // Check if already registered
  const existing = users.find(u => String(u.UID) === String(uid));
  if (existing) {
    return {
      success: true,
      user: existing,
      isNew: false
    };
  }

  // Check user limit
  if (users.length >= MAX_USERS) {
    return { error: 'Límite de usuarios alcanzado (' + MAX_USERS + ')', code: 'USER_LIMIT' };
  }

  // Register new user
  const now = new Date().toISOString();
  sheet.appendRow([uid, email, nombre, foto, now, 'No']);

  // Create default categories for new user
  seedDefaultCategories(uid);

  return {
    success: true,
    user: { UID: uid, Email: email, Nombre: nombre, FotoURL: foto, FechaRegistro: now, OnboardingCompleto: 'No' },
    isNew: true
  };
}

function seedDefaultCategories(uid) {
  const sheet = getSheet('Categorias');
  const defaults = [
    ['gasto', 'Supermercado'], ['gasto', 'Comida'], ['gasto', 'Transporte'],
    ['gasto', 'Entretenimiento'], ['gasto', 'Servicios'], ['gasto', 'Salud'],
    ['gasto', 'Educación'], ['gasto', 'Ropa'], ['gasto', 'Hogar'],
    ['gasto', 'Suscripciones'], ['gasto', 'Otros'],
    ['ingreso', 'Salario'], ['ingreso', 'Freelance'], ['ingreso', 'Inversiones'],
    ['ingreso', 'Otros ingresos']
  ];
  defaults.forEach(([tipo, nombre]) => {
    sheet.appendRow([uid, tipo, nombre]);
  });
}

function checkUser(p) {
  if (!p.uid) return { error: 'UID requerido' };
  const users = sheetToArray(getSheet('Usuarios'));
  const user = users.find(u => String(u.UID) === String(p.uid));
  if (user) {
    return { success: true, exists: true, user: user };
  }
  return { success: true, exists: false };
}

function updateUser(p) {
  const sheet = getSheet('Usuarios');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.uid)) {
      if (p.nombre) sheet.getRange(i + 1, 3).setValue(p.nombre);
      if (p.foto) sheet.getRange(i + 1, 4).setValue(p.foto);
      return { success: true };
    }
  }
  return { error: 'Usuario no encontrado' };
}

function completeOnboarding(p) {
  const sheet = getSheet('Usuarios');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.uid)) {
      sheet.getRange(i + 1, 6).setValue('Si');
      return { success: true };
    }
  }
  return { error: 'Usuario no encontrado' };
}

function getPerfilIA(p) {
  const users = sheetToArray(getSheet('Usuarios'));
  const user = users.find(u => String(u.UID) === String(p.uid));
  if (!user) return { error: 'Usuario no encontrado' };
  return { success: true, perfil: user.PerfilIA || '' };
}

function updatePerfilIA(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (_) { return { error: 'JSON inválido' }; }
  const uid = body.uid || e.parameter.uid;
  if (!uid) return { error: 'UID requerido' };
  const sheet = getSheet('Usuarios');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  let col = headers.indexOf('PerfilIA');
  if (col === -1) {
    col = headers.length;
    sheet.getRange(1, col + 1).setValue('PerfilIA');
  }
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(uid)) {
      sheet.getRange(i + 1, col + 1).setValue(body.perfil || '');
      return { success: true };
    }
  }
  return { error: 'Usuario no encontrado' };
}

function getUserStats(p) {
  const uid = p.uid;
  const txs = filterByUser(sheetToArray(getSheet('Transacciones')), uid);
  const metas = filterByUser(sheetToArray(getSheet('Metas')), uid);
  const cuentas = filterByUser(sheetToArray(getSheet('Cuentas')), uid);

  const hoy = new Date();
  const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');

  let totalIngresos = 0, totalGastos = 0;
  let mesIngresos = 0, mesGastos = 0;

  txs.forEach(t => {
    const monto = parseMonto(t.Monto);
    const esMes = fechaToMes(t.Fecha) === mesActual;
    if (esTipo(t.Tipo, 'ingreso')) {
      totalIngresos += monto;
      if (esMes) mesIngresos += monto;
    } else {
      totalGastos += monto;
      if (esMes) mesGastos += monto;
    }
  });

  return {
    success: true,
    stats: {
      totalTransacciones: txs.length,
      totalIngresos, totalGastos,
      mesIngresos, mesGastos, mesBalance: mesIngresos - mesGastos,
      metasActivas: metas.filter(m => m.Estado === 'Activa').length,
      metasCompletadas: metas.filter(m => m.Estado === 'Completada').length,
      numeroCuentas: cuentas.length
    }
  };
}

// ══════════════════════════════════════════════════════════════
// TRANSACCIONES
// ══════════════════════════════════════════════════════════════

function getTransacciones(p) {
  const rows = filterByUser(sheetToArray(getSheet('Transacciones')), p.uid);
  let filtered = rows.map(r => ({
    ID: r.ID || '',
    Fecha: String(r.Fecha || ''),
    Tipo: String(r.Tipo || ''),
    Categoria: String(r.Categoria || ''),
    Descripcion: String(r.Descripcion || ''),
    Monto: parseMonto(r.Monto),
    Cuenta: String(r.Cuenta || 'General')
  }));

  if (p.mes) {
    filtered = filtered.filter(r => fechaToMes(r.Fecha) === p.mes);
  }
  if (p.cuenta && p.cuenta !== '') {
    filtered = filtered.filter(r => r.Cuenta === p.cuenta);
  }
  if (p.tipo && p.tipo !== '') {
    filtered = filtered.filter(r => esTipo(r.Tipo, p.tipo));
  }
  if (p.categoria && p.categoria !== '') {
    filtered = filtered.filter(r => r.Categoria === p.categoria);
  }

  // Sort by date descending
  filtered.sort((a, b) => new Date(b.Fecha) - new Date(a.Fecha));

  return { success: true, data: filtered };
}

function addTransaccion(p) {
  const sheet = getSheet('Transacciones');
  const id = generateId();
  const fecha = p.fecha || new Date().toISOString().slice(0, 10);
  const montoNum = parseFloat(p.monto) || 0;

  sheet.appendRow([
    id, p.uid, fecha, p.tipo, p.categoria,
    p.descripcion || '', montoNum, p.cuenta || 'General'
  ]);
  return { success: true, id: id };
}

function editTransaccion(p) {
  const sheet = getSheet('Transacciones');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id) && String(data[i][1]) === String(p.uid)) {
      if (p.fecha) sheet.getRange(i + 1, 3).setValue(p.fecha);
      if (p.tipo) sheet.getRange(i + 1, 4).setValue(p.tipo);
      if (p.categoria) sheet.getRange(i + 1, 5).setValue(p.categoria);
      if (p.descripcion !== undefined) sheet.getRange(i + 1, 6).setValue(p.descripcion);
      if (p.monto) sheet.getRange(i + 1, 7).setValue(parseFloat(p.monto));
      if (p.cuenta) sheet.getRange(i + 1, 8).setValue(p.cuenta);
      return { success: true };
    }
  }
  return { error: 'No encontrada' };
}

function deleteTransaccion(p) {
  const sheet = getSheet('Transacciones');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id) && String(data[i][1]) === String(p.uid)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'No encontrada' };
}

function importTransacciones(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    return { error: 'JSON inválido en el body' };
  }

  const uid = body.uid || e.parameter.uid;
  if (!uid) return { error: 'UID requerido' };

  const rows = body.rows;
  if (!rows || !rows.length) return { error: 'No hay filas para importar' };

  const sheet = getSheet('Transacciones');
  let count = 0;
  rows.forEach(r => {
    const id = generateId() + count;
    const montoNum = parseFloat(String(r.monto).replace(/[^0-9.\-]/g, '')) || 0;

    sheet.appendRow([
      id, uid,
      r.fecha || new Date().toISOString().slice(0, 10),
      r.tipo || 'gasto',
      r.categoria || 'Otros',
      r.descripcion || '',
      montoNum,
      r.cuenta || 'General'
    ]);
    count++;
  });
  return { success: true, imported: count };
}

// ── RESUMEN CON INSIGHTS ─────────────────────────────────────
function getResumen(p) {
  const uid = p.uid;
  const mes = p.mes;
  if (!mes) return { error: 'Parámetro mes requerido (YYYY-MM)' };

  const allRaw = filterByUser(sheetToArray(getSheet('Transacciones')), uid);
  const all = allRaw.map(r => ({
    Fecha: String(r.Fecha || ''),
    Tipo: String(r.Tipo || ''),
    Categoria: String(r.Categoria || ''),
    Monto: parseMonto(r.Monto)
  }));

  const [y, m] = mes.split('-').map(Number);
  const prevMes = m === 1 ? (y - 1) + '-12' : y + '-' + String(m - 1).padStart(2, '0');

  function filtrarMes(data, mesStr) {
    return data.filter(r => fechaToMes(r.Fecha) === mesStr);
  }

  const actual = filtrarMes(all, mes);
  const anterior = filtrarMes(all, prevMes);

  function calcular(rows) {
    let ingresos = 0, gastos = 0, pagos = 0;
    const porCategoria = {};
    rows.forEach(r => {
      const monto = r.Monto;
      if (esTipo(r.Tipo, 'ingreso')) {
        ingresos += monto;
      } else if (esTipo(r.Tipo, 'pago')) {
        pagos += monto;
        porCategoria[r.Categoria] = (porCategoria[r.Categoria] || 0) + monto;
      } else {
        gastos += monto;
        porCategoria[r.Categoria] = (porCategoria[r.Categoria] || 0) + monto;
      }
    });
    return { ingresos, gastos, pagos, balance: ingresos - gastos - pagos, porCategoria };
  }

  const resActual = calcular(actual);
  const resAnterior = calcular(anterior);

  const pctIngresos = resAnterior.ingresos > 0
    ? ((resActual.ingresos - resAnterior.ingresos) / resAnterior.ingresos * 100).toFixed(1) : null;
  const pctGastos = resAnterior.gastos > 0
    ? ((resActual.gastos - resAnterior.gastos) / resAnterior.gastos * 100).toFixed(1) : null;

  let maxCrecimiento = { categoria: null, pct: 0 };
  for (const cat in resActual.porCategoria) {
    const prev = resAnterior.porCategoria[cat] || 0;
    const curr = resActual.porCategoria[cat];
    if (prev > 0) {
      const pct = ((curr - prev) / prev * 100);
      if (pct > maxCrecimiento.pct) maxCrecimiento = { categoria: cat, pct: pct.toFixed(1) };
    }
  }

  let topCat = { categoria: null, monto: 0 };
  for (const cat in resActual.porCategoria) {
    if (resActual.porCategoria[cat] > topCat.monto) {
      topCat = { categoria: cat, monto: resActual.porCategoria[cat] };
    }
  }

  const tasaAhorro = resActual.ingresos > 0
    ? ((resActual.balance / resActual.ingresos) * 100).toFixed(1) : 0;

  return {
    success: true, mes,
    actual: resActual, anterior: resAnterior,
    insights: {
      cambioIngresos: pctIngresos, cambioGastos: pctGastos,
      categoriaMasCrecio: maxCrecimiento, topCategoria: topCat,
      tasaAhorro, totalTransacciones: actual.length
    }
  };
}

// ══════════════════════════════════════════════════════════════
// PRESUPUESTOS
// ══════════════════════════════════════════════════════════════

function getPresupuestos(p) {
  const rows = filterByUser(sheetToArray(getSheet('Presupuestos')), p.uid);
  const data = rows.map(r => ({
    Categoria: r['Categoria'] || '',
    MontoLimite: parseMonto(r['MontoMensual'] || r['MontoLimite'] || 0)
  }));
  return { success: true, data };
}

function addPresupuesto(p) {
  const sheet = getSheet('Presupuestos');
  sheet.appendRow([p.uid, p.categoria, parseFloat(p.montoLimite) || 0]);
  return { success: true };
}

function deletePresupuesto(p) {
  const sheet = getSheet('Presupuestos');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.uid) && String(data[i][1]) === String(p.categoria)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'No encontrado' };
}

// ══════════════════════════════════════════════════════════════
// CATEGORÍAS
// ══════════════════════════════════════════════════════════════

function getCategorias(p) {
  const rows = filterByUser(sheetToArray(getSheet('Categorias')), p.uid);
  const data = rows.map(r => ({
    Tipo: r['Tipo'] || 'gasto',
    Nombre: r['Nombre'] || '',
    Icono: r['Icono'] || '',
    Color: r['Color'] || ''
  }));
  return { success: true, data };
}

function addCategoria(p) {
  const sheet = getSheet('Categorias');
  sheet.appendRow([p.uid, p.tipo || 'gasto', p.nombre, p.icono || '', p.color || '']);
  return { success: true };
}

function updateCategoria(p) {
  const sheet = getSheet('Categorias');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.uid) && String(data[i][2]) === String(p.nombre)) {
      if (p.icono !== undefined) sheet.getRange(i + 1, 4).setValue(p.icono);
      if (p.color !== undefined) sheet.getRange(i + 1, 5).setValue(p.color);
      return { success: true };
    }
  }
  return { error: 'Categoría no encontrada' };
}

function deleteCategoria(p) {
  const sheet = getSheet('Categorias');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.uid) && String(data[i][2]) === String(p.nombre)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'No encontrada' };
}

// ══════════════════════════════════════════════════════════════
// METAS DE AHORRO
// ══════════════════════════════════════════════════════════════

function getMetas(p) {
  const data = filterByUser(sheetToArray(getSheet('Metas')), p.uid);
  return { success: true, data };
}

function addMeta(p) {
  const sheet = getSheet('Metas');
  const id = generateId();
  sheet.appendRow([id, p.uid, p.nombre, parseFloat(p.montoObjetivo), 0, p.fechaLimite || '', 'Activa']);
  return { success: true, id };
}

function updateMeta(p) {
  const sheet = getSheet('Metas');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id) && String(data[i][1]) === String(p.uid)) {
      if (p.nombre) sheet.getRange(i + 1, 3).setValue(p.nombre);
      if (p.montoObjetivo) sheet.getRange(i + 1, 4).setValue(parseFloat(p.montoObjetivo));
      if (p.estado) sheet.getRange(i + 1, 7).setValue(p.estado);
      return { success: true };
    }
  }
  return { error: 'Meta no encontrada' };
}

function abonarMeta(p) {
  const sheet = getSheet('Metas');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id) && String(data[i][1]) === String(p.uid)) {
      const actual = parseFloat(data[i][4]) || 0;
      const abono = parseFloat(p.monto) || 0;
      const nuevo = actual + abono;
      sheet.getRange(i + 1, 5).setValue(nuevo);
      const objetivo = parseFloat(data[i][3]) || 0;
      if (nuevo >= objetivo) sheet.getRange(i + 1, 7).setValue('Completada');
      return { success: true, montoActual: nuevo };
    }
  }
  return { error: 'Meta no encontrada' };
}

function deleteMeta(p) {
  const sheet = getSheet('Metas');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id) && String(data[i][1]) === String(p.uid)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Meta no encontrada' };
}

// ══════════════════════════════════════════════════════════════
// CUENTAS
// ══════════════════════════════════════════════════════════════

function getCuentas(p) {
  const data = filterByUser(sheetToArray(getSheet('Cuentas')), p.uid);
  return { success: true, data };
}

function addCuenta(p) {
  const sheet = getSheet('Cuentas');
  const id = generateId();
  sheet.appendRow([id, p.uid, p.nombre, p.tipo || 'Banco', parseFloat(p.saldoInicial) || 0]);
  return { success: true, id };
}

function deleteCuenta(p) {
  const sheet = getSheet('Cuentas');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id) && String(data[i][1]) === String(p.uid)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'Cuenta no encontrada' };
}

// ══════════════════════════════════════════════════════════════
// TRANSACCIONES RECURRENTES
// ══════════════════════════════════════════════════════════════

function getRecurrentes(p) {
  const data = filterByUser(sheetToArray(getSheet('Recurrentes')), p.uid);
  return { success: true, data };
}

function addRecurrente(p) {
  const sheet = getSheet('Recurrentes');
  const id = generateId();
  sheet.appendRow([
    id, p.uid, p.tipo || 'gasto', p.categoria, p.descripcion || '',
    parseFloat(p.monto) || 0, p.cuenta || 'General',
    p.frecuencia || 'mensual', p.proximaFecha || ''
  ]);
  return { success: true, id };
}

function deleteRecurrente(p) {
  const sheet = getSheet('Recurrentes');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id) && String(data[i][1]) === String(p.uid)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  return { error: 'No encontrada' };
}

function processRecurrentes(p) {
  const uid = p.uid;
  const hoy = new Date();
  const hoyStr = hoy.toISOString().slice(0, 10);
  const sheet = getSheet('Recurrentes');
  const data = sheet.getDataRange().getValues();
  let processed = 0;

  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]) !== String(uid)) continue;
    const proxFecha = String(data[i][8]);
    if (!proxFecha || proxFecha > hoyStr) continue;

    // Create transaction
    addTransaccion({
      uid, fecha: proxFecha, tipo: data[i][2],
      categoria: data[i][3], descripcion: data[i][4] + ' (recurrente)',
      monto: String(data[i][5]), cuenta: data[i][6]
    });

    // Calculate next date
    const freq = String(data[i][7]);
    const d = new Date(proxFecha);
    if (freq === 'semanal') d.setDate(d.getDate() + 7);
    else if (freq === 'quincenal') d.setDate(d.getDate() + 15);
    else if (freq === 'mensual') d.setMonth(d.getMonth() + 1);
    else if (freq === 'anual') d.setFullYear(d.getFullYear() + 1);

    sheet.getRange(i + 1, 9).setValue(d.toISOString().slice(0, 10));
    processed++;
  }

  return { success: true, processed };
}

// ══════════════════════════════════════════════════════════════
// PRÉSTAMOS
// ══════════════════════════════════════════════════════════════

function getPrestamos(p) {
  const prestamos = sheetToArray(getSheet('Prestamos')).filter(r => String(r.UID) === String(p.uid));
  const cuotas = sheetToArray(getSheet('CuotasPrestamo')).filter(r => String(r.UID) === String(p.uid));
  const cuotasByPrestamo = {};
  cuotas.forEach(c => {
    if (!cuotasByPrestamo[c.PrestamoID]) cuotasByPrestamo[c.PrestamoID] = [];
    cuotasByPrestamo[c.PrestamoID].push(c);
  });
  prestamos.forEach(pr => {
    if (!pr.Estado) pr.Estado = 'Activo';
    pr.cuotas_detalle = (cuotasByPrestamo[pr.ID] || []).sort((a, b) => parseInt(a.Numero) - parseInt(b.Numero));
  });
  return { data: prestamos };
}

function addPrestamo(p) {
  const uid = p.uid;
  const montoTotal = parseFloat(p.montoTotal);
  const montoCuota = parseFloat(p.montoCuota);
  const numCuotas = parseInt(p.cuotas);
  if (!montoTotal || !montoCuota || !numCuotas || numCuotas < 1) return { error: 'Datos incompletos' };

  const totalAPagar = montoCuota * numCuotas;
  const tasaMensual = montoTotal > 0 ? (((totalAPagar / montoTotal) - 1) / numCuotas * 100) : 0;

  const id = Utilities.getUuid();
  const fechaInicio = p.fechaInicio || new Date().toISOString().slice(0, 10);

  getSheet('Prestamos').appendRow([
    id, uid, p.nombre || 'Préstamo', montoTotal, montoCuota,
    numCuotas, 0, tasaMensual.toFixed(2), fechaInicio,
    p.cuenta || '', 'Activo'
  ]);

  const cuotasSheet = getSheet('CuotasPrestamo');
  for (let i = 1; i <= numCuotas; i++) {
    const d = new Date(fechaInicio);
    d.setMonth(d.getMonth() + i);
    cuotasSheet.appendRow([
      Utilities.getUuid(), id, uid, i,
      d.toISOString().slice(0, 10), '', 'Pendiente'
    ]);
  }

  return { success: true, id, tasaMensual: tasaMensual.toFixed(2) };
}

function deletePrestamo(p) {
  const sheet = getSheet('Prestamos');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.id) && String(data[i][1]) === String(p.uid)) {
      sheet.deleteRow(i + 1);
      // Delete associated cuotas
      const cSheet = getSheet('CuotasPrestamo');
      const cData = cSheet.getDataRange().getValues();
      for (let j = cData.length - 1; j >= 1; j--) {
        if (String(cData[j][1]) === String(p.id)) cSheet.deleteRow(j + 1);
      }
      return { success: true };
    }
  }
  return { error: 'Préstamo no encontrado' };
}

function updateFechaCuota(p) {
  const sheet = getSheet('CuotasPrestamo');
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.cuotaId) && String(data[i][2]) === String(p.uid)) {
      sheet.getRange(i + 1, 5).setValue(p.fecha);
      return { success: true };
    }
  }
  return { error: 'Cuota no encontrada' };
}

function pagarCuota(p) {
  const cuotaSheet = getSheet('CuotasPrestamo');
  const cuotaData = cuotaSheet.getDataRange().getValues();
  let cuotaRow = -1, prestamoId = '', numero = 0;
  for (let i = 1; i < cuotaData.length; i++) {
    if (String(cuotaData[i][0]) === String(p.cuotaId) && String(cuotaData[i][2]) === String(p.uid)) {
      if (String(cuotaData[i][6]) === 'Pagada') return { error: 'Cuota ya pagada' };
      cuotaRow = i;
      prestamoId = String(cuotaData[i][1]);
      numero = parseInt(cuotaData[i][3]);
      break;
    }
  }
  if (cuotaRow < 0) return { error: 'Cuota no encontrada' };

  const prestSheet = getSheet('Prestamos');
  const prestData = prestSheet.getDataRange().getValues();
  for (let i = 1; i < prestData.length; i++) {
    if (String(prestData[i][0]) !== prestamoId || String(prestData[i][1]) !== String(p.uid)) continue;

    const numCuotas = parseInt(prestData[i][5]);
    let pagadas = parseInt(prestData[i][6]) || 0;
    const montoCuota = parseFloat(prestData[i][4]);
    const nombre = prestData[i][2];
    const cuenta = prestData[i][9];

    const hoy = new Date().toISOString().slice(0, 10);
    cuotaSheet.getRange(cuotaRow + 1, 6).setValue(hoy);
    cuotaSheet.getRange(cuotaRow + 1, 7).setValue('Pagada');

    pagadas++;
    prestSheet.getRange(i + 1, 7).setValue(pagadas);
    if (pagadas >= numCuotas) {
      prestSheet.getRange(i + 1, 11).setValue('Completado');
    }

    addTransaccion({
      uid: p.uid, fecha: hoy, tipo: 'gasto', categoria: 'Préstamo',
      descripcion: nombre + ' (cuota ' + numero + '/' + numCuotas + ')',
      monto: String(montoCuota), cuenta: cuenta
    });

    return { success: true, cuotasPagadas: pagadas, totalCuotas: numCuotas };
  }
  return { error: 'Préstamo no encontrado' };
}

function processPrestamos(p) {
  const uid = p.uid;
  const hoy = new Date().toISOString().slice(0, 10);
  const cuotaSheet = getSheet('CuotasPrestamo');
  const cuotaData = cuotaSheet.getDataRange().getValues();
  let processed = 0;

  for (let i = 1; i < cuotaData.length; i++) {
    if (String(cuotaData[i][2]) !== String(uid)) continue;
    if (String(cuotaData[i][6]) !== 'Pendiente') continue;
    const fechaVenc = String(cuotaData[i][4]);
    if (!fechaVenc || fechaVenc > hoy) continue;

    const prestamoId = String(cuotaData[i][1]);
    const numero = parseInt(cuotaData[i][3]);

    const prestSheet = getSheet('Prestamos');
    const prestData = prestSheet.getDataRange().getValues();
    for (let j = 1; j < prestData.length; j++) {
      if (String(prestData[j][0]) !== prestamoId) continue;
      if (String(prestData[j][10]) !== 'Activo') break;

      const numCuotas = parseInt(prestData[j][5]);
      let pagadas = parseInt(prestData[j][6]) || 0;
      const montoCuota = parseFloat(prestData[j][4]);
      const nombre = prestData[j][2];
      const cuenta = prestData[j][9];

      cuotaSheet.getRange(i + 1, 6).setValue(fechaVenc);
      cuotaSheet.getRange(i + 1, 7).setValue('Pagada');

      pagadas++;
      prestSheet.getRange(j + 1, 7).setValue(pagadas);
      if (pagadas >= numCuotas) prestSheet.getRange(j + 1, 11).setValue('Completado');

      addTransaccion({
        uid, fecha: fechaVenc, tipo: 'gasto', categoria: 'Préstamo',
        descripcion: nombre + ' (cuota ' + numero + '/' + numCuotas + ' - auto)',
        monto: String(montoCuota), cuenta: cuenta
      });
      processed++;
      break;
    }
  }
  return { success: true, processed };
}

// ══════════════════════════════════════════════════════════════
// ASESOR FINANCIERO IA — Google Gemini
// ══════════════════════════════════════════════════════════════

const GEMINI_API_KEY = 'AIzaSyBQFvh6JkGZBZwCdLbl28_Uq5TwwFfjBPM';

function chatIA(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (_) {
    return { error: 'JSON inválido' };
  }

  const uid = body.uid || e.parameter.uid;
  if (!uid) return { error: 'UID requerido' };

  const pregunta = body.pregunta;
  const historial = body.historial || [];
  if (!pregunta) return { error: 'Pregunta requerida' };

  const contexto = buildFinancialContext(uid);

  const users = sheetToArray(getSheet('Usuarios'));
  const user = users.find(u => String(u.UID) === String(uid));
  const userName = user ? user.Nombre.split(' ')[0] : 'amigo';
  const perfilIA = (user && user.PerfilIA) ? user.PerfilIA : '';

  const perfilBlock = perfilIA
    ? `\nPERFIL PERSONAL (escrito por el usuario sobre sí mismo):\n${perfilIA}\n`
    : '';

  const systemPrompt = `Eres un asesor financiero personal experto. Tu nombre es "FinAI".
El usuario se llama ${userName}.
Tu trabajo es analizar sus datos financieros reales y dar consejos prácticos, directos y accionables.
Conoces TODO su historial financiero y debes usarlo para dar consejos personalizados.
${perfilBlock}
REGLAS:
- Responde en español dominicano informal pero profesional
- Usa montos en formato RD$ cuando hables de dinero
- Sé directo y conciso, no des rodeos
- Si ves patrones preocupantes, dilo claro pero sin alarmar
- Basa tus respuestas en los datos reales del usuario y su perfil personal
- Recuerda el contexto personal del usuario para personalizar tus consejos
- Si no tienes datos suficientes para responder algo, dilo
- Puedes usar emojis moderadamente
- Formatea con markdown básico (negrita, listas) cuando ayude

DATOS FINANCIEROS COMPLETOS DEL USUARIO:
${contexto}`;

  const contents = [];
  historial.forEach(msg => {
    contents.push({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }]
    });
  });
  contents.push({ role: 'user', parts: [{ text: pregunta }] });

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + GEMINI_API_KEY;

  const payload = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: { temperature: 0.7, maxOutputTokens: 8192, topP: 0.9 }
  };

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'POST', contentType: 'application/json',
      payload: JSON.stringify(payload), muteHttpExceptions: true
    });
    const json = JSON.parse(response.getContentText());
    if (json.error) return { error: 'Error de Gemini: ' + json.error.message };
    const respuesta = json.candidates[0].content.parts[0].text;
    return { success: true, respuesta };
  } catch (err) {
    return { error: 'Error al conectar con Gemini: ' + err.message };
  }
}

function buildFinancialContext(uid) {
  const hoy = new Date();
  const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  const mesAnterior = hoy.getMonth() === 0
    ? (hoy.getFullYear() - 1) + '-12'
    : hoy.getFullYear() + '-' + String(hoy.getMonth()).padStart(2, '0');

  const txAll = filterByUser(sheetToArray(getSheet('Transacciones')), uid);
  const txNorm = txAll.map(t => ({
    Fecha: String(t.Fecha || ''), Tipo: String(t.Tipo || ''),
    Categoria: String(t.Categoria || ''), Descripcion: String(t.Descripcion || ''),
    Monto: parseMonto(t.Monto)
  }));

  function filtrarMes(data, mes) {
    return data.filter(r => fechaToMes(r.Fecha) === mes);
  }

  const txMesActual = filtrarMes(txNorm, mesActual);
  const txMesAnterior = filtrarMes(txNorm, mesAnterior);

  function calcularMes(rows) {
    let ing = 0, gas = 0, pag = 0;
    const porCat = {};
    rows.forEach(r => {
      if (esTipo(r.Tipo, 'ingreso')) ing += r.Monto;
      else if (esTipo(r.Tipo, 'pago')) { pag += r.Monto; porCat[r.Categoria] = (porCat[r.Categoria] || 0) + r.Monto; }
      else { gas += r.Monto; porCat[r.Categoria] = (porCat[r.Categoria] || 0) + r.Monto; }
    });
    return { ingresos: ing, gastos: gas, pagos: pag, balance: ing - gas - pag, porCategoria: porCat };
  }

  const resActual = calcularMes(txMesActual);
  const resAnterior = calcularMes(txMesAnterior);

  const presupuestos = filterByUser(sheetToArray(getSheet('Presupuestos')), uid).map(p => ({
    Categoria: p.Categoria || '', Limite: parseMonto(p.MontoMensual || 0)
  }));

  const presVsReal = presupuestos.map(p => {
    const gastado = resActual.porCategoria[p.Categoria] || 0;
    const pct = p.Limite > 0 ? ((gastado / p.Limite) * 100).toFixed(0) : 0;
    return `${p.Categoria}: gastado RD$${gastado.toLocaleString()} de RD$${p.Limite.toLocaleString()} (${pct}%)`;
  });

  const metas = filterByUser(sheetToArray(getSheet('Metas')), uid).map(m => {
    const obj = parseFloat(m.MontoObjetivo) || 0;
    const act = parseFloat(m.MontoActual) || 0;
    const pct = obj > 0 ? ((act / obj) * 100).toFixed(0) : 0;
    return `${m.Nombre}: RD$${act.toLocaleString()} de RD$${obj.toLocaleString()} (${pct}%) - ${m.Estado}`;
  });

  const cuentas = filterByUser(sheetToArray(getSheet('Cuentas')), uid).map(c =>
    `${c.Nombre} (${c.Tipo}): saldo inicial RD$${(parseFloat(c.SaldoInicial) || 0).toLocaleString()}`
  );

  const topGastos = txMesActual
    .filter(t => esTipo(t.Tipo, 'gasto') || esTipo(t.Tipo, 'pago'))
    .sort((a, b) => b.Monto - a.Monto).slice(0, 5)
    .map(t => `${t.Descripcion || t.Categoria} (${t.Tipo}): RD$${t.Monto.toLocaleString()}`);

  const meses12 = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const r = calcularMes(filtrarMes(txNorm, m));
    if (r.ingresos > 0 || r.gastos > 0 || r.pagos > 0) {
      meses12.push(`${m}: Ingresos RD$${r.ingresos.toLocaleString()}, Gastos RD$${r.gastos.toLocaleString()}, Pagos RD$${r.pagos.toLocaleString()}, Balance RD$${r.balance.toLocaleString()}`);
    }
  }

  const categorias = filterByUser(sheetToArray(getSheet('Categorias')), uid).map(c => `${c.Nombre} (${c.Tipo})`);

  const recurrentes = filterByUser(sheetToArray(getSheet('Recurrentes')), uid).map(r =>
    `${r.Descripcion || r.Categoria} (${r.Tipo}): RD$${(parseFloat(r.Monto)||0).toLocaleString()} - ${r.Frecuencia}`
  );

  const prestamos = filterByUser(sheetToArray(getSheet('Prestamos')), uid);
  const cuotasPrest = filterByUser(sheetToArray(getSheet('CuotasPrestamo')), uid);
  const prestamosInfo = prestamos.map(p => {
    const cuotas = parseInt(p.Cuotas) || 0;
    const pagadas = parseInt(p.CuotasPagadas) || 0;
    const montoCuota = parseFloat(p.MontoCuota) || 0;
    const montoTotal = parseFloat(p.MontoTotal) || 0;
    const totalPagar = montoCuota * cuotas;
    const deudaRestante = montoCuota * (cuotas - pagadas);
    const misCuotas = cuotasPrest.filter(c => String(c.PrestamoID) === String(p.ID))
      .sort((a, b) => parseInt(a.Numero) - parseInt(b.Numero));
    const proxCuota = misCuotas.find(c => c.Estado === 'Pendiente');
    return `${p.Nombre}: Capital RD$${montoTotal.toLocaleString()}, Cuota RD$${montoCuota.toLocaleString()}, ${pagadas}/${cuotas} cuotas pagadas, Tasa ${p.TasaMensual}%/mes, Total a pagar RD$${totalPagar.toLocaleString()}, Deuda restante RD$${deudaRestante.toLocaleString()}, Estado: ${p.Estado || 'Activo'}${proxCuota ? ', Próxima cuota: ' + proxCuota.FechaVencimiento : ''}`;
  });
  const deudaTotal = prestamos.filter(p => (p.Estado || 'Activo') === 'Activo')
    .reduce((s, p) => s + (parseFloat(p.MontoCuota) || 0) * (parseInt(p.Cuotas) - (parseInt(p.CuotasPagadas) || 0)), 0);

  const txRecientes = txNorm.sort((a, b) => b.Fecha.localeCompare(a.Fecha)).slice(0, 30)
    .map(t => `${t.Fecha} | ${t.Tipo} | ${t.Categoria} | ${t.Descripcion} | RD$${t.Monto.toLocaleString()}`);

  const totalHistIng = txNorm.filter(t => esTipo(t.Tipo, 'ingreso')).reduce((s, t) => s + t.Monto, 0);
  const totalHistGas = txNorm.filter(t => esTipo(t.Tipo, 'gasto')).reduce((s, t) => s + t.Monto, 0);
  const totalHistPag = txNorm.filter(t => esTipo(t.Tipo, 'pago')).reduce((s, t) => s + t.Monto, 0);

  return `
Fecha actual: ${hoy.toLocaleDateString('es-DO')}

═══ RESUMEN MES ACTUAL (${mesActual}) ═══
- Ingresos: RD$${resActual.ingresos.toLocaleString()}
- Gastos: RD$${resActual.gastos.toLocaleString()}
- Pagos: RD$${resActual.pagos.toLocaleString()}
- Balance: RD$${resActual.balance.toLocaleString()}
- Tasa de ahorro: ${resActual.ingresos > 0 ? ((resActual.balance / resActual.ingresos) * 100).toFixed(1) : 0}%
- Transacciones: ${txMesActual.length}

═══ MES ANTERIOR (${mesAnterior}) ═══
- Ingresos: RD$${resAnterior.ingresos.toLocaleString()}
- Gastos: RD$${resAnterior.gastos.toLocaleString()}
- Pagos: RD$${resAnterior.pagos.toLocaleString()}
- Balance: RD$${resAnterior.balance.toLocaleString()}

═══ HISTORIAL 12 MESES ═══
${meses12.join('\n')}

═══ TOTALES HISTÓRICOS (${txAll.length} transacciones) ═══
- Total ingresos: RD$${totalHistIng.toLocaleString()}
- Total gastos: RD$${totalHistGas.toLocaleString()}
- Total pagos: RD$${totalHistPag.toLocaleString()}
- Balance histórico neto: RD$${(totalHistIng - totalHistGas - totalHistPag).toLocaleString()}

═══ TOP 5 GASTOS ESTE MES ═══
${topGastos.join('\n')}

═══ GASTOS POR CATEGORÍA ESTE MES ═══
${Object.entries(resActual.porCategoria).sort((a,b) => b[1]-a[1]).map(([c,m]) => `${c}: RD$${m.toLocaleString()}`).join('\n')}

═══ PRESUPUESTOS VS REAL ═══
${presVsReal.length > 0 ? presVsReal.join('\n') : 'Sin presupuestos configurados'}

═══ METAS DE AHORRO ═══
${metas.length > 0 ? metas.join('\n') : 'Sin metas configuradas'}

═══ CUENTAS ═══
${cuentas.length > 0 ? cuentas.join('\n') : 'Sin cuentas configuradas'}

═══ TRANSACCIONES RECURRENTES ═══
${recurrentes.length > 0 ? recurrentes.join('\n') : 'Sin recurrentes configuradas'}

═══ PRÉSTAMOS ═══
${prestamosInfo.length > 0 ? prestamosInfo.join('\n') : 'Sin préstamos registrados'}
${prestamos.length > 0 ? `Deuda total activa: RD$${deudaTotal.toLocaleString()}` : ''}

═══ ÚLTIMAS 30 TRANSACCIONES ═══
${txRecientes.join('\n')}

Categorías disponibles: ${categorias.join(', ')}
`.trim();
}

// ══════════════════════════════════════════════════════════════
// TRANSFERENCIAS ENTRE CUENTAS
// ══════════════════════════════════════════════════════════════

function transferir(p) {
  const uid = p.uid;
  const monto = parseFloat(p.monto);
  if (!monto || !p.origen || !p.destino) return { error: 'Datos incompletos' };
  if (p.origen === p.destino) return { error: 'Origen y destino deben ser diferentes' };
  const fecha = p.fecha || new Date().toISOString().slice(0, 10);
  const desc = p.descripcion || 'Transferencia ' + p.origen + ' → ' + p.destino;

  addTransaccion({ uid, fecha, tipo: 'gasto', categoria: 'Transferencia', descripcion: desc, monto: String(monto), cuenta: p.origen });
  addTransaccion({ uid, fecha, tipo: 'ingreso', categoria: 'Transferencia', descripcion: desc, monto: String(monto), cuenta: p.destino });

  return { success: true };
}

// ══════════════════════════════════════════════════════════════
// PROYECCIÓN FINANCIERA (IA)
// ══════════════════════════════════════════════════════════════

function getProyeccion(p) {
  const uid = p.uid;
  const txAll = filterByUser(sheetToArray(getSheet('Transacciones')), uid);
  const recurrentes = filterByUser(sheetToArray(getSheet('Recurrentes')), uid);
  const prestamos = filterByUser(sheetToArray(getSheet('Prestamos')), uid).filter(pr => pr.Estado === 'Activo' || !pr.Estado);
  const cuotas = filterByUser(sheetToArray(getSheet('CuotasPrestamo')), uid).filter(c => c.Estado === 'Pendiente');

  const hoy = new Date();
  const meses = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  meses.reverse();

  const historial = meses.map(m => {
    const txMes = txAll.filter(t => fechaToMes(t.Fecha) === m);
    let ing = 0, gas = 0;
    txMes.forEach(t => {
      const monto = parseMonto(t.Monto);
      if (esTipo(t.Tipo, 'ingreso')) ing += monto; else gas += monto;
    });
    return { mes: m, ingresos: ing, gastos: gas, balance: ing - gas };
  });

  const avgIng = historial.reduce((s, h) => s + h.ingresos, 0) / Math.max(historial.length, 1);
  const avgGas = historial.reduce((s, h) => s + h.gastos, 0) / Math.max(historial.length, 1);

  const recIng = recurrentes.filter(r => esTipo(r.Tipo, 'ingreso')).reduce((s, r) => s + parseMonto(r.Monto), 0);
  const recGas = recurrentes.filter(r => !esTipo(r.Tipo, 'ingreso')).reduce((s, r) => s + parseMonto(r.Monto), 0);

  const cuotasMensuales = {};
  cuotas.forEach(c => {
    const m = fechaToMes(c.FechaVencimiento);
    const pr = prestamos.find(p => String(p.ID) === String(c.PrestamoID));
    if (pr) cuotasMensuales[m] = (cuotasMensuales[m] || 0) + parseMonto(pr.MontoCuota);
  });

  const proyeccion = [];
  for (let i = 1; i <= 6; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    const m = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    const ingProyectado = Math.max(avgIng, recIng);
    const gasProyectado = Math.max(avgGas, recGas) + (cuotasMensuales[m] || 0);
    proyeccion.push({ mes: m, ingresos: Math.round(ingProyectado), gastos: Math.round(gasProyectado), balance: Math.round(ingProyectado - gasProyectado) });
  }

  return { success: true, historial, proyeccion, promedios: { ingresos: Math.round(avgIng), gastos: Math.round(avgGas) } };
}

// ══════════════════════════════════════════════════════════════
// REPORTE MENSUAL
// ══════════════════════════════════════════════════════════════

function getReporteMensual(p) {
  const uid = p.uid;
  const mes = p.mes;
  if (!mes) return { error: 'Parámetro mes requerido' };

  const txAll = filterByUser(sheetToArray(getSheet('Transacciones')), uid);
  const txMes = txAll.filter(t => fechaToMes(t.Fecha) === mes);

  let ingresos = 0, gastos = 0, pagos = 0;
  const porCategoria = {};
  const porCuenta = {};

  txMes.forEach(t => {
    const m = parseMonto(t.Monto);
    const cat = t.Categoria || 'Otros';
    const cta = t.Cuenta || 'General';
    if (esTipo(t.Tipo, 'ingreso')) { ingresos += m; }
    else if (esTipo(t.Tipo, 'pago')) { pagos += m; porCategoria[cat] = (porCategoria[cat] || 0) + m; }
    else { gastos += m; porCategoria[cat] = (porCategoria[cat] || 0) + m; }
    porCuenta[cta] = (porCuenta[cta] || 0) + (esTipo(t.Tipo, 'ingreso') ? m : -m);
  });

  const presupuestos = filterByUser(sheetToArray(getSheet('Presupuestos')), uid);
  const presVsReal = presupuestos.map(pr => ({
    categoria: pr.Categoria,
    limite: parseMonto(pr.MontoMensual),
    gastado: porCategoria[pr.Categoria] || 0,
    pct: parseMonto(pr.MontoMensual) > 0 ? Math.round((porCategoria[pr.Categoria] || 0) / parseMonto(pr.MontoMensual) * 100) : 0
  }));

  const topGastos = Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([cat, monto]) => ({ categoria: cat, monto }));

  const users = sheetToArray(getSheet('Usuarios'));
  const user = users.find(u => String(u.UID) === String(uid));

  return {
    success: true, mes,
    usuario: user ? user.Nombre : 'Usuario',
    resumen: { ingresos, gastos, pagos, balance: ingresos - gastos - pagos, totalTx: txMes.length },
    topGastos, presVsReal, porCuenta
  };
}

// ══════════════════════════════════════════════════════════════
// PREFERENCIAS DE NOTIFICACIÓN
// ══════════════════════════════════════════════════════════════

function getPreferencias(p) {
  const users = sheetToArray(getSheet('Usuarios'));
  const user = users.find(u => String(u.UID) === String(p.uid));
  if (!user) return { error: 'Usuario no encontrado' };
  let prefs = { resumenSemanal: false, recordatorioCuotas: false, alertaPresupuesto: false };
  try { if (user.Recordatorios) prefs = JSON.parse(user.Recordatorios); } catch(e) {}
  return { success: true, data: prefs };
}

function updatePreferencias(p) {
  const sheet = getSheet('Usuarios');
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const colIdx = headers.indexOf('Recordatorios');
  if (colIdx === -1) return { error: 'Columna no encontrada' };
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(p.uid)) {
      const prefs = JSON.stringify({
        resumenSemanal: p.resumenSemanal === 'true' || p.resumenSemanal === true,
        recordatorioCuotas: p.recordatorioCuotas === 'true' || p.recordatorioCuotas === true,
        alertaPresupuesto: p.alertaPresupuesto === 'true' || p.alertaPresupuesto === true
      });
      sheet.getRange(i + 1, colIdx + 1).setValue(prefs);
      return { success: true };
    }
  }
  return { error: 'Usuario no encontrado' };
}

// ══════════════════════════════════════════════════════════════
// RESUMEN SEMANAL POR EMAIL (Trigger: cada lunes)
// En Apps Script: Triggers > Add Trigger > enviarResumenSemanal > Time-driven > Week timer > Monday
// ══════════════════════════════════════════════════════════════

function enviarResumenSemanal() {
  const usuarios = sheetToArray(getSheet('Usuarios'));
  usuarios.forEach(u => {
    if (!u.Email || !u.UID) return;
    let prefs = { resumenSemanal: false, recordatorioCuotas: false, alertaPresupuesto: false };
    try { if (u.Recordatorios) prefs = JSON.parse(u.Recordatorios); } catch(e) {}
    if (!prefs.resumenSemanal && !prefs.recordatorioCuotas && !prefs.alertaPresupuesto) return;
    try {
      const ctx = buildWeeklyEmailContext(u.UID);
      if (!ctx) return;
      if (!prefs.recordatorioCuotas) ctx.cuotasProximas = [];
      if (!prefs.alertaPresupuesto) ctx.presAlerta = [];
      const html = buildWeeklyEmailHTML(u.Nombre || 'Usuario', ctx);
      MailApp.sendEmail({
        to: u.Email,
        subject: '📊 FinApp — Tu resumen semanal',
        htmlBody: html
      });
    } catch (err) {
      Logger.log('Error enviando email a ' + u.Email + ': ' + err.message);
    }
  });
}

function buildWeeklyEmailContext(uid) {
  const hoy = new Date();
  const hace7 = new Date(hoy);
  hace7.setDate(hace7.getDate() - 7);
  const hace7Str = hace7.toISOString().slice(0, 10);
  const hoyStr = hoy.toISOString().slice(0, 10);

  const txAll = filterByUser(sheetToArray(getSheet('Transacciones')), uid);
  const txSemana = txAll.filter(t => {
    const f = String(t.Fecha || '').slice(0, 10);
    return f >= hace7Str && f <= hoyStr;
  });

  let ing = 0, gas = 0, pag = 0;
  txSemana.forEach(t => {
    const m = parseMonto(t.Monto);
    if (esTipo(t.Tipo, 'ingreso')) ing += m;
    else if (esTipo(t.Tipo, 'pago')) pag += m;
    else gas += m;
  });

  const presupuestos = filterByUser(sheetToArray(getSheet('Presupuestos')), uid);
  const mesActual = hoy.getFullYear() + '-' + String(hoy.getMonth() + 1).padStart(2, '0');
  const txMes = txAll.filter(t => fechaToMes(String(t.Fecha || '')) === mesActual);
  const spent = {};
  txMes.filter(t => esTipo(t.Tipo, 'gasto') || esTipo(t.Tipo, 'pago')).forEach(t => {
    spent[t.Categoria] = (spent[t.Categoria] || 0) + parseMonto(t.Monto);
  });
  const presAlerta = presupuestos.filter(p => {
    const limite = parseMonto(p.MontoMensual);
    const gastado = spent[p.Categoria] || 0;
    return limite > 0 && (gastado / limite) >= 0.8;
  }).map(p => ({
    cat: p.Categoria, limite: parseMonto(p.MontoMensual),
    gastado: spent[p.Categoria] || 0,
    pct: Math.round((spent[p.Categoria] || 0) / parseMonto(p.MontoMensual) * 100)
  }));

  const cuotas = filterByUser(sheetToArray(getSheet('CuotasPrestamo')), uid);
  const proxSemana = new Date(hoy);
  proxSemana.setDate(proxSemana.getDate() + 7);
  const proxSemanaStr = proxSemana.toISOString().slice(0, 10);
  const cuotasProximas = cuotas.filter(c =>
    c.Estado === 'Pendiente' && String(c.FechaVencimiento || '').slice(0, 10) <= proxSemanaStr
  );

  const prestamos = filterByUser(sheetToArray(getSheet('Prestamos')), uid);
  const cuotasConNombre = cuotasProximas.map(c => {
    const pr = prestamos.find(p => String(p.ID) === String(c.PrestamoID));
    return { nombre: pr ? pr.Nombre : 'Préstamo', numero: c.Numero, fecha: String(c.FechaVencimiento || '').slice(0, 10), monto: pr ? parseMonto(pr.MontoCuota) : 0 };
  });

  return { ing, gas, pag, balance: ing - gas - pag, txCount: txSemana.length, presAlerta, cuotasProximas: cuotasConNombre };
}

function buildWeeklyEmailHTML(nombre, ctx) {
  const fmt = n => 'RD$ ' + Number(n).toLocaleString('es-DO');
  let presHTML = '';
  if (ctx.presAlerta.length > 0) {
    presHTML = '<h3 style="color:#f39c12;margin:16px 0 8px">⚠️ Presupuestos en alerta</h3><ul>' +
      ctx.presAlerta.map(p => `<li><strong>${p.cat}</strong>: ${fmt(p.gastado)} de ${fmt(p.limite)} (${p.pct}%)</li>`).join('') + '</ul>';
  }
  let cuotasHTML = '';
  if (ctx.cuotasProximas.length > 0) {
    cuotasHTML = '<h3 style="color:#e74c3c;margin:16px 0 8px">🏧 Cuotas próximas</h3><ul>' +
      ctx.cuotasProximas.map(c => `<li><strong>${c.nombre}</strong> cuota #${c.numero} — ${fmt(c.monto)} — vence ${c.fecha}</li>`).join('') + '</ul>';
  }
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
    <h1 style="color:#6C5CE7">💎 FinApp</h1>
    <p>Hola <strong>${nombre.split(' ')[0]}</strong>, aquí tienes tu resumen de la semana:</p>
    <div style="background:#f8f9fc;padding:16px;border-radius:12px;margin:16px 0">
      <h3 style="margin:0 0 12px;color:#6C5CE7">📊 Resumen semanal</h3>
      <p>✅ Ingresos: <strong style="color:#00b894">${fmt(ctx.ing)}</strong></p>
      <p>❌ Gastos: <strong style="color:#e74c3c">${fmt(ctx.gas)}</strong></p>
      <p>💳 Pagos: <strong style="color:#0984e3">${fmt(ctx.pag)}</strong></p>
      <p>💰 Balance: <strong>${fmt(ctx.balance)}</strong></p>
      <p style="color:#6b7280;font-size:13px">${ctx.txCount} transacciones esta semana</p>
    </div>
    ${presHTML}${cuotasHTML}
    <p style="color:#9ca3af;font-size:12px;margin-top:24px;text-align:center">Enviado automáticamente por FinApp cada lunes</p>
  </div>`;
}

// ── Test permission trigger ──
function testPermiso() {
  var res = UrlFetchApp.fetch('https://httpbin.org/get');
  Logger.log(res.getContentText());
}
