import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { signInWithApple } from '../services/auth';
import { useAuthStore } from '../store/authStore';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AuthScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const { setUser, setError } = useAuthStore();

  const handleAppleSignIn = async () => {
    try {
      setIsLoading(true);
      const user = await signInWithApple();
      setUser(user);
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'ERR_REQUEST_CANCELED') {
        return;
      }
      const message = error.message ?? 'Sign in failed. Please try again.';
      setError(message);
      Alert.alert('Sign In Failed', message);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <LoadingSpinner fullScreen message="Signing in..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.emoji}>🏠</Text>
        <Text style={styles.appName}>ChoreShare</Text>
        <Text style={styles.tagline}>
          Fairly distribute household chores among roommates
        </Text>
      </View>

      <View style={styles.features}>
        {[
          { icon: '📅', text: 'Auto-scheduled weekly chores' },
          { icon: '🔄', text: 'Swap assignments with roommates' },
          { icon: '🔔', text: 'Daily & weekly reminders' },
        ].map((item) => (
          <View key={item.text} style={styles.featureRow}>
            <Text style={styles.featureIcon}>{item.icon}</Text>
            <Text style={styles.featureText}>{item.text}</Text>
          </View>
        ))}
      </View>

      <View style={styles.authContainer}>
        {Platform.OS === 'ios' ? (
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={styles.appleButton}
            onPress={handleAppleSignIn}
          />
        ) : (
          <View style={styles.notAvailable}>
            <Text style={styles.notAvailableText}>
              Apple Sign In is only available on iOS
            </Text>
          </View>
        )}
        <Text style={styles.terms}>
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    justifyContent: 'space-between',
    paddingBottom: 40,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emoji: { fontSize: 72, marginBottom: 16 },
  appName: { fontSize: 36, fontWeight: '800', color: '#1F2937', marginBottom: 12 },
  tagline: { fontSize: 16, color: '#6B7280', textAlign: 'center', paddingHorizontal: 32, lineHeight: 24 },
  features: { paddingHorizontal: 40, paddingVertical: 24 },
  featureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  featureIcon: { fontSize: 22, marginRight: 14 },
  featureText: { fontSize: 16, color: '#374151' },
  authContainer: { paddingHorizontal: 24, alignItems: 'center' },
  appleButton: { width: '100%', height: 52, marginBottom: 16 },
  notAvailable: { padding: 16, backgroundColor: '#FEF3C7', borderRadius: 12, marginBottom: 16, width: '100%' },
  notAvailableText: { color: '#92400E', textAlign: 'center', fontSize: 14 },
  terms: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', lineHeight: 18 },
});
