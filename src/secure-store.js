import { Capacitor, registerPlugin } from '@capacitor/core';

const SecureStoreNative = registerPlugin('SecureStore');
const PREFIX = 'control-room:';

export const secureStore = {
  async set(key, value) {
    if (Capacitor.getPlatform() === 'android') {
      await SecureStoreNative.set({ key: PREFIX + key, value });
      return;
    }
    // Development browser fallback only. Production Android never stores the
    // Bearer token in localStorage.
    sessionStorage.setItem(PREFIX + key, value);
  },

  async get(key) {
    if (Capacitor.getPlatform() === 'android') {
      const result = await SecureStoreNative.get({ key: PREFIX + key });
      return result?.value ?? null;
    }
    return sessionStorage.getItem(PREFIX + key);
  },

  async remove(key) {
    if (Capacitor.getPlatform() === 'android') {
      await SecureStoreNative.remove({ key: PREFIX + key });
      return;
    }
    sessionStorage.removeItem(PREFIX + key);
  },

  async clearAuth() {
    await Promise.all([
      this.remove('token'),
      this.remove('user'),
    ]);
  },
};
