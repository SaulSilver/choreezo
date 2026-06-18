import { Platform } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as SecureStore from 'expo-secure-store';
import { upsertSignInUser, getUser } from './apartments';

// Stable identifier returned by Apple on every sign-in for a given user.
// Stored securely so we can re-validate the credential on subsequent launches
// and recognize returning users (Apple only returns name/email on first auth).
const APPLE_USER_KEY = 'choreezo_apple_user_id';

// Dev-only mock: when enabled, bypass the native Apple sign-in sheet and return
// a deterministic credential. Lets contributors iterate on auth-adjacent flows
// (sign out, profile, apartment join) without re-authenticating with iCloud on
// every simulator boot. Guarded by both `__DEV__` and an explicit env opt-in so
// it can never ship to production. See README → "Local development".
const MOCK_APPLE_ENABLED =
  __DEV__ && process.env.EXPO_PUBLIC_MOCK_APPLE === '1';
const MOCK_APPLE_USER_ID = 'dev-apple-user';
const MOCK_APPLE_NAME = 'Dev User';
const MOCK_APPLE_EMAIL = 'dev@example.com';

export interface AppleSignInResult {
  userId: string;
  name: string | null;
  email: string | null;
}

export class AppleSignInCancelledError extends Error {
  constructor() {
    super('Apple sign-in was cancelled');
    this.name = 'AppleSignInCancelledError';
  }
}

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (MOCK_APPLE_ENABLED) return true;
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function formatFullName(fullName: AppleAuthentication.AppleAuthenticationFullName | null): string | null {
  if (!fullName) return null;
  const parts = [fullName.givenName, fullName.familyName].filter(
    (part): part is string => Boolean(part && part.trim().length > 0)
  );
  const joined = parts.join(' ').trim();
  return joined.length > 0 ? joined : null;
}

/**
 * Triggers the native Sign in with Apple flow. Persists the Apple user id
 * via SecureStore, upserts the user document in Firestore (writing name/email
 * only when Apple actually provides them — i.e. on the first authorization),
 * and returns the data the caller needs to populate the local profile.
 *
 * Throws {@link AppleSignInCancelledError} when the user dismisses the sheet.
 */
export async function signInWithApple(): Promise<AppleSignInResult> {
  if (MOCK_APPLE_ENABLED) {
    const userId = MOCK_APPLE_USER_ID;
    const name = MOCK_APPLE_NAME;
    const email = MOCK_APPLE_EMAIL;
    try {
      await SecureStore.setItemAsync(APPLE_USER_KEY, userId);
    } catch {
      // ignore — mock flow doesn't depend on SecureStore for correctness
    }
    try {
      await upsertSignInUser(userId, { name, email, authProvider: 'apple' });
    } catch (error) {
      console.warn('[Choreezo] Mock Apple sign-in: failed to upsert user', error);
    }
    return { userId, name, email };
  }

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
    });
  } catch (error: unknown) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: string }).code === 'ERR_REQUEST_CANCELED'
    ) {
      throw new AppleSignInCancelledError();
    }
    throw error;
  }

  const userId = credential.user;
  let name = formatFullName(credential.fullName);
  let email = credential.email ?? null;

  await SecureStore.setItemAsync(APPLE_USER_KEY, userId);

  try {
    await upsertSignInUser(userId, { name, email, authProvider: 'apple' });
  } catch (error) {
    // Don't fail the sign-in if the backend write hiccups — local profile is
    // still set, and the next apartment create/join (or settings change) will
    // re-attempt the user-doc write.
    console.warn('[Choreezo] Failed to persist Apple sign-in user', error);
  }

  // Returning users on a new device won't get name/email from Apple — fall
  // back to the previously stored Firestore record so we can match them to
  // their existing account without forcing them to re-enter a name.
  if (!name || !email) {
    try {
      const existing = await getUser(userId);
      if (existing) {
        if (!name && existing.name) name = existing.name;
        if (!email && existing.email) email = existing.email;
      }
    } catch (error) {
      console.warn('[Choreezo] Failed to load existing user record', error);
    }
  }

  return { userId, name, email };
}

/**
 * Re-checks a previously stored Apple credential's state at app launch.
 * Returns the stored Apple user id when the credential is still authorized,
 * or null if the user revoked access / the credential was never set.
 */
export async function getCurrentAppleUserId(): Promise<string | null> {
  if (MOCK_APPLE_ENABLED) {
    try {
      const stored = await SecureStore.getItemAsync(APPLE_USER_KEY) ?? await SecureStore.getItemAsync(LEGACY_APPLE_USER_KEY);
      return stored ?? null;
    } catch {
      return null;
    }
  }
  if (Platform.OS !== 'ios') return null;
  let stored: string | null;
  try {
    stored = await SecureStore.getItemAsync(APPLE_USER_KEY) ?? await SecureStore.getItemAsync(LEGACY_APPLE_USER_KEY);
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    const state = await AppleAuthentication.getCredentialStateAsync(stored);
    if (state === AppleAuthentication.AppleAuthenticationCredentialState.AUTHORIZED) {
      return stored;
    }
  } catch {
    // If the check fails (e.g. offline) keep the stored id rather than signing the user out.
    return stored;
  }
  // Credential was explicitly revoked — clear it so the user is prompted again.
  try {
    await SecureStore.deleteItemAsync(APPLE_USER_KEY);
  } catch {
    // ignore
  }
  return null;
}

export async function clearAppleCredential(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(APPLE_USER_KEY);
  } catch {
    // ignore
  }
}
