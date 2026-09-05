# HA Control Room Android

Native Android client for **HA Control Room**.

Current version: **0.6.0**

## 0.6.0 — Centralized updates

The Android app now shows the centralized Home Assistant update inventory received by HA Control Room.

- Fleet cards show the number of available updates for each site;
- site detail adds an **Aggiornamenti** card;
- separate counters for Home Assistant Core, OS, Supervisor, add-ons and custom integrations;
- available items show installed → latest version;
- update alerts continue to appear in the existing Alert Center and work with ACK / mute;
- the update card is read-only: installation remains a deliberate Home Assistant-side action.

Centralized updates require **HA Control Room 0.9.0+** and **Control Room Agent 0.7.0+** on the monitored Home Assistant instance.

## 0.5.0 — Alert acknowledgement and mute

Active alerts expose operational controls directly in the Android Alert Center.

- acknowledge / remove acknowledgement on active incidents;
- temporarily mute a rule/site alert for 15 minutes, 1 hour, 4 hours, 24 hours or 7 days;
- optional mute reason;
- show active ACK and MUTE state directly on the alert card;
- muting keeps monitoring active and only suppresses Telegram / FCM transition notifications;
- actions are available to `admin` accounts; viewer accounts remain read-only.

## 0.4.0 — Notification deep links

Tapping a Control Room push notification routes into the relevant alert context instead of only opening the generic Alert Center.

- resolves `incident_id`, `site_id`, `rule_id`, `severity` and `status` from the FCM data payload;
- opens the Alert Center automatically;
- resolves active or resolved incidents;
- provides **Alert Center** and **Apri site** actions;
- waits for authentication / biometric unlock before routing.

## 0.3.0 — Biometric unlock

- optional Android biometric protection for saved sessions;
- native Android `BiometricPrompt` integration;
- password fallback clears the saved session and returns to login;
- biometric templates never leave Android's biometric subsystem.

## Included

- real API client, not a dashboard WebView wrapper;
- configurable Control Room URL;
- Bearer token encrypted with Android Keystore + AES/GCM;
- Fleet overview;
- Site detail;
- centralized update inventory;
- Alert Center with Active and Pending;
- alert acknowledge and temporary mute;
- live WebSocket updates;
- REST safety refresh;
- Firebase push notifications;
- biometric unlock;
- notification-to-alert/site deep links;
- logout and expired-session handling.

## Backend requirement

REST works with **HA Control Room 0.6.0+**.

Live WebSocket updates require **HA Control Room 0.6.1+**.

FCM device registration and notification routing require **HA Control Room 0.7.0+**.

Alert acknowledgement and temporary mute require **HA Control Room 0.8.0+**.

Centralized Core / OS / Supervisor / add-on / integration updates require **HA Control Room 0.9.0+** and **Control Room Agent 0.7.0+**.

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
- **0.5.0** — alert acknowledge / mute ✅
- **0.6.0** — centralized updates ✅
- next: maintenance windows / notification policy improvements
