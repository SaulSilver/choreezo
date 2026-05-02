import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Apartment, User } from '../models';
import { generateInviteCode } from '../utils/inviteCode';

export async function createApartment(
  name: string,
  createdBy: string,
  timezone: string = 'UTC'
): Promise<Apartment> {
  const inviteCode = generateInviteCode();
  const ref = doc(collection(db, 'apartments'));
  const apartment: Apartment = {
    id: ref.id,
    name,
    inviteCode,
    timezone,
    createdBy,
  };
  await setDoc(ref, { ...apartment, createdAt: serverTimestamp() });
  await updateDoc(doc(db, 'users', createdBy), { apartmentId: ref.id });
  return apartment;
}

export async function joinApartment(
  inviteCode: string,
  userId: string
): Promise<Apartment> {
  const q = query(
    collection(db, 'apartments'),
    where('inviteCode', '==', inviteCode.toUpperCase())
  );
  const snap = await getDocs(q);
  if (snap.empty) throw new Error('Invalid invite code');

  const apartmentDoc = snap.docs[0];
  const apartment = { id: apartmentDoc.id, ...apartmentDoc.data() } as Apartment;

  await updateDoc(doc(db, 'users', userId), { apartmentId: apartment.id });
  return apartment;
}

export async function getApartment(apartmentId: string): Promise<Apartment | null> {
  const snap = await getDoc(doc(db, 'apartments', apartmentId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Apartment;
}

export async function getApartmentMembers(apartmentId: string): Promise<User[]> {
  const q = query(
    collection(db, 'users'),
    where('apartmentId', '==', apartmentId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as User));
}

export async function leaveApartment(userId: string): Promise<void> {
  await updateDoc(doc(db, 'users', userId), { apartmentId: null });
}
