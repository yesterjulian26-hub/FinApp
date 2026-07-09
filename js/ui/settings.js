import { state } from '../app.js';
import * as DB from '../db.js';
import { toast } from '../utils.js';

export async function loadSettings() {
  const prefs = await DB.getPreferencias();
  const pinEl = document.getElementById('settingsPin');
  if (pinEl) pinEl.value = prefs.pin || '';
  const monedaEl = document.getElementById('settingsMoneda');
  if (monedaEl) monedaEl.value = prefs.moneda || 'DOP';
  const darkEl = document.getElementById('settingsDark');
  if (darkEl) darkEl.checked = document.documentElement.getAttribute('data-theme') === 'dark';
}

window.saveSettings = async function () {
  const pin = document.getElementById('settingsPin')?.value || '';
  const moneda = document.getElementById('settingsMoneda')?.value || 'DOP';
  if (pin && (pin.length !== 4 || isNaN(pin))) { toast('PIN debe ser 4 dígitos'); return; }
  await DB.savePreferencias({ pin, moneda });
  if (pin) localStorage.setItem('finapp_pin', pin);
  else localStorage.removeItem('finapp_pin');
  toast('Ajustes guardados');
};

window.toggleDarkMode = function () {
  const isDark = document.getElementById('settingsDark')?.checked;
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  localStorage.setItem('finapp_theme', isDark ? 'dark' : 'light');
};

window.loadSettings = loadSettings;
