import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from './firebase';
import { Apartment, User } from '../models';
import { generateInviteCode } from '../utils/inviteCode';
import { buildCreateMetadata, buildUpdateMetadata } from '../utils/timestamps';

export async function createOrUpdateUser(user: Omit<User, 'expoPushToken'>): Promise<void> {
  await setDoc(doc(db, 'users', user.id), { ...user, ...buildUpdateMetadata() }, { merge: true });
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

  const userRef = doc(db, 'users', id);
  const existing = await getDoc(userRef);
  if (existing.exists()) {
    await setDoc(userRef, { ...data, ...buildUpdateMetadata() }, { merge: true });
  } else {
    await setDoc(userRef, { ...data, ...buildCreateMetadata() }, { merge: true });
  }
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
  await setDoc(ref, { ...apartment, ...buildCreateMetadata() });
  await setDoc(doc(db, 'users', createdBy), { apartmentId: ref.id, ...buildUpdateMetadata() }, { merge: true });
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

  await setDoc(doc(db, 'users', userId), { apartmentId: apartment.id, ...buildUpdateMetadata() }, { merge: true });
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
  await setDoc(doc(db, 'users', userId), { apartmentId: null, ...buildUpdateMetadata() }, { merge: true });
}

export async function deleteApartment(apartmentId: string, userId: string): Promise<void> {
  if (!apartmentId) throw new Error('Apartment ID is required');
  if (!userId) throw new Error('User ID is required');

  const apartment = await getApartment(apartmentId);
  if (!apartment) throw new Error('Apartment not found');
  if (apartment.createdBy !== userId) throw new Error('Only the apartment admin can delete the apartment');

  // Clear apartmentId for all members
  const members = await getApartmentMembers(apartmentId);
  await Promise.all(
    members.map((member) =>
      setDoc(doc(db, 'users', member.id), { apartmentId: null, ...buildUpdateMetadata() }, { merge: true })
    )
  );

  // Delete the apartment document
  await deleteDoc(doc(db, 'apartments', apartmentId));
}

export async function deleteAccount(userId: string): Promise<void> {
  if (!userId) throw new Error('User ID is required');
  await deleteDoc(doc(db, 'users', userId));
}
