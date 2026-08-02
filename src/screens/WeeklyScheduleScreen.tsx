import React, { useState, useCallback, useEffect, useMemo, useLayoutEffect } from 'react';
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
import {
  getWeekDates,
  getWeekNumber,
  getWeekNumberWithOffset,
  formatDayName,
  formatDayNumber,
  formatDate,
  isTodayDate,
} from '../utils/dateUtils';
import ChoreCard from '../components/ChoreCard';
import LoadingSpinner from '../components/LoadingSpinner';
import EmptyState from '../components/EmptyState';
import type { AppStackParamList } from '../navigation/AppNavigator';

type NavProp = StackNavigationProp<AppStackParamList, 'EditAssignment'>;
const MIN_WEEK_OFFSET = -1;
const MAX_WEEK_OFFSET = 1;

export default function WeeklyScheduleScreen() {
  const navigation = useNavigation<NavProp>();
  const { userId } = useProfileStore();
  const { apartment, members, chores } = useApartmentStore();
  const {
    assignments,
    assignmentsByWeek,
    currentWeek,
    setCurrentWeek,
    setWeekAssignments,
    isLoading,
    setLoading,
    setError,
  } = useAssignmentStore();

  const currentWeekNumber = getWeekNumber();
  const currentWeekDates = useMemo(() => getWeekDates(currentWeekNumber), [currentWeekNumber]);
  const today = new Date();
  const todayIndex = currentWeekDates.findIndex((d) => formatDate(d) === formatDate(today));
  const [weekOffset, setWeekOffset] = useState(0);
  const visibleWeekNumber = getWeekNumberWithOffset(weekOffset);
  const weekDates = useMemo(() => getWeekDates(visibleWeekNumber), [visibleWeekNumber]);
  const [selectedDayIndex, setSelectedDayIndex] = useState(todayIndex >= 0 ? todayIndex : 0);
  const [refreshing, setRefreshing] = useState(false);
  const canGoPrevious = weekOffset > MIN_WEEK_OFFSET;
  const canGoNext = weekOffset < MAX_WEEK_OFFSET;

  const moveToWeekOffset = useCallback((targetOffset: number) => {
    const clampedOffset = Math.max(MIN_WEEK_OFFSET, Math.min(MAX_WEEK_OFFSET, targetOffset));
    if (clampedOffset === weekOffset) return;
    setWeekOffset(clampedOffset);
    if (clampedOffset === 0) {
      setSelectedDayIndex(todayIndex >= 0 ? todayIndex : 0);
      return;
    }
    setSelectedDayIndex(0);
  }, [todayIndex, weekOffset]);

  useLayoutEffect(() => {
    const centerWeekLabel =
      weekOffset === -1 ? 'Previous week' : weekOffset === 1 ? 'Next week' : 'Current week';

    navigation.setOptions({
      title: 'Current week',
      headerTitle: () => (
        <View style={styles.headerWeekNavigation}>
          <TouchableOpacity
            style={[styles.headerWeekButton, !canGoPrevious && styles.headerWeekButtonDisabled]}
            onPress={() => moveToWeekOffset(weekOffset - 1)}
            disabled={!canGoPrevious}
          >
            <Text style={[styles.headerWeekButtonText, !canGoPrevious && styles.headerWeekButtonTextDisabled]}>◀</Text>
          </TouchableOpacity>

          <Text style={styles.headerWeekLabel}>{centerWeekLabel}</Text>

          <TouchableOpacity
            style={[styles.headerWeekButton, !canGoNext && styles.headerWeekButtonDisabled]}
            onPress={() => moveToWeekOffset(weekOffset + 1)}
            disabled={!canGoNext}
          >
            <Text style={[styles.headerWeekButtonText, !canGoNext && styles.headerWeekButtonTextDisabled]}>▶</Text>
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation, weekOffset, canGoPrevious, canGoNext, moveToWeekOffset]);

  const loadWeekAssignments = useCallback(async (weekNumber: number, showLoading: boolean) => {
    if (!apartment || chores.length === 0) return;
    if (showLoading) {
      setLoading(true);
    }
    try {
      const existing = await getAssignmentsForWeek(apartment.id, weekNumber);
      if (existing.length > 0) {
        setWeekAssignments(weekNumber, existing);
        setError(null);
        return;
      }

      const generated = await generateAndSaveWeekAssignments(
        apartment.id,
        members,
        chores,
        weekNumber,
        existing
      );
      setWeekAssignments(weekNumber, generated);
      setError(null);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err.message ?? 'Failed to load assignments');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, [apartment, members, chores, setWeekAssignments, setLoading, setError]);

  useEffect(() => {
    setCurrentWeek(visibleWeekNumber);
    loadWeekAssignments(visibleWeekNumber, true);
  }, [visibleWeekNumber, setCurrentWeek, loadWeekAssignments]);

  const onRefresh = useCallback(async () => {
    if (!apartment || chores.length === 0) return;
    setRefreshing(true);
    const weekNumbers = [MIN_WEEK_OFFSET, 0, MAX_WEEK_OFFSET].map((offset) =>
      getWeekNumberWithOffset(offset)
    );
    await Promise.all(weekNumbers.map((weekNumber) => loadWeekAssignments(weekNumber, false)));
    setRefreshing(false);
  }, [apartment, chores, loadWeekAssignments]);

  const selectedDate = weekDates[selectedDayIndex];
  const selectedDateStr = selectedDate ? formatDate(selectedDate) : '';
  const visibleAssignments = assignmentsByWeek[currentWeek] ?? assignments;
  const dayAssignments = visibleAssignments.filter((a) => a.date === selectedDateStr);

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
  headerWeekNavigation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    gap: 8,
  },
  headerWeekButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
  },
  headerWeekButtonDisabled: {
    backgroundColor: '#F3F4F6',
  },
  headerWeekButtonText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '700',
  },
  headerWeekButtonTextDisabled: {
    color: '#9CA3AF',
  },
  headerWeekLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
  },
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
