export const FMT = new Intl.NumberFormat('es-DO', { style: 'currency', currency: 'DOP', minimumFractionDigits: 0, maximumFractionDigits: 0 });

export const CUENTA_ICONS = { Banco: '🏦', Efectivo: '💵', Tarjeta: '💳', Ahorro: '🐷', Digital: '📱' };

export function getCurrentMonth() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fechaToMes(val) {
  if (!val) return '';
  const s = String(val).slice(0, 10);
  const d = new Date(s + 'T12:00:00');
  if (isNaN(d.getTime())) return '';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

export function parseMonto(val) {
  if (typeof val === 'number') return val;
  return parseFloat(String(val).replace(/[^0-9.\-]/g, '')) || 0;
}

export function esTipo(val, tipo) {
  return String(val).toLowerCase() === tipo.toLowerCase();
}

export function toast(msg, duration = 3000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.remove('show'), duration);
}

export function openModal(id) {
  document.getElementById(id).classList.add('show');
}

export function closeModal(id) {
  document.getElementById(id).classList.remove('show');
}

export function debounce(fn, ms) {
  let t;
  return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
}

export function animateValue(el, start, end, duration) {
  if (!el) return;
  const range = end - start;
  const startTime = performance.now();
  function step(ts) {
    const progress = Math.min((ts - startTime) / duration, 1);
    const value = start + range * progress;
    el.textContent = FMT.format(Math.round(value));
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
