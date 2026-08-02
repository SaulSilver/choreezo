import { create } from 'zustand';
import { Assignment } from '../models';

interface AssignmentState {
  assignments: Assignment[];
  assignmentsByWeek: Record<number, Assignment[]>;
  currentWeek: number;
  isLoading: boolean;
  error: string | null;
  setAssignments: (assignments: Assignment[]) => void;
  setWeekAssignments: (weekNumber: number, assignments: Assignment[]) => void;
  addAssignments: (assignments: Assignment[]) => void;
  updateAssignment: (id: string, updates: Partial<Assignment>) => void;
  setCurrentWeek: (week: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAssignmentStore = create<AssignmentState>((set) => ({
  assignments: [],
  assignmentsByWeek: {},
  currentWeek: 0,
  isLoading: false,
  error: null,
  setAssignments: (assignments) =>
    set((state) => {
      if (state.currentWeek === 0) {
        return { assignments };
      }
      return {
        assignments,
        assignmentsByWeek: {
          ...state.assignmentsByWeek,
          [state.currentWeek]: assignments,
        },
      };
    }),
  setWeekAssignments: (weekNumber, assignments) =>
    set((state) => ({
      assignments: state.currentWeek === weekNumber ? assignments : state.assignments,
      assignmentsByWeek: {
        ...state.assignmentsByWeek,
        [weekNumber]: assignments,
      },
    })),
  addAssignments: (newAssignments) =>
    set((state) => ({
      assignments: [...state.assignments, ...newAssignments],
    })),
  updateAssignment: (id, updates) =>
    set((state) => {
      const nextAssignments = state.assignments.map((a) =>
        a.id === id ? { ...a, ...updates } : a
      );
      const nextAssignmentsByWeek = Object.fromEntries(
        Object.entries(state.assignmentsByWeek).map(([week, weekAssignments]) => [
          Number(week),
          weekAssignments.map((a) => (a.id === id ? { ...a, ...updates } : a)),
        ])
      );

      return {
        assignments: nextAssignments,
        assignmentsByWeek: nextAssignmentsByWeek,
      };
    }),
  setCurrentWeek: (currentWeek) =>
    set((state) => ({
      currentWeek,
      assignments: state.assignmentsByWeek[currentWeek] ?? [],
    })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
