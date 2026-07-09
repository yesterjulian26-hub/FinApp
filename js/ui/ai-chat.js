import { state } from '../app.js';
import { FMT, getCurrentMonth, fechaToMes, parseMonto, esTipo, toast } from '../utils.js';

let chatHistory = [];

export async function loadChat() {
  chatHistory = [];
  const container = document.getElementById('chatMessages');
  if (container) {
    container.innerHTML = `<div class="chat-msg assistant">
      <div class="chat-bubble">Hola! Soy FinAI, tu asistente financiero. Pregúntame sobre tus finanzas, presupuestos, o pide consejos.</div>
    </div>`;
  }
}

function buildFinancialContext() {
  const mes = getCurrentMonth();
  const txs = state.transacciones;
  const txsMes = txs.filter(t => fechaToMes(t.fecha) === mes);

  const ingresos = txsMes.filter(t => esTipo(t.tipo, 'ingreso')).reduce((s, t) => s + parseMonto(t.monto), 0);
  const gastos = txsMes.filter(t => esTipo(t.tipo, 'gasto') || esTipo(t.tipo, 'pago')).reduce((s, t) => s + parseMonto(t.monto), 0);

  const byCategoria = {};
  txsMes.filter(t => !esTipo(t.tipo, 'ingreso')).forEach(t => {
    byCategoria[t.categoria] = (byCategoria[t.categoria] || 0) + parseMonto(t.monto);
  });

  const cuentas = (state.cuentas || []).map(c => {
    let saldo = parseMonto(c.saldoInicial);
    txs.forEach(t => {
      if ((t.cuenta || 'General') !== c.nombre) return;
      saldo += esTipo(t.tipo, 'ingreso') ? parseMonto(t.monto) : -parseMonto(t.monto);
    });
    return `${c.nombre}: ${FMT.format(saldo)}`;
  });

  return `Mes actual: ${mes}
Ingresos del mes: ${FMT.format(ingresos)}
Gastos del mes: ${FMT.format(gastos)}
Balance: ${FMT.format(ingresos - gastos)}
Gastos por categoría: ${Object.entries(byCategoria).map(([k, v]) => `${k}: ${FMT.format(v)}`).join(', ')}
Cuentas: ${cuentas.join(', ') || 'General'}
Total transacciones del mes: ${txsMes.length}`;
}

window.sendChatMessage = async function () {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';

  const container = document.getElementById('chatMessages');
  container.innerHTML += `<div class="chat-msg user"><div class="chat-bubble">${escapeHtml(msg)}</div></div>`;

  container.innerHTML += `<div class="chat-msg assistant" id="chatLoading"><div class="chat-bubble"><span class="loading-dots">Pensando...</span></div></div>`;
  container.scrollTop = container.scrollHeight;

  chatHistory.push({ role: 'user', content: msg });

  try {
    const context = buildFinancialContext();
    const response = await fetch('/api/chat-ia', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg, context, history: chatHistory.slice(-10) })
    });

    if (!response.ok) throw new Error('Error del servidor');
    const data = await response.json();
    const reply = data.reply || 'No pude generar una respuesta.';

    chatHistory.push({ role: 'assistant', content: reply });

    const loadingEl = document.getElementById('chatLoading');
    if (loadingEl) loadingEl.remove();

    container.innerHTML += `<div class="chat-msg assistant"><div class="chat-bubble">${formatReply(reply)}</div></div>`;
    container.scrollTop = container.scrollHeight;
  } catch (e) {
    const loadingEl = document.getElementById('chatLoading');
    if (loadingEl) loadingEl.remove();
    container.innerHTML += `<div class="chat-msg assistant"><div class="chat-bubble" style="color:var(--red)">Error: ${e.message}. Intenta de nuevo.</div></div>`;
    container.scrollTop = container.scrollHeight;
  }
};

window.chatKeydown = function (e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    window.sendChatMessage();
  }
};

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatReply(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');
}

window.loadChat = loadChat;
