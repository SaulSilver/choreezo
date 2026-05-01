import React from 'react';
import { View, ActivityIndicator, StyleSheet, Text } from 'react-native';

interface Props {
  message?: string;
  fullScreen?: boolean;
}

export default function LoadingSpinner({ message, fullScreen = false }: Props) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen]}>
      <ActivityIndicator size="large" color="#6366F1" />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fullScreen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
});
