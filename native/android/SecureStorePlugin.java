package com.xtimmy86x.controlroom;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.nio.charset.StandardCharsets;
import java.security.KeyStore;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "SecureStore")
public class SecureStorePlugin extends Plugin {

    private static final String KEY_ALIAS = "ha_control_room_secure_store";
    private static final String PREFS = "ha_control_room_secure_store";
    private static final String TRANSFORMATION = "AES/GCM/NoPadding";
    private static final int TAG_LENGTH_BITS = 128;

    private SharedPreferences prefs;

    @Override
    public void load() {
        prefs = getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void set(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || value == null) {
            call.reject("key and value are required");
            return;
        }

        try {
            prefs.edit().putString(key, encrypt(value)).apply();
            call.resolve();
        } catch (Exception ex) {
            call.reject("Unable to store encrypted value", null, ex);
        }
    }

    @PluginMethod
    public void get(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("key is required");
            return;
        }

        try {
            String encrypted = prefs.getString(key, null);
            JSObject result = new JSObject();
            result.put("value", encrypted == null ? null : decrypt(encrypted));
            call.resolve(result);
        } catch (Exception ex) {
            call.reject("Unable to decrypt stored value", null, ex);
        }
    }

    @PluginMethod
    public void remove(PluginCall call) {
        String key = call.getString("key");
        if (key == null) {
            call.reject("key is required");
            return;
        }
        prefs.edit().remove(key).apply();
        call.resolve();
    }

    @PluginMethod
    public void clear(PluginCall call) {
        prefs.edit().clear().apply();
        call.resolve();
    }

    private SecretKey getOrCreateKey() throws Exception {
        KeyStore keyStore = KeyStore.getInstance("AndroidKeyStore");
        keyStore.load(null);

        KeyStore.Entry entry = keyStore.getEntry(KEY_ALIAS, null);
        if (entry instanceof KeyStore.SecretKeyEntry) {
            return ((KeyStore.SecretKeyEntry) entry).getSecretKey();
        }

        KeyGenerator generator = KeyGenerator.getInstance(
            KeyProperties.KEY_ALGORITHM_AES,
            "AndroidKeyStore"
        );

        generator.init(
            new KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setRandomizedEncryptionRequired(true)
                .build()
        );

        return generator.generateKey();
    }

    private String encrypt(String value) throws Exception {
        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(Cipher.ENCRYPT_MODE, getOrCreateKey());

        byte[] encrypted = cipher.doFinal(value.getBytes(StandardCharsets.UTF_8));
        return Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP)
            + "."
            + Base64.encodeToString(encrypted, Base64.NO_WRAP);
    }

    private String decrypt(String stored) throws Exception {
        String[] parts = stored.split("\\.", 2);
        if (parts.length != 2) {
            throw new IllegalArgumentException("Invalid encrypted payload");
        }

        byte[] iv = Base64.decode(parts[0], Base64.NO_WRAP);
        byte[] encrypted = Base64.decode(parts[1], Base64.NO_WRAP);

        Cipher cipher = Cipher.getInstance(TRANSFORMATION);
        cipher.init(
            Cipher.DECRYPT_MODE,
            getOrCreateKey(),
            new GCMParameterSpec(TAG_LENGTH_BITS, iv)
        );

        return new String(cipher.doFinal(encrypted), StandardCharsets.UTF_8);
    }
}
