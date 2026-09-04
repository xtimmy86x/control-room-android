import './styles.css';

import { ApiError, normalizeBaseUrl, request, websocketUrl } from './api.js';
import { secureStore } from './secure-store.js';
import { esc, pct, relativeTime, shortDuration, statusLabel } from './format.js';

const root = document.querySelector('#app');

const state = {
  baseUrl: '',
  token: '',
  user: null,
  sites: new Map(),
  activeAlerts: [],
  pendingAlerts: [],
  view: 'fleet',
  selectedSiteId: null,
  socket: null,
  reconnectTimer: null,
  pollTimer: null,
  relativeTimer: null,
  live: false,
  liveUnavailable: false,
  loading: false,
};

function metric(label, value, kind) {
  return `
    <article class="metric-card">
      <i class="metric-dot ${kind}"></i>
      <strong>${esc(value)}</strong>
      <span>${esc(label)}</span>
    </article>`;
}

function emptyState(text) {
  return `<div class="empty-state">${esc(text)}</div>`;
}

function alertCount() {
  return state.activeAlerts.length + state.pendingAlerts.length;
}

function shell(body) {
  return `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">
          <div class="brand-mark">CR</div>
          <div>
            <strong>HA Control Room</strong>
            <span>${esc(state.user?.username || '')} · ${esc(state.user?.role || '')}</span>
          </div>
        </div>
        <div class="top-actions">
          <span class="live-state ${state.live ? 'online' : ''}">
            <i></i>${state.live ? 'LIVE' : state.liveUnavailable ? 'POLL' : '...'}
          </span>
          <button class="icon-button" data-action="refresh" aria-label="Aggiorna">↻</button>
          <button class="icon-button" data-action="logout" aria-label="Esci">⎋</button>
        </div>
      </header>

      <main class="content">${body}</main>

      <nav class="bottom-nav ${state.view === 'site' ? 'hidden' : ''}">
        <button class="${state.view === 'fleet' ? 'active' : ''}" data-nav="fleet">
          <span class="nav-icon">⌂</span><span>Fleet</span>
        </button>
        <button class="${state.view === 'alerts' ? 'active' : ''}" data-nav="alerts">
          <span class="nav-icon">!</span><span>Alerts</span>
          ${alertCount() ? `<b>${alertCount()}</b>` : ''}
        </button>
      </nav>
    </div>`;
}

function renderLogin(message = '') {
  root.innerHTML = `
    <section class="login-screen">
      <div class="login-card">
        <div class="login-brand">
          <div class="brand-mark large">CR</div>
          <div>
            <h1>HA Control Room</h1>
            <p>Android · 0.1.0</p>
          </div>
        </div>

        <form id="login-form">
          <label>
            <span>Control Room URL</span>
            <input id="server-url" type="url" inputmode="url"
                   placeholder="https://control.example.com"
                   value="${esc(state.baseUrl)}" required />
          </label>
          <label>
            <span>Username</span>
            <input id="username" autocomplete="username" required />
          </label>
          <label>
            <span>Password</span>
            <input id="password" type="password"
                   autocomplete="current-password" required />
          </label>
          <div id="login-error" class="form-error ${message ? '' : 'hidden'}">${esc(message)}</div>
          <button id="login-button" class="primary" type="submit">Accedi</button>
        </form>

        <p class="login-note">
          Il token viene conservato nell'Android Keystore.
        </p>
      </div>
    </section>`;

  document.querySelector('#login-form').addEventListener('submit', login);
}

function render() {
  if (!state.token) {
    renderLogin();
    return;
  }

  let body = '';
  if (state.view === 'fleet') body = fleetView();
  if (state.view === 'alerts') body = alertsView();
  if (state.view === 'site') body = siteView();

  root.innerHTML = shell(body);
  bindEvents();
}

function fleetView() {
  const sites = [...state.sites.values()];
  const count = kind => sites.filter(site => site.status === kind).length;

  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">FLEET OVERVIEW</span>
        <h1>Installazioni</h1>
        <p>${sites.length} site monitorati</p>
      </div>
    </section>

    <section class="metrics-grid">
      ${metric('Online', count('online'), 'online')}
      ${metric('Warning', count('warning'), 'warning')}
      ${metric('Critical', count('critical'), 'critical')}
      ${metric('Offline', count('offline'), 'offline')}
    </section>

    <section class="section-block">
      <div class="section-title"><h2>Sites</h2><span>${sites.length}</span></div>
      <div class="site-list">
        ${sites.length ? sites.map(siteCard).join('') : emptyState('Nessun site ricevuto')}
      </div>
    </section>`;
}

function siteCard(site) {
  const system = site.system || {};
  const plcSummary = (site.plc || {}).summary || {};

  return `
    <button class="site-card" data-site="${esc(site.site_id)}">
      <div class="site-card-top">
        <div>
          <strong>${esc(site.display_name || site.site_id)}</strong>
          <span>${esc(site.site_id)}</span>
        </div>
        <span class="status-pill ${esc(site.status)}">${esc(statusLabel(site.status))}</span>
      </div>

      <div class="site-stats">
        <span><small>CPU</small>${esc(pct(system.cpu_percent))}</span>
        <span><small>RAM</small>${esc(pct(system.memory_percent))}</span>
        <span><small>DISK</small>${esc(pct(system.disk_percent))}</span>
        <span><small>PLC</small>${esc(
          typeof plcSummary.connected_count === 'number'
            ? `${plcSummary.connected_count}/${plcSummary.plc_count ?? '?'}`
            : '—'
        )}</span>
      </div>

      <div class="site-card-foot">
        <span>Heartbeat ${esc(relativeTime(site.last_heartbeat))}</span>
        <span>›</span>
      </div>
    </button>`;
}

function alertsView() {
  return `
    <section class="page-head">
      <div>
        <span class="eyebrow">ALERT CENTER</span>
        <h1>Alerts</h1>
        <p>${state.activeAlerts.length} attivi · ${state.pendingAlerts.length} pending</p>
      </div>
    </section>

    <section class="metrics-grid">
      ${metric('Active', state.activeAlerts.length, 'critical')}
      ${metric('Pending', state.pendingAlerts.length, 'warning')}
      ${metric('Critical', state.activeAlerts.filter(a => a.severity === 'critical').length, 'critical')}
      ${metric('Warning', state.activeAlerts.filter(a => a.severity === 'warning').length, 'warning')}
    </section>

    <section class="section-block">
      <div class="section-title"><h2>Pending</h2><span>${state.pendingAlerts.length}</span></div>
      <div class="alert-list">
        ${state.pendingAlerts.length
          ? state.pendingAlerts.map(pendingCard).join('')
          : emptyState('Nessuna condizione pending')}
      </div>
    </section>

    <section class="section-block">
      <div class="section-title"><h2>Alert attivi</h2><span>${state.activeAlerts.length}</span></div>
      <div class="alert-list">
        ${state.activeAlerts.length
          ? state.activeAlerts.map(alertCard).join('')
          : emptyState('Nessun alert attivo')}
      </div>
    </section>`;
}

function pendingCard(item) {
  const start = new Date(item.pending_since).getTime();
  const duration = Math.max(1, Number(item.duration_seconds || 1));
  const elapsed = Math.min(duration, Math.max(0, (Date.now() - start) / 1000));
  const remaining = Math.max(0, duration - elapsed);
  const progress = Math.min(100, elapsed / duration * 100);

  return `
    <article class="alert-card pending-card">
      <div class="alert-card-head">
        <div>
          <strong>${esc(item.rule_name)}</strong>
          <span>${esc(item.site_name || item.site_id)}</span>
        </div>
        <span class="severity ${item.severity === 'critical' ? 'critical' : 'warning'}">
          ${esc(item.severity)}
        </span>
      </div>
      <div class="pending-meta">
        <b>PENDING</b><span>${esc(shortDuration(remaining))} rimanenti</span>
      </div>
      <div class="progress"><i style="width:${progress.toFixed(1)}%"></i></div>
    </article>`;
}

function alertCard(item) {
  return `
    <article class="alert-card">
      <div class="alert-card-head">
        <div>
          <strong>${esc(item.rule_name)}</strong>
          <span>${esc(item.site_name || item.site_id)}</span>
        </div>
        <span class="severity ${item.severity === 'critical' ? 'critical' : 'warning'}">
          ${esc(item.severity)}
        </span>
      </div>
      <p class="alert-message">${esc(item.message || '')}</p>
      <div class="alert-foot">
        <span>ACTIVE</span><span>${esc(relativeTime(item.opened_at))}</span>
      </div>
    </article>`;
}

function kv(label, value) {
  return `<div class="kv"><span>${esc(label)}</span><strong>${esc(value)}</strong></div>`;
}

function bar(label, value) {
  const n = typeof value === 'number' ? value : null;
  return `
    <div class="usage">
      <div><span>${esc(label)}</span><strong>${esc(pct(n))}</strong></div>
      <div class="usage-track"><i style="width:${n === null ? 0 : Math.min(100, n)}%"></i></div>
    </div>`;
}

function detailCard(title, body) {
  return `<article class="detail-card"><h2>${esc(title)}</h2><div class="detail-body">${body}</div></article>`;
}

function formatUptime(seconds) {
  if (typeof seconds !== 'number') return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  return days ? `${days}g ${hours}h` : `${hours}h`;
}

function integrationProblems(payload) {
  const items = payload.integrations || [];
  const problemStates = ['setup_error', 'migration_error', 'setup_retry', 'failed_unload'];
  const problems = items.filter(item => Number(item.problem_entry_count || 0) > 0);

  if (!problems.length) {
    return '<div class="good-state">Nessun problema rilevato</div>';
  }

  return `<div class="problem-list">${problems.map(item => {
    const states = Object.entries(item.states || {})
      .filter(([name, count]) => problemStates.includes(name) && Number(count) > 0)
      .map(([name, count]) => `${name} ×${count}`)
      .join(', ');
    return `
      <div>
        <strong>${esc(item.name || item.domain)}</strong>
        <span>${esc(states || `${item.problem_entry_count} problemi`)}</span>
      </div>`;
  }).join('')}</div>`;
}

function addonUpdates(addons) {
  const items = addons.addons || addons.apps || [];
  const updates = items.filter(item =>
    item.update_available === true
    || (item.version && item.version_latest && item.version !== item.version_latest)
  );

  if (!updates.length) {
    return '<div class="good-state">Nessun aggiornamento add-on</div>';
  }

  return `<div class="problem-list">${updates.map(item => `
    <div>
      <strong>${esc(item.name || item.slug || 'Add-on')}</strong>
      <span>${esc(item.version || '—')} → ${esc(item.version_latest || 'update')}</span>
    </div>`).join('')}</div>`;
}

function plcBody(plc) {
  if (plc.supported === false) {
    return '<div class="neutral-state">ha-s7plc non installato</div>';
  }

  const summary = plc.summary || {};
  const items = plc.plcs || plc.items || [];
  return `
    ${kv('Configurati', summary.plc_count ?? summary.configured_count ?? items.length ?? '—')}
    ${kv('Connessi', summary.connected_count ?? '—')}
    ${kv('Disconnessi', summary.disconnected_count ?? '—')}
    ${items.length ? `<div class="plc-list">${items.map(item => `
      <div>
        <i class="metric-dot ${item.connected ? 'online' : 'offline'}"></i>
        <div>
          <strong>${esc(item.name || item.plc_name || item.plc_id || 'PLC')}</strong>
          <span>${item.connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </div>`).join('')}</div>` : ''}
  `;
}

function siteView() {
  const site = state.sites.get(state.selectedSiteId);
  if (!site) return emptyState('Site non disponibile');

  const ha = site.homeassistant || {};
  const sys = site.system || {};
  const integrations = site.integrations || {};
  const addons = site.addons || {};
  const plc = site.plc || {};

  return `
    <section class="site-detail-head">
      <button class="back-button" data-action="back">‹</button>
      <div>
        <span class="eyebrow">${esc(site.site_id)}</span>
        <h1>${esc(site.display_name || site.site_id)}</h1>
      </div>
      <span class="status-pill ${esc(site.status)}">${esc(statusLabel(site.status))}</span>
    </section>

    <section class="detail-grid">
      ${detailCard('Home Assistant', `
        ${kv('Versione', ha.version || ha.homeassistant_version || '—')}
        ${kv('Installazione', ha.installation_type || '—')}
        ${kv('Uptime', formatUptime(ha.uptime_seconds))}
        ${kv('Heartbeat', relativeTime(site.last_heartbeat))}
      `)}

      ${detailCard('Sistema', `
        ${bar('CPU', sys.cpu_percent)}
        ${bar('RAM', sys.memory_percent)}
        ${bar('Disco', sys.disk_percent)}
        ${kv('Uptime sistema', formatUptime(sys.uptime_seconds))}
      `)}

      ${detailCard('Integrazioni', `
        ${kv('Totali', integrations.summary?.integration_count ?? '—')}
        ${kv('Config entry', integrations.summary?.config_entry_count ?? '—')}
        ${kv('Problemi', integrations.summary?.problem_entry_count ?? 0)}
        ${integrationProblems(integrations)}
      `)}

      ${detailCard('Add-on / Supervisor', `
        ${kv('Supportato', addons.supported === true ? 'Sì' : addons.supported === false ? 'No' : '—')}
        ${kv('Add-on', addons.summary?.addon_count ?? addons.summary?.app_count ?? '—')}
        ${kv('Update', addons.summary?.update_available_count ?? 0)}
        ${addonUpdates(addons)}
      `)}

      ${detailCard('PLC', plcBody(plc))}
    </section>`;
}

function bindEvents() {
  root.querySelectorAll('[data-nav]').forEach(button => {
    button.addEventListener('click', () => {
      state.view = button.dataset.nav;
      state.selectedSiteId = null;
      render();
    });
  });

  root.querySelectorAll('[data-site]').forEach(button => {
    button.addEventListener('click', () => {
      state.selectedSiteId = button.dataset.site;
      state.view = 'site';
      render();
    });
  });

  root.querySelector('[data-action="refresh"]')?.addEventListener('click', refreshAll);
  root.querySelector('[data-action="logout"]')?.addEventListener('click', () => logout());
  root.querySelector('[data-action="back"]')?.addEventListener('click', () => {
    state.view = 'fleet';
    state.selectedSiteId = null;
    render();
  });
}

async function login(event) {
  event.preventDefault();
  const button = document.querySelector('#login-button');
  const error = document.querySelector('#login-error');
  button.disabled = true;
  button.textContent = 'Accesso…';
  error.classList.add('hidden');

  try {
    const baseUrl = normalizeBaseUrl(document.querySelector('#server-url').value);
    const payload = await request({
      baseUrl,
      path: '/api/auth/token',
      method: 'POST',
      data: {
        username: document.querySelector('#username').value.trim(),
        password: document.querySelector('#password').value,
      },
    });

    state.baseUrl = baseUrl;
    state.token = payload.access_token;
    state.user = payload.user;

    await Promise.all([
      secureStore.set('baseUrl', baseUrl),
      secureStore.set('token', state.token),
      secureStore.set('user', JSON.stringify(state.user)),
    ]);

    await startRuntime();
  } catch (err) {
    error.textContent = err.message || 'Accesso non riuscito';
    error.classList.remove('hidden');
  } finally {
    button.disabled = false;
    button.textContent = 'Accedi';
  }
}

async function api(path, options = {}) {
  try {
    return await request({
      baseUrl: state.baseUrl,
      token: state.token,
      path,
      ...options,
    });
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await logout('Sessione scaduta');
    }
    throw err;
  }
}

async function loadSites() {
  const sites = await api('/api/sites');
  state.sites = new Map(sites.map(site => [site.site_id, site]));
}

async function loadAlerts() {
  const [active, pending] = await Promise.all([
    api('/api/alerts?status=active&limit=500'),
    api('/api/alerts/pending'),
  ]);
  state.activeAlerts = active;
  state.pendingAlerts = pending;
}

async function refreshAll() {
  if (state.loading) return;
  state.loading = true;
  try {
    await Promise.all([loadSites(), loadAlerts()]);
    render();
  } catch (err) {
    console.error(err);
  } finally {
    state.loading = false;
  }
}

function stopRuntime() {
  clearTimeout(state.reconnectTimer);
  clearInterval(state.pollTimer);
  clearInterval(state.relativeTimer);
  state.reconnectTimer = null;
  state.pollTimer = null;
  state.relativeTimer = null;
  state.live = false;

  if (state.socket) {
    try { state.socket.close(); } catch (_) {}
    state.socket = null;
  }
}

async function connectLive() {
  if (!state.token || !state.baseUrl) return;

  try {
    const ticket = await api('/api/auth/ws-ticket', {
      method: 'POST',
      data: {},
    });

    state.liveUnavailable = false;
    const socket = new WebSocket(websocketUrl(state.baseUrl, ticket.ticket));
    state.socket = socket;

    socket.addEventListener('open', () => {
      state.live = true;
      render();
    });

    socket.addEventListener('message', event => {
      try {
        const message = JSON.parse(event.data);

        if (message.type === 'site_updated' && message.site) {
          state.sites.set(message.site.site_id, message.site);
          if (state.view === 'fleet' || state.view === 'site') render();
          return;
        }

        if (
          message.type === 'alert_updated'
          || message.type === 'alert_pending_updated'
          || message.type === 'alert_rules_updated'
        ) {
          loadAlerts().then(render).catch(console.error);
        }
      } catch (err) {
        console.warn('Invalid live message', err);
      }
    });

    socket.addEventListener('close', () => {
      state.live = false;
      state.socket = null;
      render();
      state.reconnectTimer = setTimeout(connectLive, 3000);
    });

    socket.addEventListener('error', () => {
      state.live = false;
      render();
    });
  } catch (err) {
    console.warn('Live feed unavailable', err);
    state.live = false;
    state.liveUnavailable = true;
    render();

    // Control Room 0.6.0 remains usable through REST. 0.6.1 enables live.
    state.reconnectTimer = setTimeout(connectLive, 15000);
  }
}

async function startRuntime() {
  stopRuntime();
  await refreshAll();
  render();
  connectLive();

  // Safety polling remains active even when WebSocket is connected.
  state.pollTimer = setInterval(refreshAll, 60000);
  state.relativeTimer = setInterval(() => {
    if (state.view === 'fleet' || state.view === 'alerts') render();
  }, 10000);
}

async function restoreSession() {
  try {
    const [baseUrl, token, userRaw] = await Promise.all([
      secureStore.get('baseUrl'),
      secureStore.get('token'),
      secureStore.get('user'),
    ]);

    state.baseUrl = baseUrl || '';
    if (!baseUrl || !token) {
      renderLogin();
      return;
    }

    state.token = token;
    state.user = userRaw ? JSON.parse(userRaw) : null;
    await startRuntime();
  } catch (err) {
    console.error(err);
    await logout();
  }
}

async function logout(message = '') {
  stopRuntime();
  state.token = '';
  state.user = null;
  state.sites.clear();
  state.activeAlerts = [];
  state.pendingAlerts = [];
  await secureStore.clearAuth();
  renderLogin(message);
}

restoreSession();
