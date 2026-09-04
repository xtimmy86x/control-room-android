import './deeplink.css';

import { request } from './api.js';
import { secureStore } from './secure-store.js';

const PENDING_KEY = 'pendingNotificationDeepLink';
let processing = false;
let lastRouteKey = '';

function normalize(value) {
  return value == null ? '' : String(value);
}

function notificationRoute(action) {
  const notification = action?.notification || {};
  const data = notification.data || {};

  return {
    incidentId: normalize(data.incident_id),
    ruleId: normalize(data.rule_id),
    siteId: normalize(data.site_id),
    severity: normalize(data.severity || 'warning').toLowerCase(),
    status: normalize(data.status || 'active').toLowerCase(),
    title: normalize(notification.title),
    body: normalize(notification.body),
    receivedAt: Date.now(),
  };
}

function routeKey(route) {
  return [
    route.incidentId,
    route.siteId,
    route.status,
    route.receivedAt,
  ].join(':');
}

async function persistRoute(route) {
  await secureStore.set(PENDING_KEY, JSON.stringify(route));
}

async function readRoute() {
  const raw = await secureStore.get(PENDING_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    await secureStore.remove(PENDING_KEY);
    return null;
  }
}

function biometricGateVisible() {
  const layer = document.querySelector('#biometric-layer');
  return Boolean(layer?.querySelector('.bio-overlay'));
}

async function authContext() {
  const [baseUrl, token] = await Promise.all([
    secureStore.get('baseUrl'),
    secureStore.get('token'),
  ]);
  return baseUrl && token ? { baseUrl, token } : null;
}

function clickNavigation(name) {
  const button = document.querySelector(`[data-nav="${name}"]`);
  if (!button) return false;
  button.click();
  return true;
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchAlerts(auth, status) {
  try {
    return await request({
      baseUrl: auth.baseUrl,
      token: auth.token,
      path: `/api/alerts?status=${encodeURIComponent(status)}&limit=500`,
    });
  } catch (error) {
    console.warn(`Unable to load ${status} alerts for deep link`, error);
    return [];
  }
}

async function findIncident(auth, route) {
  const preferred = route.status === 'resolved'
    ? ['resolved', 'active']
    : ['active', 'resolved'];

  for (const status of preferred) {
    const alerts = await fetchAlerts(auth, status);
    if (!Array.isArray(alerts)) continue;

    const exact = route.incidentId
      ? alerts.find(alert => normalize(alert.id) === route.incidentId)
      : null;
    if (exact) return exact;

    const fallback = route.siteId
      ? alerts.find(alert => normalize(alert.site_id) === route.siteId)
      : null;
    if (fallback) return fallback;
  }

  return null;
}

function ensureLayer() {
  let layer = document.querySelector('#notification-deeplink-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'notification-deeplink-layer';
    document.body.append(layer);
  }
  return layer;
}

function closeLayer() {
  const layer = document.querySelector('#notification-deeplink-layer');
  if (layer) layer.innerHTML = '';
}

function addText(parent, tag, text, className = '') {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text || '—';
  parent.append(element);
  return element;
}

function addField(grid, label, value) {
  const item = document.createElement('div');
  addText(item, 'small', label);
  addText(item, 'strong', value || '—');
  grid.append(item);
}

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function highlightUnderlyingAlert(alert) {
  if (!alert) return;
  const rule = normalize(alert.rule_name).toLowerCase();
  const site = normalize(alert.site_name || alert.site_id).toLowerCase();

  for (const card of document.querySelectorAll('.alert-card')) {
    const text = (card.textContent || '').toLowerCase();
    if ((!rule || text.includes(rule)) && (!site || text.includes(site))) {
      card.classList.add('deep-link-origin-highlight');
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => card.classList.remove('deep-link-origin-highlight'), 8000);
      break;
    }
  }
}

async function openSite(siteId) {
  if (!siteId) return;
  closeLayer();
  clickNavigation('fleet');

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await wait(100);
    const siteCard = [...document.querySelectorAll('[data-site]')]
      .find(element => normalize(element.dataset.site) === siteId);
    if (siteCard) {
      siteCard.click();
      return;
    }
  }
}

function showIncident(route, alert) {
  const layer = ensureLayer();
  layer.innerHTML = '';

  const overlay = document.createElement('section');
  overlay.className = 'deep-link-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');

  const sheet = document.createElement('div');
  sheet.className = 'deep-link-sheet';
  overlay.append(sheet);

  const head = document.createElement('div');
  head.className = 'deep-link-head';
  const headCopy = document.createElement('div');
  addText(headCopy, 'span', route.status === 'resolved' ? 'ALERT RISOLTO' : 'ALERT DA NOTIFICA', 'deep-link-kicker');
  addText(headCopy, 'h2', alert?.rule_name || route.title || 'Alert Control Room');
  head.append(headCopy);

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'deep-link-close';
  close.setAttribute('aria-label', 'Chiudi');
  close.textContent = '×';
  close.addEventListener('click', closeLayer);
  head.append(close);
  sheet.append(head);

  const summary = document.createElement('div');
  summary.className = 'deep-link-summary';
  const siteCopy = document.createElement('div');
  addText(siteCopy, 'strong', alert?.site_name || alert?.site_id || route.siteId || 'Site');
  addText(siteCopy, 'span', alert?.site_id || route.siteId || '');
  summary.append(siteCopy);

  const badge = document.createElement('span');
  const severity = normalize(alert?.severity || route.severity || 'warning').toLowerCase();
  const resolved = route.status === 'resolved' || Boolean(alert?.resolved_at);
  badge.className = `deep-link-badge ${resolved ? 'resolved' : severity}`;
  badge.textContent = resolved ? 'RESOLVED' : severity.toUpperCase();
  summary.append(badge);
  sheet.append(summary);

  const message = document.createElement('div');
  message.className = 'deep-link-message';
  message.textContent = alert?.message || route.body || 'Dettaglio non disponibile.';
  sheet.append(message);

  const grid = document.createElement('div');
  grid.className = 'deep-link-grid';
  addField(grid, 'Incident ID', normalize(alert?.id || route.incidentId));
  addField(grid, 'Rule ID', normalize(alert?.rule_id || route.ruleId));
  addField(grid, 'Aperto', formatDate(alert?.opened_at));
  addField(grid, 'Risolto', formatDate(alert?.resolved_at));
  sheet.append(grid);

  const actions = document.createElement('div');
  actions.className = 'deep-link-actions';

  const alertCenter = document.createElement('button');
  alertCenter.type = 'button';
  alertCenter.className = 'deep-link-secondary';
  alertCenter.textContent = 'Alert Center';
  alertCenter.addEventListener('click', () => {
    closeLayer();
    clickNavigation('alerts');
    setTimeout(() => highlightUnderlyingAlert(alert), 80);
  });
  actions.append(alertCenter);

  const siteButton = document.createElement('button');
  siteButton.type = 'button';
  siteButton.className = 'deep-link-primary';
  siteButton.textContent = 'Apri site';
  siteButton.disabled = !(alert?.site_id || route.siteId);
  siteButton.addEventListener('click', () => {
    openSite(normalize(alert?.site_id || route.siteId));
  });
  actions.append(siteButton);

  sheet.append(actions);
  layer.append(overlay);
}

async function processPendingRoute() {
  if (processing || biometricGateVisible()) return;

  const route = await readRoute();
  if (!route) return;

  const key = routeKey(route);
  if (key === lastRouteKey) return;

  const auth = await authContext();
  if (!auth) return;

  if (!document.querySelector('.app-shell')) return;

  processing = true;
  lastRouteKey = key;

  try {
    clickNavigation('alerts');
    await wait(120);
    const alert = await findIncident(auth, route);
    showIncident(route, alert);
    highlightUnderlyingAlert(alert);
    await secureStore.remove(PENDING_KEY);
  } catch (error) {
    console.error('Unable to open notification deep link', error);
    lastRouteKey = '';
  } finally {
    processing = false;
  }
}

window.addEventListener('control-room:push-open', event => {
  const route = notificationRoute(event.detail);
  persistRoute(route)
    .then(processPendingRoute)
    .catch(error => console.warn('Unable to persist notification deep link', error));
});

setInterval(processPendingRoute, 900);
processPendingRoute();
