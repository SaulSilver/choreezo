# AGENTS.md

Repository instructions for Copilot agents working in **choreezo**.  
Goal: reduce repetitive discovery, token usage, and tool churn while preserving correctness.

## Mission

1. Deliver complete, behavior-safe changes with minimal re-discovery.
2. Reuse existing patterns before introducing new abstractions.
3. Keep responses and diffs concise unless deeper explanation is needed.

## Fast-start repo map (do this instead of broad exploration)

- **Domain types (source of truth):** `src/models/index.ts`
- **Client Firestore access:** `src/services/*.ts`
- **Client state:** `src/store/*Store.ts`
- **Navigation params/types:** `src/navigation/AppNavigator.tsx`
- **Week/date logic:** `src/utils/dateUtils.ts`
- **Server scheduling/notifications:** `functions/src/index.ts`

For most tasks, start from the closest file above plus one consumer file.  
Avoid full-repo scans unless the request is explicitly cross-cutting.

## Architecture boundaries

### Mandatory

- **Services own Firestore I/O.** Keep collection paths, queries, `setDoc`/`updateDoc`, batch writes in `src/services/*`.
- **Stores own app state + persistence wiring.** Keep Zustand state transitions and AsyncStorage persistence in `src/store/*`.
- **Screens own UI orchestration.** Screens call services/stores and render loading/empty/error states.
- **Type contracts come from `src/models/index.ts`.** Extend existing interfaces there first, then propagate.
- **Metadata consistency:** use `buildCreateMetadata` / `buildUpdateMetadata` for persisted Firestore documents.

### Recommended

- Prefer extending an existing service/store over creating a new one.
- Keep Cloud Functions aligned with client data semantics (especially `weekNumber`, assignment shape, and unassigned `userId: null` flow).

## High-value conventions to reuse

### Firestore and data shape

- Apartment-scoped collections use: `apartments/{apartmentId}/chores` and `apartments/{apartmentId}/assignments`.
- User docs are top-level: `users/{userId}`.
- Assignment docs keep `manuallyAssigned` for backward compatibility.
- Invite code comparisons are uppercase when joining apartments.

### Week/date behavior

- Week key format is `year * 100 + ISO week`.
- Client and server must stay equivalent:
  - Client: `src/utils/dateUtils.ts#getWeekNumber`
  - Server: `functions/src/index.ts#getWeekNumber`

### UI/state behavior

- Loading pattern in schedule-like screens:
  - set loading true
  - fetch
  - set data or set error
  - set loading false in `finally`
- Persisted profile key: `choreezo_profile`
- Persisted settings key: `settings`

## Cost and time controls (agent workflow)

### Mandatory

1. Read only files required for the requested change; do not repeat the same reads in one task.
2. Reuse existing helpers/patterns before introducing new utilities.
3. Keep edits surgical; avoid unrelated refactors.
4. Do not re-summarize unchanged context repeatedly in chat output.

### Recommended

1. For simple scoped edits, inspect:
   - target file
   - `src/models/index.ts` (if types touched)
   - one similar file as pattern reference
2. Prefer parallel file reads/tool calls when independent.
3. Prefer short outcome-first responses.

## Edit checklist

Before finishing, confirm:

1. Types match `src/models/index.ts` and navigation params when relevant.
2. Firestore writes include metadata helpers where applicable.
3. Week/date logic remains client/server consistent.
4. Changed area still follows existing loading/error conventions.
5. Run only existing project commands relevant to touched surfaces:
   - App: `npx tsc --noEmit`
   - Functions: `cd functions && npm run build`

## Exception policy

If a request conflicts with these rules, follow the user request and note the intentional deviation in the final response.  
Do not apply these rules rigidly when they would block correctness.

