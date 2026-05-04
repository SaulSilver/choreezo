import {
  startOfWeek,
  addDays,
  format,
  getISOWeek,
  getYear,
  parseISO,
  isToday,
  isSameDay,
} from 'date-fns';

export function getWeekNumber(date: Date = new Date()): number {
  const year = getYear(date);
  const week = getISOWeek(date);
  return year * 100 + week;
}

export function getWeekDates(weekNumber: number): Date[] {
  const year = Math.floor(weekNumber / 100);
  const week = weekNumber % 100;

  const jan4 = new Date(year, 0, 4);
  const startOfWeek1 = startOfWeek(jan4, { weekStartsOn: 1 });
  const startOfTargetWeek = addDays(startOfWeek1, (week - 1) * 7);

  return Array.from({ length: 7 }, (_, i) => addDays(startOfTargetWeek, i));
}

export function getCurrentWeekDates(): Date[] {
  const today = new Date();
  const start = startOfWeek(today, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function formatDisplayDate(date: Date): string {
  return format(date, 'EEE, MMM d');
}

export function formatDayName(date: Date): string {
  return format(date, 'EEE');
}

export function formatDayNumber(date: Date): string {
  return format(date, 'd');
}

export function parseDate(dateStr: string): Date {
  return parseISO(dateStr);
}

export function isTodayDate(date: Date): boolean {
  return isToday(date);
}

export function isSameDayDate(date1: Date, date2: Date): boolean {
  return isSameDay(date1, date2);
}
