import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  signInWithApple as appleSignIn,
  clearAppleCredential,
} from "../services/auth";

function uuidv4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type AuthProvider = "local" | "apple";

interface ProfileState {
  userId: string | null;
  name: string | null;
  email: string | null;
  authProvider: AuthProvider | null;
  apartmentId: string | null;
  isLoading: boolean;
  setProfile: (userId: string, name: string) => Promise<void>;
  signInWithApple: () => Promise<void>;
  setApartmentId: (apartmentId: string | null) => Promise<void>;
  loadProfile: () => Promise<void>;
  clearProfile: () => Promise<void>;
}

const STORAGE_KEY = "choreezo_profile";

interface PersistedProfile {
  userId: string | null;
  name: string | null;
  apartmentId: string | null;
  email?: string | null;
  authProvider?: AuthProvider | null;
}

async function persist(data: PersistedProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  userId: null,
  name: null,
  email: null,
  authProvider: null,
  apartmentId: null,
  isLoading: true,

  setProfile: async (userId, name) => {
    const { apartmentId, email, authProvider } = get();
    const provider: AuthProvider = authProvider ?? "local";
    await persist({ userId, name, apartmentId, email, authProvider: provider });
    set({ userId, name, authProvider: provider });
  },

  signInWithApple: async () => {
    const result = await appleSignIn();
    const previous = get();
    // Defense in depth: auth.ts already falls back to the Firestore record for
    // returning users on a new device. This local fallback covers the
    // same-device case where Apple sends no name/email AND no Firestore record
    // exists yet (e.g. user hasn't joined an apartment).
    const name = result.name ?? previous.name ?? null;
    const email = result.email ?? previous.email ?? null;
    await persist({
      userId: result.userId,
      name,
      apartmentId: previous.apartmentId,
      email,
      authProvider: "apple",
    });
    set({
      userId: result.userId,
      name,
      email,
      authProvider: "apple",
    });
  },

  setApartmentId: async (apartmentId) => {
    const { userId, name, email, authProvider } = get();
    if (userId && name) {
      await persist({ userId, name, apartmentId, email, authProvider });
    }
    set({ apartmentId });
  },

  loadProfile: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedProfile;
        set({
          userId: parsed.userId,
          name: parsed.name,
          apartmentId: parsed.apartmentId ?? null,
          email: parsed.email ?? null,
          authProvider: parsed.authProvider ?? "local",
          isLoading: false,
        });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  clearProfile: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    await clearAppleCredential();
    set({
      userId: null,
      name: null,
      email: null,
      authProvider: null,
      apartmentId: null,
    });
  },
}));

export function generateUserId(): string {
  return Math.random().toString(36).substring(2, 15);
  // return uuidv4();
}
