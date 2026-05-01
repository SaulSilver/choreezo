import * as AppleAuthentication from 'expo-apple-authentication';
import { OAuthProvider, signInWithCredential, signOut as firebaseSignOut, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import { User } from '../models';

export async function signInWithApple(): Promise<User> {
  const credential = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });

  const provider = new OAuthProvider('apple.com');
  const oauthCredential = provider.credential({
    idToken: credential.identityToken!,
    rawNonce: credential.authorizationCode ?? undefined,
  });

  const userCredential = await signInWithCredential(auth, oauthCredential);
  const firebaseUser: FirebaseUser = userCredential.user;

  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const fullName = credential.fullName;
    const displayName = fullName
      ? [fullName.givenName, fullName.familyName].filter(Boolean).join(' ')
      : firebaseUser.displayName ?? 'User';

    const newUser: User = {
      id: firebaseUser.uid,
      name: displayName,
      appleId: credential.user,
      apartmentId: null,
      notifyDaily: true,
      notifyWeekly: true,
    };
    await setDoc(userRef, { ...newUser, createdAt: serverTimestamp() });
    return newUser;
  }

  return userSnap.data() as User;
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

export async function getCurrentUser(uid: string): Promise<User | null> {
  const userRef = doc(db, 'users', uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return null;
  return snap.data() as User;
}

export async function updateUserToken(userId: string, token: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, { expoPushToken: token }, { merge: true });
}
