import { Timestamp } from 'firebase/firestore';

export interface User {
  id: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  name: string;
  apartmentId: string | null;
  expoPushToken?: string;
  notifyDaily: boolean;
  notifyWeekly: boolean;
}

export interface Apartment {
  id: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  name: string;
  inviteCode: string;
  timezone: string;
  createdBy: string;
}

export interface Chore {
  id: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  name: string;
  icon?: string;
}

export interface Assignment {
  id: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
  apartmentId: string;
  /** ID of the user who claimed the chore, or `null` if the chore is unassigned. */
  userId: string | null;
  choreId: string;
  date: string; // ISO string
  weekNumber: number;
  /**
   * Retained for backward compatibility with existing Firestore documents.
   * All assignments are now created unassigned and claimed manually, so this
   * flag is no longer used to drive scheduling decisions.
   */
  manuallyAssigned: boolean;
}
