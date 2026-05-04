# ChoreShare 🏠

A mobile app for fairly distributing household chores among roommates. Built with React Native (Expo) and TypeScript.

## Features

- **Profile Setup** – Sign in with Apple on iOS, or enter your name once and a local UUID is generated for you
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
| Backend | Firebase (Firestore) |
| Notifications | Expo Push Notifications |
| Cloud Functions | Firebase Functions v4 (Node 18) |
| Date Utilities | date-fns |
| Storage | AsyncStorage (profile + settings), expo-secure-store |
| Auth | Sign in with Apple (`expo-apple-authentication`) on iOS, local profile fallback |

## Project Structure

```
choreezo/
├── App.tsx                         # App entry point
├── app.json                        # Expo configuration
├── src/
│   ├── models/index.ts             # TypeScript interfaces
│   ├── services/
│   │   ├── firebase.ts             # Firebase initialization (Firestore only)
│   │   ├── apartments.ts           # Apartment CRUD + user doc writes
│   │   ├── chores.ts               # Chore management
│   │   ├── assignments.ts          # Assignment generation & updates
│   │   └── notifications.ts        # Push notification registration
│   ├── store/
│   │   ├── profileStore.ts         # Local profile: userId + name (AsyncStorage)
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
│   │   ├── ProfileSetupScreen.tsx  # Name entry (first launch)
│   │   ├── ApartmentScreen.tsx     # Create / join apartment
│   │   ├── WeeklyScheduleScreen.tsx # 7-day chore schedule
│   │   ├── MyChoresScreen.tsx      # Personal chore list
│   │   ├── EditAssignmentScreen.tsx # Reassign / swap chores
│   │   └── SettingsScreen.tsx      # Profile, invite code, notifications
│   └── navigation/
│       ├── index.tsx               # Root navigator (profile → apartment → app)
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
- A Firebase project with Firestore enabled
- EAS CLI (`npm install -g eas-cli`) for building

### 1. Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Firestore Database**
3. Copy your Firebase config into `src/services/firebase.ts`

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

## Sign in with Apple

ChoreShare supports **Sign in with Apple** on iOS via [`expo-apple-authentication`](https://docs.expo.dev/versions/latest/sdk/apple-authentication/). The button appears on the first-launch / profile-setup screen on iOS devices that support the flow; the existing name-entry fallback continues to work everywhere else.

### What's already configured in this repo

- `expo-apple-authentication` is listed in `package.json`.
- `app.json` enables `ios.usesAppleSignIn: true` and registers the `expo-apple-authentication` config plugin. At prebuild / EAS build time Expo generates the `com.apple.developer.applesignin` entry in `ios/<App>/<App>.entitlements` automatically — there is no native `ios/` folder to edit by hand.
- The Apple credential's stable user identifier is persisted via `expo-secure-store` (key `choreshare_apple_user_id`) so returning users are matched to their existing Firestore `users/{userId}` document. Apple's name + email are written on the first sign-in only (Apple does not return them on subsequent sign-ins).
- Cancellation and errors are handled in `ProfileSetupScreen` — cancellation is silent, other errors surface a user-friendly alert.

### One-time maintainer setup

1. **Apple Developer portal** → *Certificates, Identifiers & Profiles* → select the App ID `com.choreshare.app` and enable the **Sign In with Apple** capability. Save.
2. Regenerate the iOS provisioning profile (EAS does this automatically on the next `eas build --platform ios`).
3. **Optional — Firebase Auth provider:** ChoreShare currently uses Firestore-only (no Firebase Auth). If you later wire Firebase Auth in, also enable the **Apple** sign-in provider under *Firebase Console → Authentication → Sign-in method* and add the Service ID + key per the [Firebase docs](https://firebase.google.com/docs/auth/ios/apple).
4. Build and run on a real device or the iOS Simulator (iOS 13+). The simulator must be signed in to an iCloud account that has Sign in with Apple enabled.

### Out of scope

Android / web Sign in with Apple, cross-provider account linking, and the account-deletion flow are tracked separately.

## Environment Variables

No `.env` file is required. Firebase config is stored directly in `src/services/firebase.ts`. For production, consider using [expo-constants](https://docs.expo.dev/versions/latest/sdk/constants/) with EAS secrets.

## Firestore Data Model

```
users/{userId}
  - id, name, apartmentId, expoPushToken, notifyDaily, notifyWeekly

apartments/{apartmentId}
  - id, name, inviteCode, timezone, createdBy
  
  chores/{choreId}
    - id, name, icon

  assignments/{assignmentId}
    - id, apartmentId, userId, choreId, date, weekNumber, manuallyAssigned
```

## License

MIT
