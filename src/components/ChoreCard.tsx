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
  const isUnassigned = !assignedUser;
  return (
    <TouchableOpacity
      style={[
        styles.card,
        isCurrentUser && styles.highlighted,
        isUnassigned && styles.unassignedCard,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.left}>
        <Text style={styles.icon}>{chore.icon ?? '🧹'}</Text>
        <View style={styles.choreTextWrap}>
          <Text style={styles.choreName}>{chore.name}</Text>
          {isUnassigned && (
            <Text style={styles.claimHint}>Tap to claim</Text>
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
          <View style={styles.unassignedBadge}>
            <Text style={styles.unassignedBadgeText}>Unassigned</Text>
          </View>
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
  unassignedCard: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    backgroundColor: '#FAFAFA',
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  choreTextWrap: {
    flexShrink: 1,
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
  claimHint: {
    fontSize: 12,
    color: '#6366F1',
    marginTop: 2,
    fontWeight: '600',
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
  unassignedBadge: {
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  unassignedBadgeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
});
