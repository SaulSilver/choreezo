import {
  collection,
  doc,
  getDoc,
  setDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';
import { Apartment, User } from '../models';
import { generateInviteCode } from '../utils/inviteCode';

export async function createOrUpdateUser(user: Omit<User, 'expoPushToken'>): Promise<void> {
  await setDoc(doc(db, 'users', user.id), user, { merge: true });
}

export async function upsertSignInUser(
  id: string,
  fields: { name?: string | null; email?: string | null; authProvider?: string }
): Promise<void> {
  // Strip undefined/null fields so Firestore merge does not overwrite existing
  // values with nulls when the auth provider doesn't return them on a returning
  // sign-in (Apple only sends name/email on the first authorization).
  const data: Record<string, unknown> = {};
  if (fields.name && fields.name.trim().length > 0) data.name = fields.name.trim();
  if (fields.email && fields.email.trim().length > 0) data.email = fields.email.trim();
  if (fields.authProvider) data.authProvider = fields.authProvider;
  await setDoc(doc(db, 'users', id), data, { merge: true });
}

export async function getUser(
  id: string
): Promise<(User & { email?: string | null }) | null> {
  const snap = await getDoc(doc(db, 'users', id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as User & { email?: string | null };
}

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
  await setDoc(doc(db, 'users', createdBy), { apartmentId: ref.id }, { merge: true });
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

  await setDoc(doc(db, 'users', userId), { apartmentId: apartment.id }, { merge: true });
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
  await setDoc(doc(db, 'users', userId), { apartmentId: null }, { merge: true });
}
