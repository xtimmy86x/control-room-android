package com.xtimmy86x.controlroom;

import androidx.annotation.NonNull;
import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.core.content.ContextCompat;
import androidx.fragment.app.FragmentActivity;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.concurrent.Executor;

@CapacitorPlugin(name = "BiometricAuth")
public class BiometricAuthPlugin extends Plugin {

    private static final int AUTHENTICATORS =
        BiometricManager.Authenticators.BIOMETRIC_WEAK;

    @PluginMethod
    public void isAvailable(PluginCall call) {
        BiometricManager manager = BiometricManager.from(getContext());
        int status = manager.canAuthenticate(AUTHENTICATORS);

        JSObject result = new JSObject();
        result.put("available", status == BiometricManager.BIOMETRIC_SUCCESS);
        result.put("status", status);
        call.resolve(result);
    }

    @PluginMethod
    public void authenticate(PluginCall call) {
        if (!(getActivity() instanceof FragmentActivity)) {
            call.reject("Biometric authentication is unavailable on this activity");
            return;
        }

        BiometricManager manager = BiometricManager.from(getContext());
        if (manager.canAuthenticate(AUTHENTICATORS)
            != BiometricManager.BIOMETRIC_SUCCESS) {
            call.reject("Biometric authentication is not available");
            return;
        }

        String title = call.getString("title", "Sblocca HA Control Room");
        String subtitle = call.getString(
            "subtitle",
            "Usa impronta digitale o riconoscimento biometrico"
        );

        FragmentActivity activity = (FragmentActivity) getActivity();
        Executor executor = ContextCompat.getMainExecutor(getContext());

        BiometricPrompt prompt = new BiometricPrompt(
            activity,
            executor,
            new BiometricPrompt.AuthenticationCallback() {
                @Override
                public void onAuthenticationSucceeded(
                    @NonNull BiometricPrompt.AuthenticationResult result
                ) {
                    super.onAuthenticationSucceeded(result);
                    JSObject response = new JSObject();
                    response.put("authenticated", true);
                    call.resolve(response);
                }

                @Override
                public void onAuthenticationError(
                    int errorCode,
                    @NonNull CharSequence errString
                ) {
                    super.onAuthenticationError(errorCode, errString);
                    call.reject(errString.toString(), "BIOMETRIC_ERROR_" + errorCode);
                }

                @Override
                public void onAuthenticationFailed() {
                    super.onAuthenticationFailed();
                    // Keep the native prompt open. Android will call success or error
                    // when the user authenticates or leaves the prompt.
                }
            }
        );

        BiometricPrompt.PromptInfo promptInfo =
            new BiometricPrompt.PromptInfo.Builder()
                .setTitle(title)
                .setSubtitle(subtitle)
                .setAllowedAuthenticators(AUTHENTICATORS)
                .setNegativeButtonText("Annulla")
                .build();

        activity.runOnUiThread(() -> prompt.authenticate(promptInfo));
    }
}
