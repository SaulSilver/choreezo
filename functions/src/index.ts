import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp();

const db = admin.firestore();

interface Assignment {
  id: string;
  apartmentId: string;
  userId: string;
  choreId: string;
  date: string;
  weekNumber: number;
  manuallyAssigned: boolean;
}

interface User {
  id: string;
  name: string;
  expoPushToken?: string;
  notifyDaily: boolean;
  notifyWeekly: boolean;
  apartmentId: string | null;
}

interface Apartment {
  id: string;
  name: string;
  inviteCode: string;
  timezone: string;
  createdBy: string;
}

interface Chore {
  id: string;
  name: string;
  icon?: string;
}

/** Returns year*100 + ISO week number, matching the client-side getWeekNumber() in dateUtils.ts */
function getWeekNumber(date: Date): number {
  // ISO week: week containing first Thursday of the year is week 1
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return d.getUTCFullYear() * 100 + weekNo;
}

function generateAssignments(
  users: User[],
  chores: Chore[],
  weekDates: Date[],
  weekOffset: number
): Omit<Assignment, 'id' | 'apartmentId'>[] {
  const assignments: Omit<Assignment, 'id' | 'apartmentId'>[] = [];
  weekDates.forEach((date, dayIndex) => {
    const dateStr = date.toISOString().split('T')[0];
    chores.forEach((chore, choreIndex) => {
      const userIndex = (dayIndex + choreIndex + weekOffset) % users.length;
      assignments.push({
        userId: users[userIndex].id,
        choreId: chore.id,
        date: dateStr,
        weekNumber: weekOffset,
        manuallyAssigned: false,
      });
    });
  });
  return assignments;
}

async function sendPushNotification(token: string, title: string, body: string): Promise<void> {
  const message = {
    notification: { title, body },
    token,
  };
  try {
    await admin.messaging().send(message);
  } catch (err) {
    console.error('Failed to send notification to token:', token, err);
  }
}

export const weeklyScheduler = functions.pubsub
  .schedule('0 0 * * 0')
  .timeZone('UTC')
  .onRun(async (_context) => {
    const now = new Date();
    const nextWeekDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekNumber = getWeekNumber(nextWeekDate);

    const apartmentsSnap = await db.collection('apartments').get();

    for (const aptDoc of apartmentsSnap.docs) {
      const apartment = { id: aptDoc.id, ...aptDoc.data() } as Apartment;

      const [usersSnap, choresSnap, existingSnap] = await Promise.all([
        db.collection('users').where('apartmentId', '==', apartment.id).get(),
        db.collection('apartments').doc(apartment.id).collection('chores').get(),
        db
          .collection('apartments')
          .doc(apartment.id)
          .collection('assignments')
          .where('weekNumber', '==', weekNumber)
          .get(),
      ]);

      if (!existingSnap.empty) continue;

      const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as User));
      const chores = choresSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Chore));

      if (users.length === 0 || chores.length === 0) continue;

      const startOfWeek = new Date(nextWeekDate);
      startOfWeek.setDate(nextWeekDate.getDate() - nextWeekDate.getDay() + 1);
      const weekDates = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        return d;
      });

      const newAssignments = generateAssignments(users, chores, weekDates, weekNumber);

      const batch = db.batch();
      for (const a of newAssignments) {
        const ref = db
          .collection('apartments')
          .doc(apartment.id)
          .collection('assignments')
          .doc();
        batch.set(ref, { ...a, id: ref.id, apartmentId: apartment.id, createdAt: admin.firestore.FieldValue.serverTimestamp() });
      }
      await batch.commit();
      console.log(`Generated ${newAssignments.length} assignments for apartment ${apartment.id}`);
    }
  });

export const sendDailyReminders = functions.pubsub
  .schedule('0 8 * * *')
  .timeZone('UTC')
  .onRun(async (_context) => {
    const today = new Date().toISOString().split('T')[0];

    const usersSnap = await db.collection('users').where('notifyDaily', '==', true).get();

    for (const userDoc of usersSnap.docs) {
      const user = { id: userDoc.id, ...userDoc.data() } as User;
      if (!user.expoPushToken || !user.apartmentId) continue;

      const assignmentsSnap = await db
        .collection('apartments')
        .doc(user.apartmentId)
        .collection('assignments')
        .where('userId', '==', user.id)
        .where('date', '==', today)
        .get();

      if (assignmentsSnap.empty) continue;

      const choreNames: string[] = [];
      for (const aDoc of assignmentsSnap.docs) {
        const a = aDoc.data() as Assignment;
        const choreDoc = await db
          .collection('apartments')
          .doc(user.apartmentId)
          .collection('chores')
          .doc(a.choreId)
          .get();
        if (choreDoc.exists) {
          choreNames.push((choreDoc.data() as Chore).name);
        }
      }

      await sendPushNotification(
        user.expoPushToken,
        "Today's Chores 🏠",
        `You have ${choreNames.length} chore(s) today: ${choreNames.join(', ')}`
      );
    }
  });

export const sendWeeklySummary = functions.pubsub
  .schedule('0 9 * * 0')
  .timeZone('UTC')
  .onRun(async (_context) => {
    const weekNumber = getWeekNumber(new Date());
    const usersSnap = await db.collection('users').where('notifyWeekly', '==', true).get();

    for (const userDoc of usersSnap.docs) {
      const user = { id: userDoc.id, ...userDoc.data() } as User;
      if (!user.expoPushToken || !user.apartmentId) continue;

      const assignmentsSnap = await db
        .collection('apartments')
        .doc(user.apartmentId)
        .collection('assignments')
        .where('userId', '==', user.id)
        .where('weekNumber', '==', weekNumber)
        .get();

      const count = assignmentsSnap.size;
      if (count === 0) continue;

      await sendPushNotification(
        user.expoPushToken,
        "Weekly Chore Summary 📅",
        `You have ${count} chore(s) this week. Stay on top of them!`
      );
    }
  });
