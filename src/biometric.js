import { Capacitor, registerPlugin } from '@capacitor/core';

import './biometric.css';
import { secureStore } from './secure-store.js';

const BiometricAuth = registerPlugin('BiometricAuth');

const ENABLED_KEY = 'biometricEnabled';
const ASKED_KEY = 'biometricAsked';

let lastToken = null;
let promptOpen = false;
let lockOpen = false;
let initialized = false;

function ensureRoot() {
  let host = document.querySelector('#biometric-layer');
  if (!host) {
    host = document.createElement('div');
    host.id = 'biometric-layer';
    document.body.append(host);
  }
  return host;
}

function clearLayer() {
  const host = document.querySelector('#biometric-layer');
  if (host) host.innerHTML = '';
  promptOpen = false;
  lockOpen = false;
}

function showChecking() {
  const host = ensureRoot();
  host.innerHTML = `
    <section class="bio-overlay bio-checking" aria-live="polite">
      <div class="bio-card bio-card-small">
        <div class="bio-mark">CR</div>
        <strong>HA Control Room</strong>
        <span>Verifica sicurezza…</span>
      </div>
    </section>`;
}

async function availability() {
  try {
    const result = await BiometricAuth.isAvailable();
    return Boolean(result?.available);
  } catch (error) {
    console.warn('Biometric availability check failed', error);
    return false;
  }
}

async function authenticate(subtitle) {
  try {
    const result = await BiometricAuth.authenticate({
      title: 'Sblocca HA Control Room',
      subtitle: subtitle || 'Usa impronta digitale o riconoscimento biometrico',
    });
    return Boolean(result?.authenticated);
  } catch (error) {
    console.info('Biometric authentication not completed', error);
    return false;
  }
}

async function enableBiometrics() {
  const ok = await authenticate('Conferma la biometria per abilitarla');
  if (!ok) return false;

  await secureStore.set(ENABLED_KEY, 'true');
  await secureStore.set(ASKED_KEY, 'true');
  return true;
}

async function disableBiometrics() {
  await Promise.all([
    secureStore.remove(ENABLED_KEY),
    secureStore.remove(ASKED_KEY),
  ]);
}

function showEnabledToast() {
  let toast = document.querySelector('#bio-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'bio-toast';
    toast.className = 'bio-toast';
    document.body.append(toast);
  }
  toast.textContent = 'Sblocco biometrico attivato';
  toast.classList.add('visible');
  setTimeout(() => toast?.classList.remove('visible'), 2600);
}

async function showEnablePrompt() {
  if (promptOpen || lockOpen) return;
  if (!(await availability())) return;

  promptOpen = true;
  const host = ensureRoot();
  host.innerHTML = `
    <section class="bio-overlay bio-prompt-overlay">
      <div class="bio-card">
        <div class="bio-icon" aria-hidden="true">◎</div>
        <h2>Sblocco biometrico</h2>
        <p>
          Vuoi usare impronta digitale o Face Unlock quando riapri
          HA Control Room?
        </p>
        <div class="bio-actions">
          <button type="button" class="bio-secondary" data-bio-later>Non ora</button>
          <button type="button" class="bio-primary" data-bio-enable>Abilita</button>
        </div>
        <small>Le credenziali biometriche restano gestite da Android e non vengono salvate dall'app.</small>
      </div>
    </section>`;

  host.querySelector('[data-bio-later]')?.addEventListener('click', async () => {
    await secureStore.set(ASKED_KEY, 'true');
    clearLayer();
  });

  host.querySelector('[data-bio-enable]')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Verifica…';
    const enabled = await enableBiometrics();
    if (enabled) {
      clearLayer();
      showEnabledToast();
      return;
    }
    button.disabled = false;
    button.textContent = 'Abilita';
  });
}

async function showLockGate() {
  if (lockOpen) return;
  lockOpen = true;
  const host = ensureRoot();
  host.innerHTML = `
    <section class="bio-overlay bio-lock-overlay">
      <div class="bio-card">
        <div class="bio-icon" aria-hidden="true">◎</div>
        <h2>HA Control Room bloccata</h2>
        <p>Conferma la tua identità per accedere alla sessione salvata.</p>
        <div class="bio-actions bio-actions-stack">
          <button type="button" class="bio-primary" data-bio-unlock>Sblocca</button>
          <button type="button" class="bio-secondary" data-bio-password>Usa password</button>
        </div>
        <button type="button" class="bio-link" data-bio-disable>Disattiva biometria</button>
      </div>
    </section>`;

  const unlockButton = host.querySelector('[data-bio-unlock]');
  const tryUnlock = async () => {
    unlockButton.disabled = true;
    unlockButton.textContent = 'Verifica…';
    const ok = await authenticate();
    if (ok) {
      clearLayer();
      return;
    }
    unlockButton.disabled = false;
    unlockButton.textContent = 'Riprova';
  };

  unlockButton?.addEventListener('click', tryUnlock);

  host.querySelector('[data-bio-password]')?.addEventListener('click', async () => {
    await Promise.all([
      secureStore.remove('token'),
      secureStore.remove('user'),
    ]);
    window.location.reload();
  });

  host.querySelector('[data-bio-disable]')?.addEventListener('click', async () => {
    await disableBiometrics();
    clearLayer();
  });

  // Open the native prompt immediately. If the user cancels, the gate remains
  // visible and offers retry/password fallback.
  tryUnlock();
}

async function currentSession() {
  const [token, enabled, asked] = await Promise.all([
    secureStore.get('token'),
    secureStore.get(ENABLED_KEY),
    secureStore.get(ASKED_KEY),
  ]);
  return {
    token: token || null,
    enabled: enabled === 'true',
    asked: asked === 'true',
  };
}

async function initialize() {
  if (initialized || Capacitor.getPlatform() !== 'android') return;
  initialized = true;
  showChecking();

  try {
    const session = await currentSession();
    lastToken = session.token;

    if (!session.token) {
      clearLayer();
    } else if (session.enabled && await availability()) {
      await showLockGate();
    } else {
      clearLayer();
      if (!session.asked) {
        setTimeout(showEnablePrompt, 900);
      }
    }
  } catch (error) {
    console.warn('Biometric guard initialization failed', error);
    clearLayer();
  }

  setInterval(syncSession, 1200);
}

async function syncSession() {
  try {
    const session = await currentSession();

    if (session.token && session.token !== lastToken) {
      lastToken = session.token;
      if (!session.enabled && !session.asked) {
        setTimeout(showEnablePrompt, 500);
      }
      return;
    }

    if (!session.token && lastToken) {
      lastToken = null;
      await disableBiometrics();
      clearLayer();
    }
  } catch (error) {
    console.warn('Biometric session sync failed', error);
  }
}

initialize();
