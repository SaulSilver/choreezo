import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';

function uuidv4(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

interface ProfileState {
  userId: string | null;
  name: string | null;
  apartmentId: string | null;
  isLoading: boolean;
  setProfile: (userId: string, name: string) => Promise<void>;
  setApartmentId: (apartmentId: string | null) => Promise<void>;
  loadProfile: () => Promise<void>;
  clearProfile: () => Promise<void>;
}

const STORAGE_KEY = 'choreshare_profile';

export const useProfileStore = create<ProfileState>((set, get) => ({
  userId: null,
  name: null,
  apartmentId: null,
  isLoading: true,

  setProfile: async (userId, name) => {
    const apartmentId = get().apartmentId;
    const data = { userId, name, apartmentId };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    set({ userId, name });
  },

  setApartmentId: async (apartmentId) => {
    const { userId, name } = get();
    if (userId && name) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ userId, name, apartmentId }));
    }
    set({ apartmentId });
  },

  loadProfile: async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const { userId, name, apartmentId } = JSON.parse(raw);
        set({ userId, name, apartmentId: apartmentId ?? null, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  clearProfile: async () => {
    await AsyncStorage.removeItem(STORAGE_KEY);
    set({ userId: null, name: null, apartmentId: null });
  },
}));

export function generateUserId(): string {
  return uuidv4();
}
