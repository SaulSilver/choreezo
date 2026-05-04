import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Switch,
  TouchableOpacity,
  Alert,
  ScrollView,
  Share,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { useApartmentStore } from '../store/apartmentStore';
import { useSettingsStore } from '../store/settingsStore';
import { signOut } from '../services/auth';
import { leaveApartment } from '../services/apartments';
import LoadingSpinner from '../components/LoadingSpinner';
import UserAvatar from '../components/UserAvatar';

export default function SettingsScreen() {
  const { user, setUser, updateUser } = useAuthStore();
  const { apartment, setApartment, members } = useApartmentStore();
  const { notifyDaily, notifyWeekly, setNotifyDaily, setNotifyWeekly } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          setUser(null);
        },
      },
    ]);
  };

  const handleLeaveApartment = async () => {
    if (!user) return;
    Alert.alert(
      'Leave Apartment',
      `Are you sure you want to leave ${apartment?.name ?? 'this apartment'}? You can rejoin later with the invite code.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await leaveApartment(user.id);
              updateUser({ apartmentId: null });
              setApartment(null);
            } catch (err: unknown) {
              const error = err as { message?: string };
              Alert.alert('Error', error.message ?? 'Failed to leave apartment');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleShareInviteCode = async () => {
    if (!apartment) return;
    await Share.share({
      message: `Join our apartment "${apartment.name}" on ChoreShare! Use invite code: ${apartment.inviteCode}`,
      title: 'ChoreShare Invite',
    });
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        {user && (
          <View style={styles.profileCard}>
            <UserAvatar name={user.name} size={64} />
            <Text style={styles.profileName}>{user.name}</Text>
          </View>
        )}

        {apartment && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Apartment</Text>
            <View style={styles.card}>
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Name</Text>
                <Text style={styles.rowValue}>{apartment.name}</Text>
              </View>
              <View style={styles.divider} />
              <TouchableOpacity style={styles.row} onPress={handleShareInviteCode}>
                <Text style={styles.rowLabel}>Invite Code</Text>
                <View style={styles.inviteCode}>
                  <Text style={styles.inviteCodeText}>{apartment.inviteCode}</Text>
                  <Text style={styles.shareIcon}>⬆️</Text>
                </View>
              </TouchableOpacity>
              <View style={styles.divider} />
              <View style={styles.row}>
                <Text style={styles.rowLabel}>Members</Text>
                <Text style={styles.rowValue}>{members.length}</Text>
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Daily Reminders</Text>
              <Switch
                value={notifyDaily}
                onValueChange={setNotifyDaily}
                trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
                thumbColor={notifyDaily ? '#6366F1' : '#F3F4F6'}
              />
            </View>
            <View style={styles.divider} />
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Weekly Summary</Text>
              <Switch
                value={notifyWeekly}
                onValueChange={setNotifyWeekly}
                trackColor={{ false: '#D1D5DB', true: '#A5B4FC' }}
                thumbColor={notifyWeekly ? '#6366F1' : '#F3F4F6'}
              />
            </View>
          </View>
        </View>

        <View style={styles.section}>
          {apartment && (
            <TouchableOpacity style={styles.dangerButton} onPress={handleLeaveApartment}>
              <Text style={styles.dangerButtonText}>Leave Apartment</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
            <Text style={styles.signOutButtonText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 20, paddingBottom: 40 },
  profileCard: { alignItems: 'center', paddingVertical: 24, marginBottom: 8 },
  profileName: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginTop: 12 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, paddingHorizontal: 4 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 14, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  rowLabel: { fontSize: 16, color: '#1F2937' },
  rowValue: { fontSize: 16, color: '#6B7280' },
  divider: { height: 1, backgroundColor: '#F3F4F6', marginHorizontal: 16 },
  inviteCode: { flexDirection: 'row', alignItems: 'center' },
  inviteCodeText: { fontSize: 18, fontWeight: '800', color: '#6366F1', letterSpacing: 4, marginRight: 8 },
  shareIcon: { fontSize: 16 },
  dangerButton: { backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#FECACA' },
  dangerButtonText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  signOutButton: { backgroundColor: '#F3F4F6', borderRadius: 12, paddingVertical: 16, alignItems: 'center' },
  signOutButtonText: { color: '#374151', fontSize: 16, fontWeight: '600' },
});
