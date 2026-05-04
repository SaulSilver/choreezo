import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SafeAreaView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { StackNavigationProp } from '@react-navigation/stack';
import { useProfileStore } from '../store/profileStore';
import { useApartmentStore } from '../store/apartmentStore';
import { useAssignmentStore } from '../store/assignmentStore';
import { formatDisplayDate, parseDate } from '../utils/dateUtils';
import ChoreCard from '../components/ChoreCard';
import EmptyState from '../components/EmptyState';
import type { AppStackParamList } from '../navigation/AppNavigator';

type NavProp = StackNavigationProp<AppStackParamList, 'EditAssignment'>;

export default function MyChoresScreen() {
  const navigation = useNavigation<NavProp>();
  const { userId } = useProfileStore();
  const { members, chores } = useApartmentStore();
  const { assignments } = useAssignmentStore();

  const myAssignments = useMemo(
    () =>
      assignments
        .filter((a) => a.userId === userId)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [assignments, userId]
  );

  const grouped = useMemo(() => {
    const groups: Record<string, typeof myAssignments> = {};
    for (const a of myAssignments) {
      if (!groups[a.date]) groups[a.date] = [];
      groups[a.date].push(a);
    }
    return groups;
  }, [myAssignments]);

  const sections = Object.entries(grouped).map(([date, items]) => ({
    date,
    displayDate: formatDisplayDate(parseDate(date)),
    items,
  }));

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={sections}
        keyExtractor={(item) => item.date}
        contentContainerStyle={sections.length === 0 ? { flex: 1 } : { paddingBottom: 24 }}
        ListEmptyComponent={
          <EmptyState
            icon="🎉"
            title="No chores assigned"
            message="You have no chores this week. Enjoy!"
          />
        }
        renderItem={({ item }) => (
          <View>
            <View style={styles.dateHeader}>
              <Text style={styles.dateText}>{item.displayDate}</Text>
            </View>
            {item.items.map((assignment) => {
              const chore = chores.find((c) => c.id === assignment.choreId);
              const assignedUser = members.find((m) => m.id === assignment.userId);
              if (!chore) return null;
              return (
                <ChoreCard
                  key={assignment.id}
                  assignment={assignment}
                  chore={chore}
                  assignedUser={assignedUser}
                  isCurrentUser
                  onPress={() =>
                    navigation.navigate('EditAssignment', { assignmentId: assignment.id })
                  }
                />
              );
            })}
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  dateHeader: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  dateText: { fontSize: 14, fontWeight: '700', color: '#6B7280', textTransform: 'uppercase', letterSpacing: 0.8 },
});
