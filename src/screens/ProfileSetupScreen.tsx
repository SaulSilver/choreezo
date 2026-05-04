import React, { useState } from "react";
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
import { useProfileStore, generateUserId } from "../store/profileStore";

export default function ProfileSetupScreen() {
  const [displayName, setDisplayName] = useState("");
  const { setProfile } = useProfileStore();

  const handleContinue = async () => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      Alert.alert("Name Required", "Please enter your name to continue.");
      return;
    }
    console.log("handleContinue");
    const userId = generateUserId();
    console.log("userId", userId);
    await setProfile(userId, trimmed);
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.inner}
      >
        <View style={styles.hero}>
          <Text style={styles.emoji}>🏠</Text>
          <Text style={styles.appName}>ChoreShare</Text>
          <Text style={styles.tagline}>
            Fairly distribute household chores among roommates
          </Text>
        </View>

        <View style={styles.form}>
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
