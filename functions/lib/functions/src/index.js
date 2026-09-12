"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendWeeklySummary = exports.sendDailyReminders = exports.weeklyScheduler = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const timestamps_1 = require("../../src/utils/timestamps");
admin.initializeApp();
const db = admin.firestore();
/** Returns year*100 + ISO week number, matching the client-side getWeekNumber() in dateUtils.ts */
function getWeekNumber(date) {
    // ISO week: week containing first Thursday of the year is week 1
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
    return d.getUTCFullYear() * 100 + weekNo;
}
function generateAssignments(chores, weekDates, weekOffset) {
    // All assignments are seeded as unassigned (userId === null) so that users
    // can manually claim the chores they want via the app UI.
    const assignments = [];
    weekDates.forEach((date) => {
        const dateStr = date.toISOString().split('T')[0];
        chores.forEach((chore) => {
            assignments.push({
                userId: null,
                choreId: chore.id,
                date: dateStr,
                weekNumber: weekOffset,
                manuallyAssigned: false,
            });
        });
    });
    return assignments;
}
async function sendPushNotification(token, title, body) {
    const message = {
        notification: { title, body },
        token,
    };
    try {
        await admin.messaging().send(message);
    }
    catch (err) {
        console.error('Failed to send notification to token:', token, err);
    }
}
exports.weeklyScheduler = functions.pubsub
    .schedule('0 0 * * 0')
    .timeZone('UTC')
    .onRun(async (_context) => {
    const now = new Date();
    const nextWeekDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekNumber = getWeekNumber(nextWeekDate);
    const apartmentsSnap = await db.collection('apartments').get();
    for (const aptDoc of apartmentsSnap.docs) {
        const apartment = Object.assign({ id: aptDoc.id }, aptDoc.data());
        const [choresSnap, existingSnap] = await Promise.all([
            db.collection('apartments').doc(apartment.id).collection('chores').get(),
            db
                .collection('apartments')
                .doc(apartment.id)
                .collection('assignments')
                .where('weekNumber', '==', weekNumber)
                .get(),
        ]);
        if (!existingSnap.empty)
            continue;
        const chores = choresSnap.docs.map((d) => (Object.assign({ id: d.id }, d.data())));
        if (chores.length === 0)
            continue;
        const startOfWeek = new Date(nextWeekDate);
        startOfWeek.setDate(nextWeekDate.getDate() - nextWeekDate.getDay() + 1);
        const weekDates = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(startOfWeek);
            d.setDate(startOfWeek.getDate() + i);
            return d;
        });
        const newAssignments = generateAssignments(chores, weekDates, weekNumber);
        const batch = db.batch();
        for (const a of newAssignments) {
            const ref = db
                .collection('apartments')
                .doc(apartment.id)
                .collection('assignments')
                .doc();
            batch.set(ref, Object.assign(Object.assign(Object.assign({}, a), { id: ref.id, apartmentId: apartment.id }), (0, timestamps_1.buildCreateMetadata)()));
        }
        await batch.commit();
        console.log(`Generated ${newAssignments.length} assignments for apartment ${apartment.id}`);
    }
});
exports.sendDailyReminders = functions.pubsub
    .schedule('0 8 * * *')
    .timeZone('UTC')
    .onRun(async (_context) => {
    const today = new Date().toISOString().split('T')[0];
    const usersSnap = await db.collection('users').where('notifyDaily', '==', true).get();
    for (const userDoc of usersSnap.docs) {
        const user = Object.assign({ id: userDoc.id }, userDoc.data());
        if (!user.expoPushToken || !user.apartmentId)
            continue;
        const assignmentsSnap = await db
            .collection('apartments')
            .doc(user.apartmentId)
            .collection('assignments')
            .where('userId', '==', user.id)
            .where('date', '==', today)
            .get();
        if (assignmentsSnap.empty)
            continue;
        const choreNames = [];
        for (const aDoc of assignmentsSnap.docs) {
            const a = aDoc.data();
            const choreDoc = await db
                .collection('apartments')
                .doc(user.apartmentId)
                .collection('chores')
                .doc(a.choreId)
                .get();
            if (choreDoc.exists) {
                choreNames.push(choreDoc.data().name);
            }
        }
        await sendPushNotification(user.expoPushToken, "Today's Chores 🏠", `You have ${choreNames.length} chore(s) today: ${choreNames.join(', ')}`);
    }
});
exports.sendWeeklySummary = functions.pubsub
    .schedule('0 9 * * 0')
    .timeZone('UTC')
    .onRun(async (_context) => {
    const weekNumber = getWeekNumber(new Date());
    const usersSnap = await db.collection('users').where('notifyWeekly', '==', true).get();
    for (const userDoc of usersSnap.docs) {
        const user = Object.assign({ id: userDoc.id }, userDoc.data());
        if (!user.expoPushToken || !user.apartmentId)
            continue;
        const assignmentsSnap = await db
            .collection('apartments')
            .doc(user.apartmentId)
            .collection('assignments')
            .where('userId', '==', user.id)
            .where('weekNumber', '==', weekNumber)
            .get();
        const count = assignmentsSnap.size;
        if (count === 0)
            continue;
        await sendPushNotification(user.expoPushToken, "Weekly Chore Summary 📅", `You have ${count} chore(s) this week. Stay on top of them!`);
    }
});
//# sourceMappingURL=index.js.map