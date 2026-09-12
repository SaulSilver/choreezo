# Backend foundation and Phase B API

This directory contains the Go backend foundation introduced in Phase A plus the authenticated Phase B domain API. It still does **not** migrate the Expo client in this ticket, but it now exposes the authenticated `/v1/*` endpoints that will become the trusted boundary for protected Firestore data.

## Migration matrix

| Existing behavior | Current implementation | Future backend responsibility |
| --- | --- | --- |
| User creation and identity | `src/store/profileStore.ts`, `src/services/auth.ts`, `src/services/apartments.ts` create local IDs or persist Apple IDs, then upsert `users/{userId}` directly from the client | Verify Firebase identity, own profile creation/upsert, and stop trusting client-provided `userId` |
| Apartment create/join/leave/delete | `src/services/apartments.ts` writes `apartments/{apartmentId}` and updates `users/{userId}.apartmentId` directly; screens call these services from `src/screens/ApartmentScreen.tsx` and `src/screens/SettingsScreen.tsx` | Transactional apartment lifecycle APIs, invite-code reservation/join validation, membership checks, and owner-only destructive operations |
| Chores | `src/services/chores.ts` seeds and reads `apartments/{apartmentId}/chores` directly from the client | Validate chore mutations and serve chore reads through authenticated APIs |
| Assignment seed/load/update/claim | `src/services/assignments.ts`, `src/utils/scheduling.ts`, `src/screens/WeeklyScheduleScreen.tsx`, and `src/screens/EditAssignmentScreen.tsx` read, seed, and update `apartments/{apartmentId}/assignments` directly | Idempotent week ensure, transactional claim/unclaim/reassign APIs, duplicate-slot handling, and assignment integrity enforcement |
| Week/date calculation | `src/utils/dateUtils.ts` on the client and `functions/src/index.ts` in Cloud Functions both derive week keys and assignment dates | Centralize week/date invariants in backend APIs and scheduled jobs while preserving `yyyy-MM-dd` dates and ISO week-year semantics |
| Notifications | `src/services/notifications.ts` obtains and stores an Expo push token on `users/{userId}`; `functions/src/index.ts` passes that Expo token to Firebase Admin Messaging, which expects a native FCM registration token, so scheduled delivery is currently incompatible | Own device token registration plus Expo Push Service delivery, receipts, retries, timezone handling, and durable idempotency |
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
cd backend
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
cd backend
PORT=18080 FIREBASE_PROJECT_ID=demo-choreezo FIRESTORE_EMULATOR_HOST=127.0.0.1:8081 go run ./cmd/api
```

Then check the API separately from the emulator:

```bash
curl http://localhost:18080/healthz
```

## OpenAPI

The OpenAPI document lives at `openapi/openapi.yaml` and documents the currently implemented `/healthz` and `/v1/*` routes.

## Profile deletion semantics

`DELETE /v1/me` intentionally preserves current application behavior instead of inventing extra destructive cleanup:

- If the user **owns** an apartment (`apartments/{id}.createdBy == uid`), the API rejects deletion with `409 apartment_owner_conflict`.
- If the user **belongs** to an apartment but does **not** own it, the API deletes only the user's Firestore document plus backend-owned device-registration subcollection data. Because apartment membership is derived from `users.where(apartmentId == apartmentId)`, that user disappears from membership queries, but the apartment document, invite mapping, chores, and assignments remain untouched.
- The API does **not** delete the Firebase Authentication identity. It only deletes Firestore data owned by this backend.

## Device registration

Phase B stores per-device Expo tokens under `users/{uid}/devices/{deviceId}` and mirrors the most recent enabled token onto the legacy `users/{uid}.expoPushToken` field for compatibility with existing records and later migration phases.

## Docker

Build the backend image locally:

```bash
cd backend
docker build -t choreezo-backend .
```
