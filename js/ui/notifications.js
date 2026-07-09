import * as DB from '../db.js';
import { toast } from '../utils.js';

export async function loadNotificaciones() {
  const prefs = await DB.getPreferencias();
  const notif = prefs.notificaciones || {};

  document.getElementById('notifRecurrentes').checked = !!notif.recurrentes;
  document.getElementById('notifPresupuestos').checked = !!notif.presupuestos;
  document.getElementById('notifMetas').checked = !!notif.metas;
  document.getElementById('notifPrestamos').checked = !!notif.prestamos;
  document.getElementById('notifResumen').checked = !!notif.resumenSemanal;
}

window.saveNotificaciones = async function () {
  const notificaciones = {
    recurrentes: document.getElementById('notifRecurrentes').checked,
    presupuestos: document.getElementById('notifPresupuestos').checked,
    metas: document.getElementById('notifMetas').checked,
    prestamos: document.getElementById('notifPrestamos').checked,
    resumenSemanal: document.getElementById('notifResumen').checked
  };
  await DB.savePreferencias({ notificaciones });
  toast('Preferencias guardadas');
};

window.loadNotificaciones = loadNotificaciones;
