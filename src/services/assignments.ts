import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from './firebase';
import { Assignment, User, Chore } from '../models';
import { generateWeekAssignments } from '../utils/scheduling';
import { getWeekDates, getWeekNumber, formatDate } from '../utils/dateUtils';
import { buildCreateMetadata, buildUpdateMetadata } from '../utils/timestamps';

export async function getAssignmentsForWeek(
  apartmentId: string,
  weekNumber: number
): Promise<Assignment[]> {
  const q = query(
    collection(db, 'apartments', apartmentId, 'assignments'),
    where('weekNumber', '==', weekNumber)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Assignment));
}

export async function generateAndSaveWeekAssignments(
  apartmentId: string,
  users: User[],
  chores: Chore[],
  weekNumber: number,
  existingAssignments: Assignment[]
): Promise<Assignment[]> {
  const weekDates = getWeekDates(weekNumber);
  const newAssignments = generateWeekAssignments(
    users,
    chores,
    weekDates,
    weekNumber,
    existingAssignments
  );

  const batch = writeBatch(db);
  for (const assignment of newAssignments) {
    const ref = doc(collection(db, 'apartments', apartmentId, 'assignments'));
    const a: Assignment = { ...assignment, id: ref.id, apartmentId };
    batch.set(ref, { ...a, ...buildCreateMetadata() });
    assignment.id = ref.id;
    assignment.apartmentId = apartmentId;
  }
  await batch.commit();
  return newAssignments;
}

export async function updateAssignment(
  apartmentId: string,
  assignmentId: string,
  updates: Partial<Assignment>
): Promise<void> {
  const ref = doc(db, 'apartments', apartmentId, 'assignments', assignmentId);
  await updateDoc(ref, { ...updates, ...buildUpdateMetadata() });
}

export async function seedDemoAssignments(
  apartmentId: string,
  users: User[],
  chores: Chore[]
): Promise<Assignment[]> {
  const memberIds = users.map((user) => user.id);
  if (memberIds.length === 0 || chores.length === 0) return [];

  const weekNumber = getWeekNumber();
  const weekDates = getWeekDates(weekNumber);
  const batch = writeBatch(db);
  const assignments: Assignment[] = [];

  weekDates.forEach((date, dayIndex) => {
    chores.forEach((chore, choreIndex) => {
      const memberId = memberIds[(dayIndex + choreIndex) % memberIds.length];
      const ref = doc(collection(db, 'apartments', apartmentId, 'assignments'));
      const assignment: Assignment = {
        id: ref.id,
        apartmentId,
        userId: memberId,
        choreId: chore.id,
        date: formatDate(date),
        weekNumber,
        manuallyAssigned: true,
      };
      assignments.push(assignment);
      batch.set(ref, { ...assignment, ...buildCreateMetadata() });
    });
  });

  await batch.commit();
  return assignments;
}
