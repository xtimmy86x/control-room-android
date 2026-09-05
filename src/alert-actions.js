import './alert-actions.css';

import { request } from './api.js';
import { secureStore } from './secure-store.js';

let syncTimer = null;
let syncing = false;
let toastTimer = null;

function normalize(value) {
  return value == null ? '' : String(value);
}

async function authContext() {
  const [baseUrl, token, userRaw] = await Promise.all([
    secureStore.get('baseUrl'),
    secureStore.get('token'),
    secureStore.get('user'),
  ]);

  let user = null;
  try {
    user = userRaw ? JSON.parse(userRaw) : null;
  } catch {
    user = null;
  }

  return baseUrl && token ? { baseUrl, token, user } : null;
}

function formatUntil(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  }).format(date);
}

function ensureToast() {
  let toast = document.querySelector('#alert-action-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'alert-action-toast';
    toast.className = 'alert-action-toast';
    document.body.append(toast);
  }
  return toast;
}

function showToast(message, kind = 'ok') {
  const toast = ensureToast();
  toast.textContent = message;
  toast.dataset.kind = kind;
  toast.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function statusHtml(alert) {
  const badges = [];
  if (alert.acknowledged) {
    const by = alert.acknowledged_by ? ` · ${alert.acknowledged_by}` : '';
    badges.push(`<span class="alert-op-badge acknowledged">ACK${by}</span>`);
  }
  if (alert.muted) {
    const until = formatUntil(alert.muted_until);
    badges.push(`<span class="alert-op-badge muted">MUTE${until ? ` · ${until}` : ''}</span>`);
  }
  return badges.join('');
}

function decorateCard(card, alert, isAdmin) {
  if (!card || !alert) return;

  card.dataset.alertId = normalize(alert.id);
  card.dataset.alertActionsReady = '1';

  let status = card.querySelector('.alert-operation-status');
  if (!status) {
    status = document.createElement('div');
    status.className = 'alert-operation-status';
    const foot = card.querySelector('.alert-foot');
    card.insertBefore(status, foot || null);
  }
  const nextStatus = statusHtml(alert);
  if (status.innerHTML !== nextStatus) status.innerHTML = nextStatus;
  status.classList.toggle('hidden', !nextStatus);

  let actions = card.querySelector('.alert-operation-actions');
  if (!isAdmin) {
    actions?.remove();
    return;
  }

  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'alert-operation-actions';
    card.append(actions);
  }

  const ackAction = alert.acknowledged ? 'unack' : 'ack';
  const ackLabel = alert.acknowledged ? 'Rimuovi ACK' : 'ACK';
  const muteAction = alert.muted ? 'unmute' : 'mute';
  const muteLabel = alert.muted ? 'Riattiva notifiche' : 'Silenzia';
  const nextActions = `
    <button type="button" data-alert-action="${ackAction}" data-alert-id="${normalize(alert.id)}">
      ${ackLabel}
    </button>
    <button type="button" data-alert-action="${muteAction}" data-alert-id="${normalize(alert.id)}">
      ${muteLabel}
    </button>`;
  if (actions.innerHTML !== nextActions) actions.innerHTML = nextActions;
}

async function fetchActiveAlerts(context) {
  return request({
    baseUrl: context.baseUrl,
    token: context.token,
    path: '/api/alerts?status=active&limit=500',
  });
}

async function syncCards() {
  if (syncing) return;

  const cards = [...document.querySelectorAll('.alert-card:not(.pending-card)')];
  if (!cards.length) return;
  if (cards.every(card => card.dataset.alertActionsReady === '1')) return;

  const context = await authContext();
  if (!context) return;

  syncing = true;
  try {
    const alerts = await fetchActiveAlerts(context);
    if (!Array.isArray(alerts)) return;
    const isAdmin = context.user?.role === 'admin';
    cards.forEach((card, index) => decorateCard(card, alerts[index], isAdmin));
  } catch (error) {
    console.warn('Unable to load alert actions', error);
  } finally {
    syncing = false;
  }
}

function scheduleSync() {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(syncCards, 180);
}

async function mutateAlert(incidentId, action, options = {}) {
  const context = await authContext();
  if (!context) throw new Error('Sessione non disponibile');

  let path;
  let method;
  let data;

  if (action === 'ack') {
    path = `/api/alerts/${encodeURIComponent(incidentId)}/acknowledge`;
    method = 'POST';
    data = {};
  } else if (action === 'unack') {
    path = `/api/alerts/${encodeURIComponent(incidentId)}/acknowledge`;
    method = 'DELETE';
  } else if (action === 'mute') {
    path = `/api/alerts/${encodeURIComponent(incidentId)}/mute`;
    method = 'POST';
    data = {
      duration_seconds: options.durationSeconds,
      reason: options.reason || null,
    };
  } else if (action === 'unmute') {
    path = `/api/alerts/${encodeURIComponent(incidentId)}/mute`;
    method = 'DELETE';
  } else {
    throw new Error('Azione alert non supportata');
  }

  return request({
    baseUrl: context.baseUrl,
    token: context.token,
    path,
    method,
    ...(data ? { data } : {}),
  });
}

function refreshDecoratedAlert(alert) {
  if (!alert?.id) return;
  const card = document.querySelector(`.alert-card[data-alert-id="${CSS.escape(normalize(alert.id))}"]`);
  if (!card) return;
  authContext().then(context => {
    decorateCard(card, alert, context?.user?.role === 'admin');
  });
}

function ensureDialogLayer() {
  let layer = document.querySelector('#alert-action-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'alert-action-layer';
    document.body.append(layer);
  }
  return layer;
}

function closeMuteDialog() {
  const layer = document.querySelector('#alert-action-layer');
  if (layer) layer.innerHTML = '';
}

function openMuteDialog(incidentId) {
  const layer = ensureDialogLayer();
  layer.innerHTML = `
    <section class="alert-action-overlay" role="dialog" aria-modal="true">
      <div class="alert-action-sheet">
        <div class="alert-action-head">
          <div>
            <span>SILENZIA ALERT</span>
            <h2>Sospendi le notifiche</h2>
          </div>
          <button type="button" data-alert-dialog-close aria-label="Chiudi">×</button>
        </div>
        <p>Il monitoraggio resta attivo. Telegram e push FCM vengono sospesi per questa regola e questo site fino alla scadenza.</p>
        <label class="alert-action-reason">
          <span>Motivo opzionale</span>
          <input type="text" maxlength="255" placeholder="es. manutenzione programmata" data-alert-mute-reason>
        </label>
        <div class="alert-mute-options">
          <button type="button" data-alert-mute-seconds="900">15 min</button>
          <button type="button" data-alert-mute-seconds="3600">1 ora</button>
          <button type="button" data-alert-mute-seconds="14400">4 ore</button>
          <button type="button" data-alert-mute-seconds="86400">24 ore</button>
          <button type="button" data-alert-mute-seconds="604800">7 giorni</button>
        </div>
      </div>
    </section>`;

  layer.querySelector('[data-alert-dialog-close]')?.addEventListener('click', closeMuteDialog);
  layer.querySelector('.alert-action-overlay')?.addEventListener('click', event => {
    if (event.target === event.currentTarget) closeMuteDialog();
  });

  layer.querySelectorAll('[data-alert-mute-seconds]').forEach(button => {
    button.addEventListener('click', async () => {
      const seconds = Number(button.dataset.alertMuteSeconds);
      const reason = layer.querySelector('[data-alert-mute-reason]')?.value?.trim() || '';
      button.disabled = true;
      try {
        const alert = await mutateAlert(incidentId, 'mute', {
          durationSeconds: seconds,
          reason,
        });
        refreshDecoratedAlert(alert);
        closeMuteDialog();
        showToast('Notifiche silenziate');
        window.dispatchEvent(new CustomEvent('control-room:alert-action-complete', { detail: alert }));
      } catch (error) {
        button.disabled = false;
        showToast(error?.message || 'Impossibile silenziare l’alert', 'error');
      }
    });
  });
}

async function handleAction(button) {
  const incidentId = button.dataset.alertId;
  const action = button.dataset.alertAction;
  if (!incidentId || !action) return;

  if (action === 'mute') {
    openMuteDialog(incidentId);
    return;
  }

  button.disabled = true;
  try {
    const alert = await mutateAlert(incidentId, action);
    refreshDecoratedAlert(alert);
    showToast(
      action === 'ack' ? 'Alert preso in carico'
        : action === 'unack' ? 'ACK rimosso'
          : 'Notifiche riattivate',
    );
    window.dispatchEvent(new CustomEvent('control-room:alert-action-complete', { detail: alert }));
  } catch (error) {
    button.disabled = false;
    const message = String(error?.message || 'Operazione non riuscita');
    showToast(
      message.includes('404') ? 'HA Control Room 0.8.0 richiesto' : message,
      'error',
    );
  }
}

document.addEventListener('click', event => {
  const button = event.target.closest('[data-alert-action]');
  if (!button) return;
  event.preventDefault();
  event.stopPropagation();
  handleAction(button);
});

const observer = new MutationObserver(scheduleSync);
observer.observe(document.documentElement, { childList: true, subtree: true });

window.addEventListener('control-room:alert-action-complete', () => {
  document.querySelectorAll('.alert-card[data-alert-actions-ready]').forEach(card => {
    card.dataset.alertActionsReady = '';
  });
  scheduleSync();
});

scheduleSync();
