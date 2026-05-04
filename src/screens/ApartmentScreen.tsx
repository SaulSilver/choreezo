import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { createApartment, joinApartment, getApartmentMembers, createOrUpdateUser } from '../services/apartments';
import { initializeDefaultChores, getChores } from '../services/chores';
import { useProfileStore } from '../store/profileStore';
import { useApartmentStore } from '../store/apartmentStore';
import { useSettingsStore } from '../store/settingsStore';
import LoadingSpinner from '../components/LoadingSpinner';

type Tab = 'create' | 'join';

export default function ApartmentScreen() {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [apartmentName, setApartmentName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { userId, name, setApartmentId } = useProfileStore();
  const { setApartment, setMembers, setChores } = useApartmentStore();
  const { notifyDaily, notifyWeekly } = useSettingsStore();

  const handleCreate = async () => {
    if (!userId || !name) return;
    if (!apartmentName.trim()) {
      Alert.alert('Error', 'Please enter an apartment name');
      return;
    }
    try {
      setIsLoading(true);
      await createOrUpdateUser({ id: userId, name, apartmentId: null, notifyDaily, notifyWeekly });
      const apartment = await createApartment(apartmentName.trim(), userId);
      const chores = await initializeDefaultChores(apartment.id);
      const members = await getApartmentMembers(apartment.id);
      setApartment(apartment);
      setChores(chores);
      setMembers(members);
      await setApartmentId(apartment.id);
    } catch (err: unknown) {
      const error = err as { message?: string };
      Alert.alert('Error', error.message ?? 'Failed to create apartment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!userId || !name) return;
    if (inviteCode.trim().length !== 6) {
      Alert.alert('Error', 'Please enter a valid 6-character invite code');
      return;
    }
    try {
      setIsLoading(true);
      await createOrUpdateUser({ id: userId, name, apartmentId: null, notifyDaily, notifyWeekly });
      const apartment = await joinApartment(inviteCode.trim(), userId);
      const chores = await getChores(apartment.id);
      const members = await getApartmentMembers(apartment.id);
      setApartment(apartment);
      setChores(chores);
      setMembers(members);
      await setApartmentId(apartment.id);
    } catch (err: unknown) {
      const error = err as { message?: string };
      Alert.alert('Error', error.message ?? 'Failed to join apartment');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <LoadingSpinner
        fullScreen
        message={activeTab === 'create' ? 'Creating apartment...' : 'Joining apartment...'}
      />
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={styles.header}>
            <Text style={styles.emoji}>🏠</Text>
            <Text style={styles.title}>Set Up Your Home</Text>
            <Text style={styles.subtitle}>
              Create a new apartment or join one with an invite code
            </Text>
          </View>

          <View style={styles.tabs}>
            {(['create', 'join'] as Tab[]).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, activeTab === tab && styles.activeTab]}
                onPress={() => setActiveTab(tab)}
              >
                <Text style={[styles.tabText, activeTab === tab && styles.activeTabText]}>
                  {tab === 'create' ? 'Create New' : 'Join Existing'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.form}>
            {activeTab === 'create' ? (
              <>
                <Text style={styles.label}>Apartment Name</Text>
                <TextInput
                  style={styles.input}
                  value={apartmentName}
                  onChangeText={setApartmentName}
                  placeholder="e.g. The Loft, 42 Main St"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={handleCreate}
                />
                <TouchableOpacity style={styles.button} onPress={handleCreate}>
                  <Text style={styles.buttonText}>Create Apartment</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.label}>Invite Code</Text>
                <TextInput
                  style={[styles.input, styles.codeInput]}
                  value={inviteCode}
                  onChangeText={(t) => setInviteCode(t.toUpperCase())}
                  placeholder="XXXXXX"
                  placeholderTextColor="#9CA3AF"
                  autoCapitalize="characters"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={handleJoin}
                />
                <TouchableOpacity style={styles.button} onPress={handleJoin}>
                  <Text style={styles.buttonText}>Join Apartment</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40 },
  header: { alignItems: 'center', marginBottom: 32 },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', lineHeight: 22 },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 4,
    marginBottom: 28,
  },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeTab: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  activeTabText: { color: '#1F2937', fontWeight: '700' },
  form: {},
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#1F2937',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    marginBottom: 20,
  },
  codeInput: { textAlign: 'center', letterSpacing: 8, fontSize: 22, fontWeight: '700' },
  button: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
});
