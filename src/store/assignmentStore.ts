import { create } from 'zustand';
import { Assignment, Chore } from '../models';
import { getWeekNumber } from '../utils/dateUtils';

const CHORE_ORDER = ['Lunch', 'Dinner', 'Hoover', 'Mop', 'Dusting', 'Kitchen Cleaning'];

const sortAssignmentsForWeek = (assignments: Assignment[], chores: Chore[]): Assignment[] => {
  const choreRankById = new Map<string, number>(
    chores.map((chore) => [chore.id, CHORE_ORDER.indexOf(chore.name)])
  );

  return assignments.slice().sort((a, b) => {
    if (a.date !== b.date) {
      return a.date.localeCompare(b.date);
    }

    const rawRankA = choreRankById.get(a.choreId) ?? -1;
    const rawRankB = choreRankById.get(b.choreId) ?? -1;
    const rankA = rawRankA === -1 ? CHORE_ORDER.length : rawRankA;
    const rankB = rawRankB === -1 ? CHORE_ORDER.length : rawRankB;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return a.id.localeCompare(b.id);
  });
};

interface AssignmentState {
  assignments: Assignment[];
  assignmentsByWeek: Record<number, Assignment[]>;
  currentWeek: number;
  isLoading: boolean;
  error: string | null;
  setAssignments: (assignments: Assignment[]) => void;
  setWeekAssignments: (weekNumber: number, assignments: Assignment[], chores: Chore[]) => void;
  addAssignments: (assignments: Assignment[]) => void;
  updateAssignment: (id: string, updates: Partial<Assignment>) => void;
  setCurrentWeek: (week: number) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAssignmentStore = create<AssignmentState>((set) => ({
  assignments: [],
  assignmentsByWeek: {},
  currentWeek: getWeekNumber(),
  isLoading: false,
  error: null,
  setAssignments: (assignments) =>
    set((state) => ({
      assignments,
      assignmentsByWeek: {
        ...state.assignmentsByWeek,
        [getWeekNumber()]: assignments,
      },
    })),
  setWeekAssignments: (weekNumber, assignments, chores) =>
    set((state) => {
      const orderedAssignments = sortAssignmentsForWeek(assignments, chores);
      return {
        assignments: weekNumber === getWeekNumber() ? orderedAssignments : state.assignments,
        assignmentsByWeek: {
          ...state.assignmentsByWeek,
          [weekNumber]: orderedAssignments,
        },
      };
    }),
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
    set({ currentWeek }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
