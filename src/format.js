export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function relativeTime(value) {
  if (!value) return 'mai';
  const ms = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(ms)) return '—';
  const seconds = Math.max(0, Math.floor(ms / 1000));
  if (seconds < 10) return 'ora';
  if (seconds < 60) return `${seconds}s fa`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m fa`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h fa`;
  return `${Math.floor(hours / 24)}g fa`;
}

export function pct(value) {
  return typeof value === 'number' ? `${value.toFixed(1)}%` : '—';
}

export function shortDuration(seconds) {
  const n = Math.max(0, Math.round(Number(seconds) || 0));
  if (n < 60) return `${n}s`;
  const minutes = Math.floor(n / 60);
  const rest = n % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

export function statusLabel(status) {
  return {
    online: 'Online',
    warning: 'Warning',
    critical: 'Critical',
    offline: 'Offline',
  }[status] || status || 'Unknown';
}
