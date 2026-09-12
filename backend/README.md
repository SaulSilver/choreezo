# Backend Phase A foundation

This directory contains the Go backend foundation introduced in Phase A. It does **not** migrate any Expo client Firestore calls yet.

## Migration matrix

| Existing behavior | Current implementation | Future backend responsibility |
| --- | --- | --- |
| User creation and identity | `src/store/profileStore.ts`, `src/services/auth.ts`, `src/services/apartments.ts` create local IDs or persist Apple IDs, then upsert `users/{userId}` directly from the client | Verify Firebase identity, own profile creation/upsert, and stop trusting client-provided `userId` |
| Apartment create/join/leave/delete | `src/services/apartments.ts` writes `apartments/{apartmentId}` and updates `users/{userId}.apartmentId` directly; screens call these services from `src/screens/ApartmentScreen.tsx` and `src/screens/SettingsScreen.tsx` | Transactional apartment lifecycle APIs, invite-code reservation/join validation, membership checks, and owner-only destructive operations |
| Chores | `src/services/chores.ts` seeds and reads `apartments/{apartmentId}/chores` directly from the client | Validate chore mutations and serve chore reads through authenticated APIs |
| Assignment seed/load/update/claim | `src/services/assignments.ts`, `src/utils/scheduling.ts`, `src/screens/WeeklyScheduleScreen.tsx`, and `src/screens/EditAssignmentScreen.tsx` read, seed, and update `apartments/{apartmentId}/assignments` directly | Idempotent week ensure, transactional claim/unclaim/reassign APIs, duplicate-slot handling, and assignment integrity enforcement |
| Week/date calculation | `src/utils/dateUtils.ts` on the client and `functions/src/index.ts` in Cloud Functions both derive week keys and assignment dates | Centralize week/date invariants in backend APIs and scheduled jobs while preserving `yyyy-MM-dd` dates and ISO week-year semantics |
| Notifications | `src/services/notifications.ts` registers Expo push tokens directly on user docs; `functions/src/index.ts` sends scheduled reminders and summaries | Own device token registration plus Expo push delivery, receipts, retries, timezone handling, and durable idempotency |
| Scheduled backend work | `functions/src/index.ts` exports `weeklyScheduler`, `sendDailyReminders`, and `sendWeeklySummary` | Replace those TypeScript Firebase functions with protected Go internal job endpoints in later phases |

## Repository findings

- The app currently uses Firestore directly from the Expo client and currently does **not** rely on Firebase Authentication for normal reads/writes.
- User identity is either a locally generated ID (`generateUserId`) or a persisted Apple identifier returned by `src/services/auth.ts`.
- Apartment join normalizes invite codes to uppercase on the client before querying Firestore.
- Assignment documents keep `userId: string | null` and `manuallyAssigned` for compatibility.
- The client and Cloud Functions duplicate week/date logic today; `RULES.md` already flags year-boundary parity risk.
- Push notifications currently store `expoPushToken` on `users/{userId}` and scheduled delivery still lives in `functions/src/index.ts`.
- `firestore.rules` is intentionally not changed in this phase and is marked "Not working" in the repository.

## Local development

### Prerequisites

- Go 1.25+
- A Firebase project ID for local configuration
- Optional: Firebase emulator suite for Firestore testing

### Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `FIREBASE_PROJECT_ID` or `GOOGLE_CLOUD_PROJECT` | Yes | Firebase project ID used for Admin and Firestore initialization |
| `PORT` | No | HTTP port for the API server (default `8080`) |
| `LOG_LEVEL` | No | One of `debug`, `info`, `warn`, `error` |
| `GOOGLE_APPLICATION_CREDENTIALS` | No | Service-account JSON path when not using Application Default Credentials |
| `FIRESTORE_EMULATOR_HOST` | No | Firestore emulator host, e.g. `127.0.0.1:8081` |

### Run locally

```bash
cd /home/runner/work/choreezo/choreezo/backend
go run ./cmd/api
```

Health check:

```bash
curl http://localhost:8080/healthz
```

### Firestore emulator

The backend respects the standard `FIRESTORE_EMULATOR_HOST` environment variable.

Example workflow:

```bash
firebase emulators:start --only firestore
```

In another terminal:

```bash
cd /home/runner/work/choreezo/choreezo/backend
FIREBASE_PROJECT_ID=demo-choreezo FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 go run ./cmd/api
```

Use a non-conflicting port if your emulator is already on `8080`, for example:

```bash
cd /home/runner/work/choreezo/choreezo/backend
PORT=8081 FIREBASE_PROJECT_ID=demo-choreezo FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 go run ./cmd/api
```

## OpenAPI

The Phase A skeleton lives at `openapi/openapi.yaml` and currently documents `/healthz` plus placeholder protected path shapes for future `/v1/*` and `/internal/*` work.

## Docker

Build the backend image locally:

```bash
cd /home/runner/work/choreezo/choreezo/backend
docker build -t choreezo-backend .
```
