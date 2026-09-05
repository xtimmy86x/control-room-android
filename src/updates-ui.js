import './updates-ui.css';

import { request } from './api.js';
import { secureStore } from './secure-store.js';

let sites = new Map();
let lastLoadedAt = 0;
let loading = false;
let scheduled = false;

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

async function authContext() {
  const [baseUrl, token] = await Promise.all([
    secureStore.get('baseUrl'),
    secureStore.get('token'),
  ]);
  return baseUrl && token ? { baseUrl, token } : null;
}

async function loadSites(force = false) {
  if (loading) return;
  if (!force && Date.now() - lastLoadedAt < 5000) return;

  const auth = await authContext();
  if (!auth) return;

  loading = true;
  try {
    const payload = await request({
      baseUrl: auth.baseUrl,
      token: auth.token,
      path: '/api/sites',
    });
    if (Array.isArray(payload)) {
      sites = new Map(payload.map(site => [site.site_id, site]));
      lastLoadedAt = Date.now();
    }
  } catch (error) {
    console.warn('Unable to load centralized update state', error);
  } finally {
    loading = false;
  }
}

function updateCount(site) {
  return Number(site?.updates?.summary?.total_available_count ?? 0);
}

function setBadgeText(badge, text) {
  if (badge.textContent !== text) badge.textContent = text;
}

function decorateFleet() {
  document.querySelectorAll('.site-card[data-site]').forEach(card => {
    const site = sites.get(card.dataset.site);
    if (!site) return;

    const foot = card.querySelector('.site-card-foot');
    if (!foot) return;

    let badge = foot.querySelector('[data-site-update-count]');
    if (!badge) {
      badge = document.createElement('span');
      badge.dataset.siteUpdateCount = '';
      badge.className = 'site-update-count';
      foot.prepend(badge);
    }

    if (!site.updates) {
      setBadgeText(badge, 'Updates —');
      badge.classList.remove('warning', 'ok');
      return;
    }

    const count = updateCount(site);
    setBadgeText(badge, count ? `Updates ${count}` : 'Aggiornato');
    badge.classList.toggle('warning', count > 0);
    badge.classList.toggle('ok', count === 0);
  });
}

function detailSiteId() {
  const eyebrow = document.querySelector('.site-detail-head .eyebrow');
  return eyebrow?.textContent?.trim() || '';
}

function summaryBox(value, label, warning = false) {
  return `
    <div class="android-update-summary-box ${warning ? 'warning' : ''}">
      <strong>${esc(value)}</strong>
      <span>${esc(label)}</span>
    </div>`;
}

function detailFingerprint(site) {
  const data = site?.updates;
  if (!data) return 'missing';
  return JSON.stringify({
    summary: data.summary || {},
    updates: (data.updates || []).filter(item => item?.update_available === true),
  });
}

function renderDetailCard(site) {
  const grid = document.querySelector('.detail-grid');
  if (!grid) return;

  let card = document.querySelector('#android-updates-card');
  if (!card) {
    card = document.createElement('article');
    card.id = 'android-updates-card';
    card.className = 'detail-card android-updates-card';
    grid.append(card);
  }

  const fingerprint = detailFingerprint(site);
  if (card.dataset.updateFingerprint === fingerprint) return;
  card.dataset.updateFingerprint = fingerprint;

  const data = site?.updates;
  if (!data) {
    card.innerHTML = `
      <h2>Aggiornamenti</h2>
      <div class="android-updates-empty">
        Dati non disponibili. Richiede Control Room Agent 0.7.0+.
      </div>`;
    return;
  }

  const summary = data.summary || {};
  const available = Array.isArray(data.updates)
    ? data.updates.filter(item => item.update_available === true)
    : [];

  const labels = {
    core: 'Core',
    os: 'OS',
    supervisor: 'Supervisor',
    addon: 'Add-on',
    integration: 'Integrazione',
    other: 'Altro',
  };

  card.innerHTML = `
    <h2>Aggiornamenti</h2>
    <div class="android-update-summary">
      ${summaryBox(summary.total_available_count ?? 0, 'Totali', (summary.total_available_count ?? 0) > 0)}
      ${summaryBox(summary.core_count ?? 0, 'Core')}
      ${summaryBox(summary.os_count ?? 0, 'OS')}
      ${summaryBox(summary.supervisor_count ?? 0, 'Supervisor')}
      ${summaryBox(summary.addon_count ?? 0, 'Add-on')}
      ${summaryBox(summary.integration_count ?? 0, 'Integrazioni')}
    </div>
    ${available.length
      ? `<div class="android-update-list">${available.map(item => `
          <div class="android-update-row">
            <div>
              <strong>${esc(item.name || 'Update')}</strong>
              <span>${esc(labels[item.category] || 'Altro')} · ${esc(item.installed_version || '—')} → ${esc(item.latest_version || '—')}</span>
            </div>
            <b>UPDATE</b>
          </div>`).join('')}</div>`
      : '<div class="android-updates-empty ok">Tutto aggiornato.</div>'}
  `;
}

function decorateDetail() {
  const siteId = detailSiteId();
  if (!siteId) {
    document.querySelector('#android-updates-card')?.remove();
    return;
  }
  const site = sites.get(siteId);
  if (site) renderDetailCard(site);
}

async function syncUi(force = false) {
  if (!document.querySelector('.app-shell')) return;
  await loadSites(force);
  decorateFleet();
  decorateDetail();
}

function scheduleSync() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    syncUi().catch(console.warn);
  });
}

const observer = new MutationObserver(scheduleSync);
observer.observe(document.documentElement, { childList: true, subtree: true });

setInterval(() => {
  syncUi(true).catch(console.warn);
}, 30000);

window.addEventListener('control-room:push-open', () => {
  setTimeout(() => syncUi(true).catch(console.warn), 500);
});

scheduleSync();
