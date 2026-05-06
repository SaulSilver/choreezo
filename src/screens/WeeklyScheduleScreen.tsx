import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useProfileStore } from '../store/profileStore';
import { useApartmentStore } from '../store/apartmentStore';
import { useAssignmentStore } from '../store/assignmentStore';
import { getAssignmentsForWeek, generateAndSaveWeekAssignments } from '../services/assignments';
import { getCurrentWeekDates, getWeekNumber, formatDayName, formatDayNumber, formatDate, isTodayDate } from '../utils/dateUtils';
import ChoreCard from '../components/ChoreCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import type { AppStackParamList } from '../navigation/AppNavigator';

type NavProp = StackNavigationProp<AppStackParamList, 'EditAssignment'>;

export default function WeeklyScheduleScreen() {
  const navigation = useNavigation<NavProp>();
  const { userId } = useProfileStore();
  const { apartment, members, chores } = useApartmentStore();
  const { assignments, setAssignments, isLoading, setLoading, setError } = useAssignmentStore();

  const weekDates = getCurrentWeekDates();
  const today = new Date();
  const todayIndex = weekDates.findIndex((d) => formatDate(d) === formatDate(today));
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const [refreshing, setRefreshing] = useState(false);

  const loadAssignments = useCallback(async () => {
    if (!apartment || chores.length === 0) return;
    const weekNumber = getWeekNumber();
    setLoading(true);
    try {
      let existing = await getAssignmentsForWeek(apartment.id, weekNumber);
      if (existing.length === 0) {
        existing = await generateAndSaveWeekAssignments(
          apartment.id, members, chores, weekNumber, []
        );
      }
      setAssignments(existing);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [apartment, members, chores, setAssignments, setLoading, setError]);

  useEffect(() => {
    loadAssignments();
  }, [loadAssignments]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAssignments();
    setRefreshing(false);
  }, [loadAssignments]);

  const selectedDate = weekDates[selectedDayIndex];
  const selectedDateStr = selectedDate ? formatDate(selectedDate) : '';
  const dayAssignments = assignments.filter((a) => a.date === selectedDateStr);

  if (isLoading && assignments.length === 0) {
    return <LoadingSpinner fullScreen message="Loading schedule..." />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.daySelector}>
        {weekDates.map((date, index) => {
          const isSelected = index === selectedDayIndex;
          const isToday = isTodayDate(date);
          return (
            <TouchableOpacity
              key={index}
              style={[styles.dayTab, isSelected && styles.selectedDayTab]}
              onPress={() => setSelectedDayIndex(index)}
            >
              <Text style={[styles.dayName, isSelected && styles.selectedDayText]}>
                {formatDayName(date)}
              </Text>
              <View style={[styles.dayNumber, isToday && styles.todayCircle]}>
                <Text style={[
                  styles.dayNumberText,
                  isSelected && styles.selectedDayText,
                  isToday && styles.todayText,
                ]}>
                  {formatDayNumber(date)}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      <FlatList
        data={dayAssignments}
        keyExtractor={(item) => item.id}
        contentContainerStyle={dayAssignments.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="✅"
            title="No chores today"
            message="Enjoy your free day!"
          />
        }
        renderItem={({ item }) => {
          const chore = chores.find((c) => c.id === item.choreId);
          const assignedUser = members.find((m) => m.id === item.userId);
          if (!chore) return null;
          return (
            <ChoreCard
              assignment={item}
              chore={chore}
              assignedUser={assignedUser}
              isCurrentUser={item.userId === userId}
              onPress={() =>
                navigation.navigate('EditAssignment', { assignmentId: item.id })
              }
            />
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  daySelector: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  dayTab: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  selectedDayTab: { borderBottomWidth: 2, borderBottomColor: '#6366F1' },
  dayName: { fontSize: 11, color: '#9CA3AF', marginBottom: 4, fontWeight: '500' },
  selectedDayText: { color: '#6366F1', fontWeight: '700' },
  dayNumber: { width: 26, height: 26, alignItems: 'center', justifyContent: 'center', borderRadius: 13 },
  todayCircle: { backgroundColor: '#6366F1' },
  dayNumberText: { fontSize: 14, color: '#374151', fontWeight: '600' },
  todayText: { color: '#FFFFFF' },
});
