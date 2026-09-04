# Android signing and app versioning

Starting with 0.2.5, the Android build synchronizes the native APK version with `package.json`.

For example:

```text
package.json 0.2.5
versionName  0.2.5
versionCode  205
```

The version code formula is:

```text
major * 10000 + minor * 100 + patch
```

## Why previous APKs could not update in place

GitHub-hosted runners generate a new default Android debug keystore when no stable signing key is supplied. Android only accepts an APK update when the new APK is signed by the same signing identity as the installed app.

That is why the old CI APKs often required uninstall/reinstall.

## Configure stable CI signing

Create these GitHub Actions repository secrets:

```text
ANDROID_SIGNING_KEYSTORE_B64
ANDROID_SIGNING_PASSWORD
ANDROID_SIGNING_KEY_ALIAS
```

The workflow restores the keystore into the runner and signs the debug APK with it.

The keystore itself must never be committed to the repository.

Once one APK signed by this stable key is installed, later CI APKs signed by the same key can be installed directly as updates, provided their `versionCode` is higher.

Keep a permanent backup of the signing keystore. Losing the key means future APKs cannot update installations signed with that key.
