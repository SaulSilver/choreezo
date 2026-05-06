import { User, Chore, Assignment } from '../models';
import { formatDate } from './dateUtils';

/**
 * Build the set of assignment slots for a week.
 *
 * Chores are no longer auto-assigned to users on a rotating basis. Instead,
 * one **unassigned** slot is created for every (date, chore) pair so that
 * users can browse and claim the chores they want via the UI. Existing
 * assignments (whether claimed or already left unassigned) are preserved
 * as-is so that user choices are never overwritten.
 */
export function generateWeekAssignments(
  // `_users` is retained for backward compatibility with existing callers.
  // Auto-assignment based on the user list has been removed in favor of
  // manual claiming via the UI; chores are now seeded unassigned.
  _users: User[],
  chores: Chore[],
  weekDates: Date[],
  weekOffset: number,
  existingAssignments: Assignment[]
): Assignment[] {
  if (chores.length === 0) return [];

  const existingByKey = new Map<string, Assignment>();
  for (const a of existingAssignments) {
    existingByKey.set(`${a.date}-${a.choreId}`, a);
  }

  const assignments: Assignment[] = [];

  weekDates.forEach((date) => {
    const dateStr = formatDate(date);

    chores.forEach((chore) => {
      const key = `${dateStr}-${chore.id}`;
      const existing = existingByKey.get(key);
      if (existing) {
        assignments.push(existing);
        return;
      }

      assignments.push({
        id: '', // populated by Firestore after write
        apartmentId: '', // populated by caller before write
        userId: null,
        choreId: chore.id,
        date: dateStr,
        weekNumber: weekOffset,
        manuallyAssigned: false,
      });
    });
  });

  return assignments;
}
