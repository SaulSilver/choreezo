export interface User {
  id: string;
  name: string;
  appleId: string;
  apartmentId: string | null;
  expoPushToken?: string;
  notifyDaily: boolean;
  notifyWeekly: boolean;
}

export interface Apartment {
  id: string;
  name: string;
  inviteCode: string;
  timezone: string;
  createdBy: string;
}

export interface Chore {
  id: string;
  name: string;
  icon?: string;
}

export interface Assignment {
  id: string;
  apartmentId: string;
  userId: string;
  choreId: string;
  date: string; // ISO string
  weekNumber: number;
  manuallyAssigned: boolean;
}
