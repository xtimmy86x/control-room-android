# HA Control Room Android

Native Android client for **HA Control Room**.

Current version: **0.4.0**

## 0.4.0 — Notification deep links

Tapping a Control Room push notification now routes into the relevant alert context instead of only opening the generic Alert Center.

- reads `incident_id`, `site_id`, `rule_id`, `severity` and `status` from the FCM data payload;
- opens the Alert Center automatically;
- resolves the exact active or resolved incident from the Control Room API;
- shows a dedicated alert-detail sheet for the notification;
- highlights the matching visible alert when possible;
- provides **Alert Center** and **Apri site** actions;
- `Apri site` switches to Fleet and opens the matching site detail;
- pending notification navigation is stored securely until authentication/biometric unlock is complete;
- works with both `ACTIVE` and `RESOLVED` notifications.

No backend change is required beyond the existing HA Control Room 0.7.0 FCM payload, which already includes the routing identifiers.

## 0.3.0 — Biometric unlock

- optional Android biometric protection for saved sessions;
- native Android `BiometricPrompt` integration;
- app stays locked until authentication succeeds;
- password fallback clears the saved session and returns to login;
- disabling biometrics also requires a fresh password login;
- biometric templates never leave Android's biometric subsystem.

## 0.2.x — Push, mobile UI and stable updates

- Firebase Cloud Messaging push notifications;
- separate `warning` and `critical` notification channels;
- FCM device registration in HA Control Room;
- responsive mobile-first UI;
- stable Android signing key for CI builds;
- real Android `versionName` / `versionCode` values;
- APKs can update an installed signed build without uninstalling it.

## Included

- real API client, not a dashboard WebView wrapper;
- configurable Control Room URL;
- login through `POST /api/auth/token`;
- Bearer token encrypted with Android Keystore + AES/GCM;
- Fleet overview;
- Site detail;
- Alert Center with Active and Pending;
- live WebSocket updates;
- automatic reconnect;
- REST safety refresh;
- Firebase push notifications;
- biometric unlock;
- notification-to-alert/site deep links;
- logout and expired-session handling.

## Backend requirement

REST works with **HA Control Room 0.6.0+**.

Live WebSocket updates require **HA Control Room 0.6.1+**.

FCM device registration and notification routing require **HA Control Room 0.7.0+**.

## Firebase setup

Register the Android app in Firebase with package name:

```text
com.xtimmy86x.controlroom
```

Place `google-services.json` in the repository root. The file contains the Android Firebase project configuration; backend Firebase service-account credentials must never be committed to this repository.

## Local build

Requirements:

- Node.js 22+
- Java 21
- Android Studio / Android SDK

```bash
npm install
npm run android:prepare
npm run android:open
```

Or:

```bash
cd android
./gradlew assembleDebug
```

APK output:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## GitHub build

`.github/workflows/android-debug.yml` builds the APK on each push to `main` and via manual workflow dispatch. CI validates the persistent signing key and APK metadata before uploading the artifact.

## Security

On Android the app encrypts the Control Room base URL, Bearer token and local app state before storing them in SharedPreferences. The AES key lives in the Android Keystore and is not exported.

Biometric verification is performed by Android. The app receives only the success/failure result and never has access to fingerprint or face templates.

## Roadmap

- **0.4.0** — notification deep links ✅
- next: polish notification routing / incident history / release packaging
