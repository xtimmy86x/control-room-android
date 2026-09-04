import './styles.css';
import './readability.css';
import './mobile.css';

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
