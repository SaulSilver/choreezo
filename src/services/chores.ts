import {
  collection,
  doc,
  setDoc,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { Chore } from '../models';
import { buildCreateMetadata } from '../utils/timestamps';

export const DEFAULT_CHORES: Omit<Chore, 'id'>[] = [
  { name: 'Lunch', icon: '🍽️' },
  { name: 'Dinner', icon: '🍴' },
  { name: 'Hoover', icon: '🧹' },
  { name: 'Mop', icon: '🪣' },
  { name: 'Dusting', icon: '🧹' },
  { name: 'Kitchen Cleaning', icon: '🧽' },
];

export async function initializeDefaultChores(apartmentId: string): Promise<Chore[]> {
  const chores: Chore[] = [];
  for (const chore of DEFAULT_CHORES) {
    const ref = doc(collection(db, 'apartments', apartmentId, 'chores'));
    const fullChore: Chore = { id: ref.id, ...chore };
    await setDoc(ref, { ...fullChore, ...buildCreateMetadata() });
    chores.push(fullChore);
  }
  return chores;
}

export async function getChores(apartmentId: string): Promise<Chore[]> {
  const snap = await getDocs(
    collection(db, 'apartments', apartmentId, 'chores')
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Chore));
}
