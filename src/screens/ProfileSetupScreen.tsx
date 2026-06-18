import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import * as AppleAuthentication from "expo-apple-authentication";
import { useProfileStore, generateUserId } from "../store/profileStore";
import {
  isAppleSignInAvailable,
  AppleSignInCancelledError,
} from "../services/auth";

export default function ProfileSetupScreen() {
  const [displayName, setDisplayName] = useState("");
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleSubmitting, setAppleSubmitting] = useState(false);
  const { setProfile, signInWithApple } = useProfileStore();

  useEffect(() => {
    let cancelled = false;
    isAppleSignInAvailable().then((available) => {
      if (!cancelled) setAppleAvailable(available);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleContinue = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert("Name Required", "Please enter your name to continue.");
      return;
    }
    const userId = generateUserId();
    await setProfile(userId, trimmed);
  };

  const handleAppleSignIn = async () => {
    if (appleSubmitting) return;
    setAppleSubmitting(true);
    try {
      await signInWithApple();
      // If Apple didn't return a name (returning user, no Firestore record yet)
      // we leave the user on this screen so they can enter one — the existing
      // gating in RootNavigator already requires both userId and name.
      if (!useProfileStore.getState().name) {
        Alert.alert(
          "One more step",
          "Apple didn't share your name. Please enter how you'd like to be shown to roommates.",
        );
      }
    } catch (error) {
      if (error instanceof AppleSignInCancelledError) return;
      console.error("Apple sign-in failed", error);
      Alert.alert(
        "Sign-in failed",
        "We couldn't complete Sign in with Apple. Please try again.",
      );
    } finally {
      setAppleSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View style={styles.hero}>
          <Text style={styles.emoji}>🏠</Text>
          <Text style={styles.appName}>Choreezo</Text>
          <Text style={styles.tagline}>
            Fairly distribute household chores among roommates
          </Text>
        </View>

        <View style={styles.form}>
          {appleAvailable && (
            <View style={styles.appleSection}>
              <AppleAuthentication.AppleAuthenticationButton
                buttonType={
                  AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
                }
                buttonStyle={
                  AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
                }
                cornerRadius={12}
                style={styles.appleButton}
                onPress={handleAppleSignIn}
              />
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with a name</Text>
                <View style={styles.dividerLine} />
              </View>
            </View>
          )}

          <Text style={styles.label}>Your Name</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="e.g. Alex, Jordan"
            placeholderTextColor="#9CA3AF"
            autoCapitalize="words"
            returnKeyType="done"
            onSubmitEditing={handleContinue}
          />
          <TouchableOpacity style={styles.button} onPress={handleContinue}>
            <Text style={styles.buttonText}>Get Started</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F9FAFB" },
  inner: { flex: 1, justifyContent: "space-between", paddingBottom: 40 },
  hero: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emoji: { fontSize: 72, marginBottom: 16 },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#1F2937",
    marginBottom: 12,
  },
  tagline: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 24,
  },
  form: { paddingHorizontal: 24 },
  appleSection: { marginBottom: 20 },
  // Apple HIG: minimum 44pt tap target; we use 48 for comfort.
  appleButton: { width: "100%", height: 48 },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#E5E7EB" },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 12,
    color: "#9CA3AF",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  label: { fontSize: 14, fontWeight: "600", color: "#374151", marginBottom: 8 },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: "#1F2937",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    marginBottom: 20,
  },
  button: {
    backgroundColor: "#6366F1",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
  },
  buttonText: { color: "#FFFFFF", fontSize: 17, fontWeight: "700" },
});
