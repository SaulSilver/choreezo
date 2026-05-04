import { create } from 'zustand';
import { Apartment, User, Chore } from '../models';

interface ApartmentState {
  apartment: Apartment | null;
  members: User[];
  chores: Chore[];
  isLoading: boolean;
  error: string | null;
  setApartment: (apartment: Apartment | null) => void;
  setMembers: (members: User[]) => void;
  setChores: (chores: Chore[]) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useApartmentStore = create<ApartmentState>((set) => ({
  apartment: null,
  members: [],
  chores: [],
  isLoading: false,
  error: null,
  setApartment: (apartment) => set({ apartment }),
  setMembers: (members) => set({ members }),
  setChores: (chores) => set({ chores }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
