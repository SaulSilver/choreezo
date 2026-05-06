import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { useApartmentStore } from '../store/apartmentStore';
import { useAssignmentStore } from '../store/assignmentStore';
import { useProfileStore } from '../store/profileStore';
import { updateAssignment, swapAssignments } from '../services/assignments';
import { formatDisplayDate, parseDate } from '../utils/dateUtils';
import UserAvatar from '../components/UserAvatar';
import LoadingSpinner from '../components/LoadingSpinner';
import type { AppStackParamList } from '../navigation/AppNavigator';

type RouteType = RouteProp<AppStackParamList, 'EditAssignment'>;

export default function EditAssignmentScreen() {
  const route = useRoute<RouteType>();
  const navigation = useNavigation();
  const { assignmentId } = route.params;

  const { members, chores, apartment } = useApartmentStore();
  const { assignments, updateAssignment: updateLocalAssignment } = useAssignmentStore();
  const { userId } = useProfileStore();

  const assignment = assignments.find((a) => a.id === assignmentId);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(
    assignment?.userId ?? null
  );
  const [swapMode, setSwapMode] = useState(false);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (assignment) setSelectedUserId(assignment.userId);
  }, [assignment]);

  if (!assignment || !apartment) {
    return <LoadingSpinner fullScreen />;
  }

  const chore = chores.find((c) => c.id === assignment.choreId);
  const sameChoreAssignments = assignments.filter(
    (a) => a.choreId === assignment.choreId && a.id !== assignment.id
  );

  const handleSave = async () => {
    if (selectedUserId === assignment.userId) {
      navigation.goBack();
      return;
    }
    try {
      setIsLoading(true);
      await updateAssignment(apartment.id, assignment.id, {
        userId: selectedUserId,
        manuallyAssigned: selectedUserId !== null,
      });
      updateLocalAssignment(assignment.id, {
        userId: selectedUserId,
        manuallyAssigned: selectedUserId !== null,
      });
      navigation.goBack();
    } catch (err: unknown) {
      const error = err as { message?: string };
      Alert.alert('Error', error.message ?? 'Failed to update assignment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClaimForMe = () => {
    if (!userId) return;
    setSelectedUserId(userId);
  };

  const handleSwap = async (targetAssignmentId: string) => {
    const targetAssignment = assignments.find((a) => a.id === targetAssignmentId);
    if (!targetAssignment) return;
    try {
      setIsLoading(true);
      await swapAssignments(apartment.id, assignment, targetAssignment);
      updateLocalAssignment(assignment.id, {
        userId: targetAssignment.userId,
        manuallyAssigned: true,
      });
      updateLocalAssignment(targetAssignment.id, {
        userId: assignment.userId,
        manuallyAssigned: true,
      });
      navigation.goBack();
    } catch (err: unknown) {
      const error = err as { message?: string };
      Alert.alert('Error', error.message ?? 'Failed to swap assignments');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) return <LoadingSpinner fullScreen message="Saving changes..." />;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.choreInfo}>
          <Text style={styles.choreIcon}>{chore?.icon ?? '🧹'}</Text>
          <Text style={styles.choreName}>{chore?.name}</Text>
          <Text style={styles.choreDate}>
            {formatDisplayDate(parseDate(assignment.date))}
          </Text>
        </View>

        <View style={styles.modeToggle}>
          <TouchableOpacity
            style={[styles.modeBtn, !swapMode && styles.activeModeBtn]}
            onPress={() => setSwapMode(false)}
          >
            <Text style={[styles.modeBtnText, !swapMode && styles.activeModeBtnText]}>
              Reassign
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.modeBtn, swapMode && styles.activeModeBtn]}
            onPress={() => setSwapMode(true)}
          >
            <Text style={[styles.modeBtnText, swapMode && styles.activeModeBtnText]}>
              🔄 Swap
            </Text>
          </TouchableOpacity>
        </View>

        {swapMode ? (
          <>
            <Text style={styles.sectionTitle}>Select a chore to swap with:</Text>
            {sameChoreAssignments.length === 0 ? (
              <Text style={styles.noSwap}>No other assignments of this chore to swap with.</Text>
            ) : (
              sameChoreAssignments.map((a) => {
                const aUser = members.find((m) => m.id === a.userId);
                const isSelected = swapTargetId === a.id;
                return (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.userRow, isSelected && styles.selectedRow]}
                    onPress={() => {
                      if (isSelected) {
                        handleSwap(a.id);
                      } else {
                        setSwapTargetId(a.id);
                      }
                    }}
                  >
                    {aUser ? (
                      <UserAvatar name={aUser.name} size={36} />
                    ) : (
                      <View style={styles.unassignedIcon}>
                        <Text style={styles.unassignedIconText}>—</Text>
                      </View>
                    )}
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>
                        {aUser ? `${aUser.name}${a.userId === userId ? ' (You)' : ''}` : 'Unassigned'}
                      </Text>
                      <Text style={styles.userDate}>
                        {formatDisplayDate(parseDate(a.date))}
                      </Text>
                    </View>
                    {isSelected && <Text style={styles.swapConfirm}>Tap to confirm swap</Text>}
                  </TouchableOpacity>
                );
              })
            )}
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>Assign to:</Text>
            {userId && assignment.userId !== userId && (
              <TouchableOpacity
                style={styles.claimButton}
                onPress={handleClaimForMe}
              >
                <Text style={styles.claimButtonText}>✋ Claim for me</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.userRow, selectedUserId === null && styles.selectedRow]}
              onPress={() => setSelectedUserId(null)}
            >
              <View style={styles.unassignedIcon}>
                <Text style={styles.unassignedIconText}>—</Text>
              </View>
              <Text style={styles.userName}>Unassigned</Text>
              {selectedUserId === null && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
            {members.map((member) => {
              const isSelected = selectedUserId === member.id;
              return (
                <TouchableOpacity
                  key={member.id}
                  style={[styles.userRow, isSelected && styles.selectedRow]}
                  onPress={() => setSelectedUserId(member.id)}
                >
                  <UserAvatar name={member.name} size={36} />
                  <Text style={styles.userName}>
                    {member.name}{member.id === userId ? ' (You)' : ''}
                  </Text>
                  {isSelected && <Text style={styles.checkmark}>✓</Text>}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  scroll: { padding: 24 },
  choreInfo: { alignItems: 'center', marginBottom: 24 },
  choreIcon: { fontSize: 48, marginBottom: 8 },
  choreName: { fontSize: 24, fontWeight: '800', color: '#1F2937', marginBottom: 4 },
  choreDate: { fontSize: 15, color: '#6B7280' },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#E5E7EB',
    borderRadius: 10,
    padding: 4,
    marginBottom: 24,
  },
  modeBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  activeModeBtn: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  modeBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '500' },
  activeModeBtnText: { color: '#1F2937', fontWeight: '700' },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12 },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedRow: { borderColor: '#6366F1', backgroundColor: '#EEF2FF' },
  userInfo: { flex: 1, marginLeft: 12 },
  userName: { fontSize: 16, fontWeight: '600', color: '#1F2937', marginLeft: 12 },
  userDate: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  checkmark: { fontSize: 20, color: '#6366F1', fontWeight: '700' },
  noSwap: { fontSize: 15, color: '#9CA3AF', textAlign: 'center', marginTop: 16 },
  swapConfirm: { fontSize: 12, color: '#6366F1', fontWeight: '600' },
  saveButton: {
    backgroundColor: '#6366F1',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  saveButtonText: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' },
  claimButton: {
    backgroundColor: '#10B981',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  claimButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  unassignedIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unassignedIconText: { color: '#9CA3AF', fontSize: 18, fontWeight: '700' },
});
