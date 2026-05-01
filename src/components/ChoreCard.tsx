import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Assignment, Chore, User } from '../models';
import UserAvatar from './UserAvatar';

interface Props {
  assignment: Assignment;
  chore: Chore;
  assignedUser: User | undefined;
  isCurrentUser: boolean;
  onPress?: () => void;
}

export default function ChoreCard({
  assignment,
  chore,
  assignedUser,
  isCurrentUser,
  onPress,
}: Props) {
  return (
    <TouchableOpacity
      style={[styles.card, isCurrentUser && styles.highlighted]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <Text style={styles.icon}>{chore.icon ?? '🧹'}</Text>
        <View>
          <Text style={styles.choreName}>{chore.name}</Text>
          {assignment.manuallyAssigned && (
            <Text style={styles.manualBadge}>Manually assigned</Text>
          )}
        </View>
      </View>
      <View style={styles.right}>
        {assignedUser ? (
          <>
            <UserAvatar name={assignedUser.name} size={32} />
            <Text style={styles.userName} numberOfLines={1}>
              {isCurrentUser ? 'You' : assignedUser.name.split(' ')[0]}
            </Text>
          </>
        ) : (
          <Text style={styles.unassigned}>Unassigned</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  highlighted: {
    borderWidth: 2,
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    fontSize: 28,
    marginRight: 12,
  },
  choreName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  manualBadge: {
    fontSize: 11,
    color: '#6366F1',
    marginTop: 2,
  },
  right: {
    alignItems: 'center',
    minWidth: 60,
  },
  userName: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    maxWidth: 60,
    textAlign: 'center',
  },
  unassigned: {
    fontSize: 13,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
});
