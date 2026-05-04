import {
  collection,
  doc,
  setDoc,
  getDocs,
  updateDoc,
  query,
  where,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Assignment, User, Chore } from '../models';
import { generateWeekAssignments } from '../utils/scheduling';
import { getWeekNumber, getWeekDates } from '../utils/dateUtils';

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
    batch.set(ref, { ...a, createdAt: serverTimestamp() });
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
  await updateDoc(ref, { ...updates, updatedAt: serverTimestamp() });
}

export async function swapAssignments(
  apartmentId: string,
  assignmentA: Assignment,
  assignmentB: Assignment
): Promise<void> {
  const batch = writeBatch(db);
  const refA = doc(db, 'apartments', apartmentId, 'assignments', assignmentA.id);
  const refB = doc(db, 'apartments', apartmentId, 'assignments', assignmentB.id);

  batch.update(refA, {
    userId: assignmentB.userId,
    manuallyAssigned: true,
    updatedAt: serverTimestamp(),
  });
  batch.update(refB, {
    userId: assignmentA.userId,
    manuallyAssigned: true,
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
}
