import { db, currentUser } from './firebase-config.js';

function uid() {
  const u = currentUser();
  if (!u) throw new Error('No autenticado');
  return u.uid;
}

function userDoc() {
  return db.collection('users').doc(uid());
}

function col(name) {
  return userDoc().collection(name);
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// ── Generic CRUD ─────────────────────────────────────────────

async function getAll(collection, orderField, orderDir = 'desc') {
  let q = col(collection);
  if (orderField) q = q.orderBy(orderField, orderDir);
  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function getDoc(collection, id) {
  const doc = await col(collection).doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function addDoc(collection, data) {
  const id = generateId();
  const doc = { ...data, createdAt: Date.now() };
  await col(collection).doc(id).set(doc);
  return { id, ...doc };
}

async function updateDoc(collection, id, data) {
  await col(collection).doc(id).update(data);
}

async function deleteDoc(collection, id) {
  await col(collection).doc(id).delete();
}

// ── User Profile ─────────────────────────────────────────────

export async function getProfile() {
  const doc = await userDoc().get();
  return doc.exists ? doc.data() : null;
}

export async function saveProfile(data) {
  await userDoc().set(data, { merge: true });
}

// ── Transacciones ────────────────────────────────────────────

export async function getTransacciones() {
  return getAll('transacciones', 'fecha');
}

export async function addTransaccion(tx) {
  const data = {
    fecha: tx.fecha,
    tipo: tx.tipo,
    categoria: tx.categoria,
    descripcion: tx.descripcion || '',
    monto: parseFloat(tx.monto) || 0,
    cuenta: tx.cuenta || 'General'
  };
  if (tx.metaId) data.metaId = tx.metaId;
  return addDoc('transacciones', data);
}

export async function editTransaccion(id, tx) {
  const data = {};
  if (tx.fecha !== undefined) data.fecha = tx.fecha;
  if (tx.tipo !== undefined) data.tipo = tx.tipo;
  if (tx.categoria !== undefined) data.categoria = tx.categoria;
  if (tx.descripcion !== undefined) data.descripcion = tx.descripcion;
  if (tx.monto !== undefined) data.monto = parseFloat(tx.monto) || 0;
  if (tx.cuenta !== undefined) data.cuenta = tx.cuenta;
  await updateDoc('transacciones', id, data);
}

export async function deleteTransaccion(id) {
  await deleteDoc('transacciones', id);
}

export async function importTransacciones(rows) {
  const batch = db.batch();
  rows.forEach(r => {
    const id = generateId();
    const ref = col('transacciones').doc(id);
    batch.set(ref, {
      fecha: r.fecha || new Date().toISOString().slice(0, 10),
      tipo: r.tipo || 'gasto',
      categoria: r.categoria || 'Otros',
      descripcion: r.descripcion || '',
      monto: parseFloat(String(r.monto).replace(/[^0-9.\-]/g, '')) || 0,
      cuenta: r.cuenta || 'General',
      createdAt: Date.now()
    });
  });
  await batch.commit();
  return rows.length;
}

// ── Presupuestos ─────────────────────────────────────────────

export async function getPresupuestos() {
  return getAll('presupuestos');
}

export async function addPresupuesto(p) {
  const montoLimite = parseFloat(p.montoLimite) || 0;
  const existing = await col('presupuestos').where('categoria', '==', p.categoria).get();
  if (!existing.empty) {
    const id = existing.docs[0].id;
    await updateDoc('presupuestos', id, { montoLimite });
    return { id, categoria: p.categoria, montoLimite };
  }
  return addDoc('presupuestos', { categoria: p.categoria, montoLimite });
}

export async function deletePresupuesto(id) {
  await deleteDoc('presupuestos', id);
}

// ── Categorías ───────────────────────────────────────────────

export async function getCategorias() {
  return getAll('categorias', 'nombre', 'asc');
}

export async function addCategoria(c) {
  return addDoc('categorias', {
    tipo: c.tipo || 'gasto',
    nombre: c.nombre,
    icono: c.icono || '',
    color: c.color || ''
  });
}

export async function updateCategoria(id, data) {
  await updateDoc('categorias', id, data);
}

export async function deleteCategoria(id) {
  await deleteDoc('categorias', id);
}

// ── Metas ────────────────────────────────────────────────────

export async function getMetas() {
  return getAll('metas');
}

export async function addMeta(m) {
  const montoObjetivo = parseFloat(m.montoObjetivo) || 0;
  const meses = parseInt(m.meses) || 0;
  let categoriaAhorro = null;
  const cats = await getCategorias();
  if (!cats.find(c => c.nombre === 'Ahorro')) {
    categoriaAhorro = await addCategoria({ tipo: 'gasto', nombre: 'Ahorro', icono: '💰' });
  }
  const meta = await addDoc('metas', {
    nombre: m.nombre,
    montoObjetivo,
    montoActual: 0,
    meses,
    montoMensual: meses > 0 ? +(montoObjetivo / meses).toFixed(2) : 0,
    mesesAbonados: 0,
    ultimoAbonoMes: '',
    cuenta: m.cuenta || 'General',
    fechaLimite: m.fechaLimite || '',
    estado: 'Activa'
  });
  return { ...meta, categoriaAhorro };
}

export async function updateMeta(id, data) {
  await updateDoc('metas', id, data);
}

export async function editarMeta(id, m) {
  const meta = await getDoc('metas', id);
  if (!meta) throw new Error('Meta no encontrada');
  const montoObjetivo = parseFloat(m.montoObjetivo) || 0;
  const meses = parseInt(m.meses) || 0;
  const estado = montoObjetivo > 0 && (meta.montoActual || 0) >= montoObjetivo ? 'Completada' : 'Activa';
  const data = {
    nombre: m.nombre,
    montoObjetivo,
    meses,
    montoMensual: meses > 0 ? +(montoObjetivo / meses).toFixed(2) : 0,
    cuenta: m.cuenta || 'General',
    fechaLimite: m.fechaLimite || '',
    estado
  };
  await updateDoc('metas', id, data);
  return { id, ...meta, ...data };
}

export async function abonarMontoMeta(id, monto) {
  const meta = await getDoc('metas', id);
  if (!meta) throw new Error('Meta no encontrada');
  if (meta.estado === 'Completada') throw new Error('Esta meta ya fue completada');
  const cantidad = parseFloat(monto) || 0;
  if (cantidad <= 0) throw new Error('Monto inválido');

  const nuevo = (meta.montoActual || 0) + cantidad;
  const estado = nuevo >= meta.montoObjetivo ? 'Completada' : 'Activa';
  await updateDoc('metas', id, { montoActual: nuevo, estado });

  const tx = await addTransaccion({
    fecha: new Date().toISOString().slice(0, 10),
    tipo: 'ahorro',
    categoria: 'Ahorro',
    descripcion: `Abono meta: ${meta.nombre}`,
    monto: cantidad,
    cuenta: meta.cuenta || 'General',
    metaId: id
  });

  return { montoActual: nuevo, estado, monto: cantidad, tx };
}

export async function abonarMesMeta(id) {
  const meta = await getDoc('metas', id);
  if (!meta) throw new Error('Meta no encontrada');
  if (meta.estado === 'Completada') throw new Error('Esta meta ya fue completada');
  const cuota = parseFloat(meta.montoMensual) || 0;
  if (cuota <= 0) throw new Error('Esta meta no tiene cuota mensual configurada');
  const mesActual = new Date().toISOString().slice(0, 7);
  if (meta.ultimoAbonoMes === mesActual) throw new Error('Ya abonaste el mes de ' + mesActual);

  const nuevo = (meta.montoActual || 0) + cuota;
  const mesesAbonados = (meta.mesesAbonados || 0) + 1;
  const estado = nuevo >= meta.montoObjetivo ? 'Completada' : 'Activa';
  await updateDoc('metas', id, { montoActual: nuevo, mesesAbonados, estado, ultimoAbonoMes: mesActual });

  const tx = await addTransaccion({
    fecha: new Date().toISOString().slice(0, 10),
    tipo: 'ahorro',
    categoria: 'Ahorro',
    descripcion: `Abono meta: ${meta.nombre}`,
    monto: cuota,
    cuenta: meta.cuenta || 'General',
    metaId: id
  });

  return { montoActual: nuevo, estado, cuota, mesesAbonados, tx };
}

export async function deleteMeta(id, eliminarAbonos) {
  await deleteDoc('metas', id);
  if (!eliminarAbonos) return [];
  const snap = await col('transacciones').where('metaId', '==', id).get();
  if (snap.empty) return [];
  const batch = db.batch();
  const ids = [];
  snap.docs.forEach(d => { batch.delete(d.ref); ids.push(d.id); });
  await batch.commit();
  return ids;
}

// ── Cuentas ──────────────────────────────────────────────────

export async function getCuentas() {
  return getAll('cuentas', 'nombre', 'asc');
}

export async function addCuenta(c) {
  return addDoc('cuentas', {
    nombre: c.nombre,
    tipo: c.tipo || 'Banco',
    saldoInicial: parseFloat(c.saldoInicial) || 0
  });
}

export async function deleteCuenta(id) {
  await deleteDoc('cuentas', id);
}

// ── Recurrentes ──────────────────────────────────────────────

export async function getRecurrentes() {
  return getAll('recurrentes');
}

export async function addRecurrente(r) {
  return addDoc('recurrentes', {
    tipo: r.tipo || 'gasto',
    categoria: r.categoria,
    descripcion: r.descripcion || '',
    monto: parseFloat(r.monto) || 0,
    cuenta: r.cuenta || 'General',
    frecuencia: r.frecuencia || 'mensual',
    proximaFecha: r.proximaFecha || ''
  });
}

export async function deleteRecurrente(id) {
  await deleteDoc('recurrentes', id);
}

export async function processRecurrentes() {
  const hoy = new Date().toISOString().slice(0, 10);
  const recs = await getRecurrentes();
  let processed = 0;

  for (const r of recs) {
    if (!r.proximaFecha || r.proximaFecha > hoy) continue;
    await addTransaccion({
      fecha: r.proximaFecha, tipo: r.tipo,
      categoria: r.categoria,
      descripcion: (r.descripcion || '') + ' (recurrente)',
      monto: String(r.monto), cuenta: r.cuenta
    });

    const d = new Date(r.proximaFecha);
    if (r.frecuencia === 'semanal') d.setDate(d.getDate() + 7);
    else if (r.frecuencia === 'quincenal') d.setDate(d.getDate() + 15);
    else if (r.frecuencia === 'mensual') d.setMonth(d.getMonth() + 1);
    else if (r.frecuencia === 'anual') d.setFullYear(d.getFullYear() + 1);

    await updateDoc('recurrentes', r.id, { proximaFecha: d.toISOString().slice(0, 10) });
    processed++;
  }
  return processed;
}

// ── Préstamos ────────────────────────────────────────────────

export async function getPrestamos() {
  const prestamos = await getAll('prestamos');
  await Promise.all(prestamos.map(async pr => {
    if (!pr.estado) pr.estado = 'Activo';
    const cuotasSnap = await col('prestamos').doc(pr.id).collection('cuotas').orderBy('numero').get();
    pr.cuotas_detalle = cuotasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  }));
  return prestamos;
}

export async function getPrestamo(id) {
  const pr = await getDoc('prestamos', id);
  if (!pr) return null;
  if (!pr.estado) pr.estado = 'Activo';
  const cuotasSnap = await col('prestamos').doc(id).collection('cuotas').orderBy('numero').get();
  pr.cuotas_detalle = cuotasSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  return pr;
}

export async function addPrestamo(p) {
  const montoTotal = parseFloat(p.montoTotal);
  const montoCuota = parseFloat(p.montoCuota);
  const numCuotas = parseInt(p.cuotas);
  const totalPagar = montoCuota * numCuotas;
  const tasaMensual = montoTotal > 0 ? (((totalPagar / montoTotal) - 1) / numCuotas * 100) : 0;
  const fechaInicio = p.fechaInicio || new Date().toISOString().slice(0, 10);

  const id = generateId();
  const ref = col('prestamos').doc(id);
  await ref.set({
    nombre: p.nombre || 'Prestamo',
    tipo: p.tipo || 'Debo',
    descripcion: p.descripcion || '',
    montoTotal, montoCuota, cuotas: numCuotas,
    cuotasPagadas: 0, tasaMensual: parseFloat(tasaMensual.toFixed(2)),
    fechaInicio, cuenta: p.cuenta || '', estado: 'Activo',
    createdAt: Date.now()
  });

  const batch = db.batch();
  for (let i = 1; i <= numCuotas; i++) {
    const d = new Date(fechaInicio);
    d.setMonth(d.getMonth() + i);
    const cRef = ref.collection('cuotas').doc(generateId());
    batch.set(cRef, {
      numero: i, fechaVencimiento: d.toISOString().slice(0, 10),
      fechaPago: '', estado: 'Pendiente'
    });
  }
  await batch.commit();
  return { id, tasaMensual: tasaMensual.toFixed(2) };
}

export async function deletePrestamo(id) {
  const cuotasSnap = await col('prestamos').doc(id).collection('cuotas').get();
  const batch = db.batch();
  cuotasSnap.docs.forEach(d => batch.delete(d.ref));
  batch.delete(col('prestamos').doc(id));
  await batch.commit();
}

export async function pagarCuota(prestamoId, cuotaId) {
  const prRef = col('prestamos').doc(prestamoId);
  const prDoc = await prRef.get();
  if (!prDoc.exists) throw new Error('Prestamo no encontrado');
  const pr = prDoc.data();

  const cRef = prRef.collection('cuotas').doc(cuotaId);
  const cDoc = await cRef.get();
  if (!cDoc.exists) throw new Error('Cuota no encontrada');
  if (cDoc.data().estado === 'Pagada') throw new Error('Cuota ya pagada');

  const hoy = new Date().toISOString().slice(0, 10);
  await cRef.update({ fechaPago: hoy, estado: 'Pagada' });

  const pagadas = (pr.cuotasPagadas || 0) + 1;
  const updates = { cuotasPagadas: pagadas };
  if (pagadas >= pr.cuotas) updates.estado = 'Completado';
  await prRef.update(updates);

  const tx = await addTransaccion({
    fecha: hoy, tipo: 'gasto', categoria: 'Prestamo',
    descripcion: `${pr.nombre} (cuota ${cDoc.data().numero}/${pr.cuotas})`,
    monto: String(pr.montoCuota), cuenta: pr.cuenta
  });

  return { cuotasPagadas: pagadas, totalCuotas: pr.cuotas, tx };
}

export async function updateFechaCuota(prestamoId, cuotaId, fecha) {
  await col('prestamos').doc(prestamoId).collection('cuotas').doc(cuotaId).update({ fechaVencimiento: fecha });
}

// ── Transferencias ───────────────────────────────────────────

export async function transferir(t) {
  const fecha = t.fecha || new Date().toISOString().slice(0, 10);
  const desc = t.descripcion || `Transferencia ${t.origen} → ${t.destino}`;
  const monto = parseFloat(t.monto);
  const txSalida = await addTransaccion({ fecha, tipo: 'gasto', categoria: 'Transferencia', descripcion: desc, monto: String(monto), cuenta: t.origen });
  const txEntrada = await addTransaccion({ fecha, tipo: 'ingreso', categoria: 'Transferencia', descripcion: desc, monto: String(monto), cuenta: t.destino });
  return [txSalida, txEntrada];
}

// ── Preferencias ─────────────────────────────────────────────

export async function getPreferencias() {
  const profile = await getProfile();
  return profile?.preferencias || {};
}

export async function savePreferencias(prefs) {
  await saveProfile({ preferencias: prefs });
}

// ── Seed default categories ──────────────────────────────────

export async function seedDefaults() {
  const cats = await getCategorias();
  if (cats.length > 0) return;
  const defaults = [
    ['gasto', 'Supermercado', '🛒'], ['gasto', 'Comida', '🍔'], ['gasto', 'Transporte', '🚗'],
    ['gasto', 'Entretenimiento', '🎮'], ['gasto', 'Servicios', '📱'], ['gasto', 'Salud', '💊'],
    ['gasto', 'Educacion', '📚'], ['gasto', 'Ropa', '👕'], ['gasto', 'Hogar', '🏠'],
    ['gasto', 'Suscripciones', '📺'], ['gasto', 'Ahorro', '💰'], ['gasto', 'Otros', '📦'],
    ['ingreso', 'Salario', '💰'], ['ingreso', 'Freelance', '💻'],
    ['ingreso', 'Inversiones', '📈'], ['ingreso', 'Otros ingresos', '🎁']
  ];
  const batch = db.batch();
  defaults.forEach(([tipo, nombre, icono]) => {
    const ref = col('categorias').doc(generateId());
    batch.set(ref, { tipo, nombre, icono, color: '', createdAt: Date.now() });
  });
  await batch.commit();
}
