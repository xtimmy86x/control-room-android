import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { dirname, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const androidDir = resolve(root, 'android');

function run(command, args) {
  execFileSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

if (!existsSync(androidDir)) {
  run('npx', ['cap', 'add', 'android']);
}

const packageJson = JSON.parse(
  readFileSync(resolve(root, 'package.json'), 'utf8'),
);
const versionName = String(packageJson.version || '0.0.0');
const [major = 0, minor = 0, patch = 0] = versionName
  .split('.')
  .map(part => Number.parseInt(part, 10) || 0);
const versionCode = major * 10000 + minor * 100 + patch;

const googleServicesCandidates = [
  resolve(root, 'google-services.json'),
  resolve(root, 'firebase/google-services.json'),
];
const googleServices = googleServicesCandidates.find(existsSync);
if (googleServices) {
  copyFileSync(googleServices, resolve(androidDir, 'app/google-services.json'));
  console.log('Firebase google-services.json installed.');
} else {
  console.warn('google-services.json not found: APK builds, push remains unavailable.');
}

const packageDir = resolve(
  androidDir,
  'app/src/main/java/com/xtimmy86x/controlroom',
);
mkdirSync(packageDir, { recursive: true });

copyFileSync(
  resolve(root, 'native/android/SecureStorePlugin.java'),
  resolve(packageDir, 'SecureStorePlugin.java'),
);

const activityPath = resolve(packageDir, 'MainActivity.java');
if (!existsSync(activityPath)) {
  throw new Error(`MainActivity.java not found at ${activityPath}`);
}

const activity = `package com.xtimmy86x.controlroom;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SecureStorePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
`;
writeFileSync(activityPath, activity);

const buildGradlePath = resolve(androidDir, 'app/build.gradle');
if (!existsSync(buildGradlePath)) {
  throw new Error(`Android build.gradle not found at ${buildGradlePath}`);
}

let buildGradle = readFileSync(buildGradlePath, 'utf8');
buildGradle = buildGradle
  .replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
  .replace(/versionName\s+["'][^"']+["']/, `versionName "${versionName}"`);

const signingStoreFile = process.env.ANDROID_SIGNING_STORE_FILE || '';
const signingReady = Boolean(
  signingStoreFile
  && existsSync(signingStoreFile)
  && process.env.ANDROID_SIGNING_STORE_PASSWORD
  && process.env.ANDROID_SIGNING_KEY_ALIAS
  && process.env.ANDROID_SIGNING_KEY_PASSWORD
);

if (signingReady) {
  if (!buildGradle.includes('signingConfigs {\n        controlRoomCi {')) {
    buildGradle = buildGradle.replace(
      /android\s*\{\s*\n/,
      `android {\n    signingConfigs {\n        controlRoomCi {\n            storeFile file(System.getenv("ANDROID_SIGNING_STORE_FILE"))\n            storePassword System.getenv("ANDROID_SIGNING_STORE_PASSWORD")\n            keyAlias System.getenv("ANDROID_SIGNING_KEY_ALIAS")\n            keyPassword System.getenv("ANDROID_SIGNING_KEY_PASSWORD")\n        }\n    }\n`,
    );
  }

  if (!buildGradle.includes('signingConfig signingConfigs.controlRoomCi')) {
    buildGradle = buildGradle.replace(
      /buildTypes\s*\{\s*\n/,
      `buildTypes {\n        debug {\n            signingConfig signingConfigs.controlRoomCi\n        }\n`,
    );
  }
  console.log('Stable Android signing enabled for debug APK.');
} else {
  console.warn(
    'Stable Android signing not configured: APK will use the runner debug key and cannot update previous CI builds.',
  );
}

writeFileSync(buildGradlePath, buildGradle);
console.log(`Android version: ${versionName} (versionCode ${versionCode})`);

// Debug-only LAN HTTP support. Release builds keep Android cleartext disabled.
const debugManifest = resolve(
  androidDir,
  'app/src/debug/AndroidManifest.xml',
);
mkdirSync(dirname(debugManifest), { recursive: true });
writeFileSync(
  debugManifest,
  `<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <application android:usesCleartextTraffic="true" />
</manifest>
`,
);

console.log('Android project prepared.');
