# HA Control Room Android

## 0.2.0 — Firebase Cloud Messaging

Native Android push notifications are now integrated alongside the existing live WebSocket and REST fallback.

- Android notification permission handling;
- FCM device registration in HA Control Room 0.7.0;
- separate `warning` and `critical` notification channels;
- push device removed from the backend on logout;
- tapping a notification opens the Alert Center;
- top bar reports `PUSH` or `NO PUSH`.

### Firebase setup

Register the Android app in Firebase with package name:

```text
com.xtimmy86x.controlroom
```

Download `google-services.json` and place it in the repository root. Capacitor's Push Notifications plugin supplies the Firebase Messaging Android dependency; no manual Firebase SDK code is required.

The APK still builds without `google-services.json`; in that case the application works normally but push registration remains unavailable.

---

# HA Control Room Android

Android client for **HA Control Room**.

Current version: **0.2.0**

## 0.1.1

- fixes black screen during Android startup;
- registers the native SecureStore plugin before Capacitor bridge initialization;
- always renders the login UI before restoring the native session;
- storage cleanup failures can no longer leave the WebView empty.

## Included

- real API client, not a WebView wrapper;
- configurable Control Room URL;
- login through `POST /api/auth/token`;
- Bearer token encrypted with Android Keystore + AES/GCM;
- Fleet overview;
- Site detail;
- Alert Center with Active and Pending;
- live WebSocket updates;
- automatic reconnect;
- 60-second REST safety refresh;
- logout and expired-session handling;
- GitHub Actions workflow for an installable debug APK.

## Backend requirement

REST works with **HA Control Room 0.6.0+**.

For live updates install **HA Control Room 0.6.1+**. The app requests a
30-second single-use WebSocket ticket from:

```text
POST /api/auth/ws-ticket
Authorization: Bearer <token>
```

The long-lived Bearer token never appears in the WebSocket URL.

If the ticket endpoint is unavailable, the app remains usable and shows
`POLL` instead of `LIVE`.

## Build locally

Requirements:

- Node.js 22+
- Java 21
- Android Studio / Android SDK

Commands:

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

APK:

```text
android/app/build/outputs/apk/debug/app-debug.apk
```

## Build on GitHub

The included workflow `.github/workflows/android-debug.yml` builds an APK on
each push to `main` and via manual workflow dispatch.

Download it from the workflow run's **Artifacts** section.

## Local HTTP testing

The preparation script creates a **debug-only** Android manifest overlay with
cleartext HTTP enabled, so a debug APK can connect to a LAN server such as:

```text
http://192.168.1.50:8000
```

Release builds should use HTTPS.

## Security

On Android the app encrypts the Control Room base URL, Bearer token and user
metadata before storing them in SharedPreferences. The AES key lives in the
Android Keystore and is not exported.

The production Android app does not store the Bearer token in `localStorage`.

## Roadmap

- **0.2.0** — Firebase Cloud Messaging push notifications
- **0.3.0** — biometric unlock
- **0.4.0** — deep link directly to the alert/site from a notification
