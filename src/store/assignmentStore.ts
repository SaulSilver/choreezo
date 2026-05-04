import { create } from 'zustand';
import { Assignment } from '../models';

interface AssignmentState {
  assignments: Assignment[];
  currentWeek: number;
  isLoading: boolean;
  error: string | null;
  setAssignments: (assignments: Assignment[]) => void;
  addAssignments: (assignments: Assignment[]) => void;
  updateAssignment: (id: string, updates: Partial<Assignment>) => void;
  setCurrentWeek: (week: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAssignmentStore = create<AssignmentState>((set) => ({
  assignments: [],
  currentWeek: 0,
  isLoading: false,
  error: null,
  setAssignments: (assignments) => set({ assignments }),
  addAssignments: (newAssignments) =>
    set((state) => ({
      assignments: [...state.assignments, ...newAssignments],
    })),
  updateAssignment: (id, updates) =>
    set((state) => ({
      assignments: state.assignments.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      ),
    })),
  setCurrentWeek: (currentWeek) => set({ currentWeek }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
