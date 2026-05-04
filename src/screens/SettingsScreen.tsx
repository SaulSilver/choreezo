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
import { useProfileStore } from '../store/profileStore';
import { useApartmentStore } from '../store/apartmentStore';
import { useSettingsStore } from '../store/settingsStore';
import { leaveApartment, deleteAccount, deleteApartment } from '../services/apartments';
import LoadingSpinner from '../components/LoadingSpinner';
import UserAvatar from '../components/UserAvatar';

export default function SettingsScreen() {
  const { userId, name, authProvider, setApartmentId, clearProfile } = useProfileStore();
  const { apartment, setApartment, setMembers, setChores, members } = useApartmentStore();
  const { notifyDaily, notifyWeekly, setNotifyDaily, setNotifyWeekly } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(false);

  const isAdmin = !!(apartment && userId && apartment.createdBy === userId);

  const handleLeaveApartment = async () => {
    if (!userId) return;
    if (isAdmin) {
      Alert.alert(
        'Cannot Leave Apartment',
        'You are the apartment admin. Please delete the apartment before leaving.'
      );
      return;
    }
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
              await leaveApartment(userId);
              setApartment(null);
              await setApartmentId(null);
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

  const handleDeleteApartment = () => {
    if (!userId || !apartment) return;
    Alert.alert(
      'Delete Apartment',
      `Are you sure you want to delete "${apartment.name}"? All members will be removed and this action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await deleteApartment(apartment.id, userId);
              setApartment(null);
              setMembers([]);
              setChores([]);
              await setApartmentId(null);
            } catch (err: unknown) {
              const error = err as { message?: string };
              Alert.alert('Error', error.message ?? 'Failed to delete apartment');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    if (!userId) return;
    if (isAdmin) {
      Alert.alert(
        'Cannot Sign Out',
        'You are the apartment admin. Please delete the apartment before signing out.'
      );
      return;
    }
    const message =
      authProvider === 'apple'
        ? 'Are you sure you want to sign out? You can sign back in with Apple at any time.'
        : 'Are you sure you want to sign out? Your local profile will be cleared from this device.';
    Alert.alert('Sign Out', message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            setIsLoading(true);
            if (apartment) {
              await leaveApartment(userId);
              setApartment(null);
              await setApartmentId(null);
            }
            await clearProfile();
          } catch (err: unknown) {
            const error = err as { message?: string };
            Alert.alert('Error', error.message ?? 'Failed to sign out');
          } finally {
            setIsLoading(false);
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = () => {
    if (!userId) return;
    if (isAdmin) {
      Alert.alert(
        'Cannot Delete Account',
        'You are the apartment admin. Please transfer ownership or delete the apartment before deleting your account.'
      );
      return;
    }
    Alert.alert(
      'Delete Account',
      'Are you sure you want to permanently delete your account? All your data will be removed. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await deleteAccount(userId);
              await clearProfile();
            } catch (err: unknown) {
              const error = err as { message?: string };
              Alert.alert('Error', error.message ?? 'Failed to delete account');
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
        {name && (
          <View style={styles.profileCard}>
            <UserAvatar name={name} size={64} />
            <Text style={styles.profileName}>{name}</Text>
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

        {userId && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Account</Text>
            {apartment && !isAdmin && (
              <TouchableOpacity style={styles.dangerButton} onPress={handleLeaveApartment}>
                <Text style={styles.dangerButtonText}>Leave Apartment</Text>
              </TouchableOpacity>
            )}
            {apartment && isAdmin && (
              <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteApartment}>
                <Text style={styles.dangerButtonText}>Delete Apartment</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.dangerButton} onPress={handleSignOut}>
              <Text style={styles.dangerButtonText}>Sign Out</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.dangerButton} onPress={handleDeleteAccount}>
              <Text style={styles.dangerButtonText}>Delete Account</Text>
            </TouchableOpacity>
          </View>
        )}
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
});
