import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

import { request } from './api.js';
import { secureStore } from './secure-store.js';

const APP_VERSION = '0.2.0';
let listenersInstalled = false;
let pushStartedForToken = null;
let registered = false;
let lastAuth = null;
let pendingOpenAlerts = false;

async function getOrCreateDeviceId() {
  let deviceId = await secureStore.get('deviceId');
  if (!deviceId) {
    deviceId = globalThis.crypto?.randomUUID?.()
      || `android-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    await secureStore.set('deviceId', deviceId);
  }
  return deviceId;
}

function updateUi() {
  document.querySelectorAll('.login-brand p').forEach(element => {
    if (element.textContent?.startsWith('Android ·')) {
      element.textContent = `Android · ${APP_VERSION}`;
    }
  });

  const actions = document.querySelector('.top-actions');
  if (actions) {
    let pill = document.querySelector('#push-pill');
    if (!pill) {
      pill = document.createElement('span');
      pill.id = 'push-pill';
      pill.className = 'live-state';
      pill.title = 'Push notifications';
      actions.prepend(pill);
    }
    pill.classList.toggle('online', registered);
    pill.innerHTML = `<i></i>${registered ? 'PUSH' : 'NO PUSH'}`;
  }

  if (pendingOpenAlerts) {
    const alerts = document.querySelector('[data-nav="alerts"]');
    if (alerts) {
      pendingOpenAlerts = false;
      alerts.click();
    }
  }
}

const observer = new MutationObserver(updateUi);
observer.observe(document.documentElement, { childList: true, subtree: true });
updateUi();

async function loadAuth() {
  const [baseUrl, token] = await Promise.all([
    secureStore.get('baseUrl'),
    secureStore.get('token'),
  ]);
  return baseUrl && token ? { baseUrl, token } : null;
}

async function registerBackend(fcmToken) {
  const auth = await loadAuth();
  if (!auth || !fcmToken) return;
  const deviceId = await getOrCreateDeviceId();

  await request({
    baseUrl: auth.baseUrl,
    token: auth.token,
    path: '/api/notifications/fcm/devices',
    method: 'POST',
    data: {
      device_id: deviceId,
      token: fcmToken,
      name: 'Control Room Android',
      platform: 'android',
      app_version: APP_VERSION,
    },
  });

  registered = true;
  lastAuth = { ...auth, deviceId };
  updateUi();
}

async function unregisterPreviousDevice() {
  if (!lastAuth) return;
  try {
    await request({
      baseUrl: lastAuth.baseUrl,
      token: lastAuth.token,
      path: `/api/notifications/fcm/devices/${encodeURIComponent(lastAuth.deviceId)}`,
      method: 'DELETE',
    });
  } catch (error) {
    console.warn('Unable to remove FCM device from Control Room', error);
  }

  try {
    await PushNotifications.unregister();
  } catch (error) {
    console.warn('Unable to unregister Firebase token', error);
  }

  registered = false;
  pushStartedForToken = null;
  lastAuth = null;
  updateUi();
}

async function installListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;

  await PushNotifications.addListener('registration', token => {
    registerBackend(token.value).catch(error => {
      registered = false;
      console.error('Unable to register FCM device', error);
      updateUi();
    });
  });

  await PushNotifications.addListener('registrationError', error => {
    registered = false;
    console.warn('FCM registration unavailable', error);
    updateUi();
  });

  await PushNotifications.addListener('pushNotificationReceived', notification => {
    console.info('Control Room push received', notification);
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', () => {
    pendingOpenAlerts = true;
    updateUi();
  });
}

async function startPush(auth) {
  if (Capacitor.getPlatform() !== 'android') return;
  if (!auth || pushStartedForToken === auth.token) return;

  pushStartedForToken = auth.token;
  lastAuth = {
    ...auth,
    deviceId: await getOrCreateDeviceId(),
  };

  try {
    await installListeners();

    await PushNotifications.createChannel({
      id: 'control_room_warning',
      name: 'Control Room Warning',
      description: 'Warning e notifiche risolte della Control Room',
      importance: 4,
      visibility: 1,
      vibration: true,
    });

    await PushNotifications.createChannel({
      id: 'control_room_critical',
      name: 'Control Room Critical',
      description: 'Alert critici della Control Room',
      importance: 5,
      visibility: 1,
      vibration: true,
    });

    let permission = await PushNotifications.checkPermissions();
    if (permission.receive === 'prompt') {
      permission = await PushNotifications.requestPermissions();
    }
    if (permission.receive !== 'granted') {
      registered = false;
      updateUi();
      return;
    }

    await PushNotifications.register();
  } catch (error) {
    registered = false;
    console.warn('Push setup unavailable', error);
    updateUi();
  }
}

async function syncPushSession() {
  if (Capacitor.getPlatform() !== 'android') return;

  try {
    const auth = await loadAuth();
    if (!auth) {
      if (lastAuth) await unregisterPreviousDevice();
      return;
    }
    await startPush(auth);
  } catch (error) {
    console.warn('Push session sync failed', error);
  }
}

setInterval(syncPushSession, 1500);
syncPushSession();
