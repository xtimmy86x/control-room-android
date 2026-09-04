import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
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
