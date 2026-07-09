import { onAuthChange, signInWithGoogle as fbSignIn, signOut as fbSignOut, currentUser } from './firebase-config.js';
import * as DB from './db.js';
import { getCurrentMonth, toast, openModal, closeModal } from './utils.js';
import { loadDashboard } from './ui/dashboard.js';
import { loadTransacciones, initTransacciones } from './ui/transactions.js';
import { loadPresupuestos } from './ui/budgets.js';
import { loadCategorias } from './ui/categories.js';
import { loadMetas } from './ui/goals.js';
import { loadCuentas } from './ui/accounts.js';
import { loadPrestamos } from './ui/loans.js';
import { loadRecurrentes } from './ui/recurring.js';
import { loadReportes } from './ui/reports.js';
import { loadProyeccion } from './ui/projection.js';
import { generatePDF } from './ui/report-pdf.js';
import { loadChat } from './ui/ai-chat.js';
import { loadSettings } from './ui/settings.js';

// ── Global state ─────────────────────────────────────────────
export let state = {
  categorias: [],
  cuentas: [],
  transacciones: [],
  user: null
};

// Expose globally for inline onclick handlers
window.goTo = goTo;
window.openModal = openModal;
window.closeModal = closeModal;
window.toast = toast;
window.toggleSidebar = toggleSidebar;
window.closeSidebar = closeSidebar;
window.loginGoogle = signInWithGoogle;
window.logout = signOutApp;

// ── Auth ─────────────────────────────────────────────────────

async function signInWithGoogle() {
  try {
    await fbSignIn();
  } catch (err) {
    const errEl = document.getElementById('authError');
    if (errEl) { errEl.textContent = err.message; errEl.style.display = 'block'; }
    toast('Error al iniciar sesion: ' + err.message);
  }
}

async function signOutApp() {
  if (!confirm('Cerrar sesión?')) return;
  await fbSignOut();
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('appScreen').style.display = 'none';
}

onAuthChange(async (user) => {
  const splash = document.getElementById('splashScreen');
  if (user) {
    state.user = user;
    await DB.saveProfile({
      email: user.email,
      nombre: user.displayName || '',
      foto: user.photoURL || '',
      lastLogin: Date.now()
    });
    await DB.seedDefaults();
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('appScreen').style.display = 'block';
    updateUserUI(user);
    await initApp();
  } else {
    state.user = null;
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
  }
  if (splash) splash.style.display = 'none';
});

function updateUserUI(user) {
  const nameEl = document.getElementById('userName');
  const emailEl = document.getElementById('userEmail');
  const avatarEl = document.getElementById('userAvatar');
  if (nameEl) nameEl.textContent = user.displayName || 'Usuario';
  if (emailEl) emailEl.textContent = user.email || '';
  if (avatarEl) {
    if (user.photoURL) {
      avatarEl.innerHTML = `<img src="${user.photoURL}" alt="">`;
    } else {
      avatarEl.textContent = (user.displayName || 'U')[0].toUpperCase();
    }
  }
}

// ── Router ───────────────────────────────────────────────────

const loaders = {
  dashboard: loadDashboard,
  transacciones: loadTransacciones,
  presupuestos: loadPresupuestos,
  categorias: loadCategorias,
  metas: loadMetas,
  cuentas: loadCuentas,
  prestamos: loadPrestamos,
  recurrentes: loadRecurrentes,
  reportes: loadReportes,
  proyeccion: loadProyeccion,
  settings: loadSettings,
  chat: loadChat
};

function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('page-' + page);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll('.bottom-nav-item').forEach(n => n.classList.remove('active'));

  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.dataset.page === page) n.classList.add('active');
  });
  document.querySelectorAll('.bottom-nav-item').forEach(n => {
    if (n.dataset.page === page) n.classList.add('active');
  });

  closeSidebar();
  if (loaders[page]) loaders[page]();
}

// ── Sidebar ──────────────────────────────────────────────────

function toggleSidebar() {
  const open = document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('show');
  document.body.style.overflow = open ? 'hidden' : '';
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('show');
  document.body.style.overflow = '';
}

window.toggleDarkMode = function () {
  const dark = document.getElementById('themeToggle').checked;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  localStorage.setItem('finapp_theme', dark ? 'dark' : 'light');
};

// ── PIN Security ─────────────────────────────────────────────

window.setupPIN = function () {
  const pin = prompt('Establece un PIN de 4 digitos (vacio para desactivar):');
  if (pin === null) return;
  if (pin === '') { localStorage.removeItem('finapp_pin'); toast('PIN desactivado'); }
  else if (/^\d{4}$/.test(pin)) { localStorage.setItem('finapp_pin', pin); toast('PIN activado'); }
  else toast('El PIN debe ser de 4 digitos');
};

window.verifyPIN = function () {
  const input = document.getElementById('pinInput');
  if (input.value === localStorage.getItem('finapp_pin')) {
    document.getElementById('pinLockScreen').style.display = 'none';
    input.value = '';
  } else {
    input.value = '';
    toast('PIN incorrecto');
    input.style.animation = 'shake .3s';
    setTimeout(() => input.style.animation = '', 300);
  }
};

function checkPIN() {
  const saved = localStorage.getItem('finapp_pin');
  if (!saved) return;
  document.getElementById('pinLockScreen').style.display = 'flex';
}

// ── Init ─────────────────────────────────────────────────────

async function initApp() {
  checkPIN();

  const now = getCurrentMonth();
  document.querySelectorAll('input[type="month"]').forEach(i => i.value = now);
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('.default-today').forEach(i => i.value = today);

  const saved = localStorage.getItem('finapp_theme');
  if (saved === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
    const toggle = document.getElementById('themeToggle');
    if (toggle) toggle.checked = true;
  }

  // Load core data in parallel
  const [cats, cuentas, txs] = await Promise.all([
    DB.getCategorias(),
    DB.getCuentas(),
    DB.getTransacciones()
  ]);

  state.categorias = cats;
  state.cuentas = cuentas;
  state.transacciones = txs;

  populateSelects();
  initTransacciones();

  // Process recurrentes in background
  DB.processRecurrentes().catch(() => {});

  goTo('dashboard');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }
}

// ── Populate all select elements ─────────────────────────────

export function populateSelects() {
  const { categorias, cuentas } = state;
  const ICONS = { Banco: '🏦', Efectivo: '💵', Tarjeta: '💳', Ahorro: '🐷', Digital: '📱' };

  document.querySelectorAll('[data-cat-select]').forEach(sel => {
    sel.innerHTML = categorias.map(c =>
      `<option value="${c.nombre}">${c.icono || ''} ${c.nombre}</option>`
    ).join('');
  });

  document.querySelectorAll('[data-account-select]').forEach(sel => {
    const isFilter = sel.dataset.accountSelect === 'filter';
    sel.innerHTML = (isFilter
      ? '<option value="">Todas las cuentas</option>'
      : '<option value="General">General</option>')
      + cuentas.map(c =>
        `<option value="${c.nombre}">${ICONS[c.tipo] || ''} ${c.nombre}</option>`
      ).join('');
  });
}
