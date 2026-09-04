import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.xtimmy86x.controlroom',
  appName: 'HA Control Room',
  webDir: 'dist',
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
