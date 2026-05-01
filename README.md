# # ChoreShare 🏠

A production-ready iOS mobile app for fairly distributing household chores among roommates. Built with React Native (Expo) and TypeScript.

## Features

- **Apple Sign In** – Secure authentication via Sign in with Apple
- **Apartment Management** – Create or join apartments with a 6-character invite code
- **Weekly Schedule** – Auto-generated chore assignments with a 7-day day-picker view
- **My Chores** – Personal view of all assigned chores for the week
- **Edit & Swap** – Reassign chores to any roommate or swap with another assignment
- **Push Notifications** – Daily reminders and weekly summaries via Expo Push Notifications
- **Cloud Functions** – Scheduled Firebase Cloud Functions for auto-generation and notifications

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native + Expo SDK 54 |
| Language | TypeScript |
| State Management | Zustand |
| Navigation | React Navigation (Stack + Bottom Tabs) |
| Backend | Firebase (Auth, Firestore) |
| Notifications | Expo Push Notifications + Firebase Cloud Messaging |
| Cloud Functions | Firebase Functions v4 (Node 18) |
| Date Utilities | date-fns |
| Storage | AsyncStorage (settings), expo-secure-store |

## Project Structure

```
choreezo/
├── App.tsx                         # App entry point
├── app.json                        # Expo configuration
├── src/
│   ├── models/index.ts             # TypeScript interfaces
│   ├── services/
│   │   ├── firebase.ts             # Firebase initialization
│   │   ├── auth.ts                 # Apple Sign In + user management
│   │   ├── apartments.ts           # Apartment CRUD
│   │   ├── chores.ts               # Chore management
│   │   ├── assignments.ts          # Assignment generation & updates
│   │   └── notifications.ts        # Push notification registration
│   ├── store/
│   │   ├── authStore.ts            # Auth state (Zustand)
│   │   ├── apartmentStore.ts       # Apartment/members/chores state
│   │   ├── assignmentStore.ts      # Assignments state
│   │   └── settingsStore.ts        # Notification settings (persisted)
│   ├── utils/
│   │   ├── dateUtils.ts            # date-fns helpers
│   │   ├── scheduling.ts           # Round-robin assignment algorithm
│   │   └── inviteCode.ts           # Invite code generator
│   ├── components/
│   │   ├── ChoreCard.tsx           # Chore assignment card
│   │   ├── UserAvatar.tsx          # Initials-based avatar
│   │   ├── LoadingSpinner.tsx      # Loading indicator
│   │   └── EmptyState.tsx          # Empty list placeholder
│   ├── screens/
│   │   ├── AuthScreen.tsx          # Sign in with Apple
│   │   ├── ApartmentScreen.tsx     # Create / join apartment
│   │   ├── WeeklyScheduleScreen.tsx # 7-day chore schedule
│   │   ├── MyChoresScreen.tsx      # Personal chore list
│   │   ├── EditAssignmentScreen.tsx # Reassign / swap chores
│   │   └── SettingsScreen.tsx      # Profile, invite code, notifications
│   └── navigation/
│       ├── index.tsx               # Root navigator (auth gating)
│       └── AppNavigator.tsx        # Tab + stack navigators
└── functions/
    ├── package.json
    ├── tsconfig.json
    └── src/index.ts                # Cloud Functions
```

## Getting Started

### Prerequisites

- Node.js 18+
- Expo CLI (`npm install -g expo-cli`)
- A Firebase project with Authentication and Firestore enabled
- An Apple Developer account (for Sign in with Apple)
- EAS CLI (`npm install -g eas-cli`) for building

### 1. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication → Sign-in method → Apple**
3. Enable **Firestore Database**
4. Copy your Firebase config into `src/services/firebase.ts`

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure EAS Project ID

Update `app.json` with your EAS project ID:

```json
"extra": {
  "eas": {
    "projectId": "your-actual-project-id"
  }
}
```

### 4. Run the App

```bash
npx expo start
```

> Note: Apple Sign In only works on physical iOS devices or Simulator with a valid Apple Developer account.

## Scheduling Algorithm

Chores are distributed using a round-robin algorithm that rotates assignments by day and chore index:

```
userIndex = (dayIndex + choreIndex + weekNumber) % numberOfUsers
```

This ensures each roommate gets an equal share of chores and the rotation shifts each week.

## Firebase Cloud Functions

Three scheduled functions run in the background:

| Function | Schedule | Description |
|---|---|---|
| `weeklyScheduler` | Sunday midnight UTC | Generates next week's assignments for all apartments |
| `sendDailyReminders` | 8:00 AM UTC daily | Sends push notifications for today's chores |
| `sendWeeklySummary` | Sunday 9:00 AM UTC | Sends weekly chore count summary |

### Deploy Functions

```bash
cd functions
npm install
npm run deploy
```

## Building for iOS

```bash
eas build --platform ios
```

## Environment Variables

No `.env` file is required. Firebase config is stored directly in `src/services/firebase.ts`. For production, consider using [expo-constants](https://docs.expo.dev/versions/latest/sdk/constants/) with EAS secrets.

## Firestore Data Model

```
users/{userId}
  - id, name, appleId, apartmentId, expoPushToken, notifyDaily, notifyWeekly

apartments/{apartmentId}
  - id, name, inviteCode, timezone, createdBy
  
  chores/{choreId}
    - id, name, icon

  assignments/{assignmentId}
    - id, apartmentId, userId, choreId, date, weekNumber, manuallyAssigned
```

## License

MIT
