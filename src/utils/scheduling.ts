import { User, Chore, Assignment } from '../models';
import { formatDate } from './dateUtils';

export function generateWeekAssignments(
  users: User[],
  chores: Chore[],
  weekDates: Date[],
  weekOffset: number,
  existingAssignments: Assignment[]
): Assignment[] {
  if (users.length === 0 || chores.length === 0) return [];

  const manuallyAssigned = new Set(
    existingAssignments
      .filter((a) => a.manuallyAssigned)
      .map((a) => `${a.date}-${a.choreId}`)
  );

  const assignments: Assignment[] = [];

  weekDates.forEach((date, dayIndex) => {
    const dateStr = formatDate(date);

    chores.forEach((chore, choreIndex) => {
      const key = `${dateStr}-${chore.id}`;
      if (manuallyAssigned.has(key)) {
        const existing = existingAssignments.find(
          (a) => a.date === dateStr && a.choreId === chore.id
        );
        if (existing) {
          assignments.push(existing);
          return;
        }
      }

      const userIndex = (dayIndex + choreIndex + weekOffset) % users.length;
      assignments.push({
        id: '', // populated by Firestore after write
        apartmentId: '', // populated by caller before write
        userId: users[userIndex].id,
        choreId: chore.id,
        date: dateStr,
        weekNumber: weekOffset,
        manuallyAssigned: false,
      });
    });
  });

  return assignments;
}
