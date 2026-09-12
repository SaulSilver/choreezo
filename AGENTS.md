# AGENTS.md

Repository instructions for coding agents working in **Choreezo**.

The goal is to ship the smallest complete change that preserves existing behavior, data compatibility, and user state.

This file is the fast operating guide. Read [`RULES.md`](RULES.md) before editing. It contains the non-negotiable correctness rules and verification matrix.

## 1. Start here

Before changing code:

1. Read the user's request and inspect `git status --short`.
2. Read the target file, the closest source-of-truth file below, and at least one similar consumer or implementation.
3. Search for all references to any type, function, storage key, route, persisted field, or Firestore path you intend to change.
4. For scheduling, week calculation, assignment generation, persisted schemas, or shared algorithms, search both the client and `functions/` implementations before editing.
5. State assumptions only when they affect behavior. Ask a question only when a missing answer could produce materially different or destructive work.
6. Make a surgical change. Do not mix feature work with unrelated cleanup or refactoring.

Do not scan the whole repository by default, but follow the dependency chain as far as needed to understand the requested behavior safely.

Never overwrite, revert, or reformat unrelated user changes in a dirty worktree.

## 2. Fast repository map

| Concern                              | Source of truth                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------- |
| App entry and root flow              | `App.tsx`, `src/navigation/index.tsx`                                           |
| Domain contracts                     | `src/models/index.ts`                                                           |
| Navigation params                    | `src/navigation/AppNavigator.tsx`                                               |
| Firestore access                     | `src/services/*.ts`                                                             |
| Zustand state and persistence wiring | `src/store/*Store.ts`                                                           |
| Screens and UI orchestration         | `src/screens/*.tsx`                                                             |
| Shared date/week behavior            | `src/utils/dateUtils.ts`                                                        |
| Firestore timestamps                 | `src/utils/timestamps.ts`                                                       |
| Scheduling behavior                  | `src/utils/scheduling.ts`, `functions/src/index.ts`                             |
| Firestore authorization              | `firestore.rules`                                                               |
| Expo/native configuration            | `app.json`, `eas.json`                                                          |
| Server build and scheduled jobs      | `functions/package.json`, `functions/src/index.ts`                              |
| Tests                                | inspect the nearest existing test file or test pattern for the changed behavior |

For a normal scoped task, start with the target, the relevant source of truth, and one representative caller. Expand discovery when the behavior crosses persistence, navigation, scheduling, shared state, server logic, or other boundaries.

## 3. Architecture boundaries

* **Models define domain and persisted contracts.** When a persisted domain shape changes, update its model and all producers and consumers in the same change.
* **Services own Firestore I/O.** Collection paths, queries, batches, transactions, `setDoc`, and `updateDoc` belong in `src/services/*`.
* **Stores own shared client state.** Zustand transitions, cached views, derived shared state, and AsyncStorage wiring belong in `src/store/*Store.ts`.
* **Screens orchestrate UI.** Screens may invoke store actions or focused service operations, and must render loading, empty, and error states. Do not duplicate business or state-transition logic inside screens.
* **Utilities own pure reusable logic.** Keep date formatting, week arithmetic, scheduling, metadata construction, and other reusable calculations out of screens.
* **Cloud Functions are a separate runtime.** If a contract or algorithm is duplicated in `functions/src/index.ts`, update and verify both runtimes together.
* **Firestore rules are part of the feature boundary.** If a data-access change affects who can read or write a document, inspect and update `firestore.rules` as part of the same task.

Prefer extending an existing model, service, store, component, or utility over creating a parallel abstraction.

## 4. Project invariants

Preserve these unless the user explicitly requests a migration or behavior change:

* Apartment data lives under `apartments/{apartmentId}`. Chores and assignments are subcollections. User documents live at `users/{userId}`.
* Persisted creates use `buildCreateMetadata`.
* Persisted updates use `buildUpdateMetadata`.
* `createdAt` is immutable.
* Assignment `userId` is `string | null`. `null` means unassigned.
* Assignment documents retain `manuallyAssigned` for backward compatibility.
* Seeding creates missing slots and must never overwrite an existing claim.
* Invite-code comparisons are normalized to uppercase when joining apartments.
* Week keys use the ISO week-year and ISO week as `year * 100 + week`.
* Client and server week calculations must agree, especially around late December and early January.
* Persisted profile key: `choreezo_profile`.
* Persisted settings key: `settings`.
* Reads of persisted local data must tolerate older records with missing optional fields.
* Navigation calls and screen props use the typed param lists in `src/navigation/AppNavigator.tsx`.
* When multiple Firestore documents must change as one logical operation, use an existing transaction or batch pattern where possible.
* Do not introduce partial multi-document update states unless the existing behavior explicitly permits them.
* Existing persisted documents must remain readable unless the user explicitly requests a migration.
* New optional persisted fields must have a safe fallback for older records.
* Do not silently change collection paths, document IDs, storage keys, or persisted field meaning.

## 5. Implementation workflow

### Discover

* Use `rg` and `rg --files` for focused searches.
* Check call sites before changing an exported API.
* Check both writers and readers before changing persisted data.
* Check both client and Cloud Functions implementations when logic may exist in both runtimes.
* Check Firestore rules when changing document access patterns.
* For a bug fix, identify the failing state or code path before editing.
* Inspect the nearest existing test or verification pattern before deciding how to validate the change.

### Implement

* Keep the diff limited to the requested behavior.
* Reuse nearby naming, error handling, state management, and UI patterns.
* Preserve null, empty, loading, retry, and failure behavior.
* Update all denormalized, cached, or persisted views of changed state.
* Use transactions or batches when multiple Firestore writes must remain consistent.
* Keep compatibility handling close to the boundary where older data is read.
* Comment only to explain a non-obvious invariant, compatibility constraint, or intentionally unusual behavior.
* Do not add dependencies, migrations, generated files, or broad configuration changes unless the task requires them.
* Do not move logic between architectural layers unless the requested change requires it.
* Do not rename unrelated code while implementing a feature or bug fix.

### Verify

* Re-read the changed diff.
* Trace the primary success path.
* Trace relevant empty, null, failure, and retry paths.
* For persisted data changes, verify both old and new records remain safe to read.
* For shared algorithms, verify client and server behavior remain aligned.
* Run the narrowest relevant checks from `RULES.md`.
* Run targeted tests when a nearby test pattern exists.
* Treat warnings, skipped checks, unavailable tooling, and unverified behavior honestly. Do not describe them as passing.
* Do not deploy, publish, submit builds, modify remote data, or run destructive commands unless explicitly requested.

### Report

Finish with:

* what changed and the user-visible result;
* which checks ran and their result;
* any remaining risk, manual check, or known limitation.

Do not narrate routine exploration or repeat unchanged context.

## 6. Data and compatibility rules

When changing persisted or shared data:

* Search every writer and reader of the field.
* Preserve existing document IDs and collection paths unless migration is explicitly requested.
* Prefer additive schema changes over destructive ones.
* New fields should be optional by default unless every existing record can be safely migrated.
* Older local or Firestore records must remain readable.
* Do not reinterpret an existing field with a new meaning.
* If a field is denormalized in multiple places, update every relevant copy in the same logical operation.
* If compatibility requires retaining a legacy field such as `manuallyAssigned`, keep writing or reading it according to the existing contract.
* Do not delete old data as part of cleanup unless the user explicitly requests a migration or removal.

## 7. Firestore rules and remote behavior

When changing Firestore behavior:

* Keep raw Firestore access inside services.
* Inspect `firestore.rules` when introducing new document paths, fields used for authorization, or access patterns.
* Prefer existing query and batch patterns over new one-off approaches.
* Avoid extra reads and writes when the same result can be achieved through existing cached or loaded state.
* Do not weaken authorization rules to make a client implementation easier.
* Do not deploy rules, functions, indexes, or application builds unless explicitly requested.
* Do not modify production or remote Firestore data unless explicitly requested.

## 8. Client and server parity

Some Choreezo behavior exists in both the Expo client and Cloud Functions runtime.

For logic involving:

* ISO week calculation;
* assignment generation;
* scheduling;
* timestamps;
* persisted assignment contracts;
* chore generation;

search both runtimes before editing.

If the same logical rule exists in both places, either:

1. update both implementations in the same change; or
2. document why only one runtime should change.

Do not assume equivalent-looking date logic behaves the same across year boundaries. Verify late December and early January cases explicitly when week behavior changes.

## 9. UI behavior

When changing screens or components:

* Preserve existing loading, empty, success, and error states.
* Do not hide failures silently unless the existing UX intentionally does so.
* Reuse shared components and existing interaction patterns when available.
* Keep domain and persistence logic outside screen components.
* Keep navigation parameters typed.
* Avoid introducing local state that duplicates existing Zustand state without a clear reason.
* Do not reset persisted or shared user state simply to simplify a UI change.

## 10. Testing and verification scope

Prefer the smallest verification set that gives confidence in the changed behavior.

Examples:

* Pure utility change: run the relevant utility tests and typecheck.
* Store change: verify store tests or closest state-flow tests, plus typecheck.
* Firestore service change: verify callers, data contracts, relevant tests, and rules if access semantics changed.
* Navigation change: typecheck all route params and inspect affected navigation callers.
* Scheduling or week change: verify both client and server implementations and boundary dates.
* Cloud Function change: run the functions-specific checks from `RULES.md`.
* Expo/native config change: verify the relevant config and build assumptions without submitting or deploying a build.

Do not run broad, expensive checks by default when a narrower relevant check is sufficient. Run broader verification when the change crosses multiple boundaries or the narrow checks do not provide enough confidence.

## 11. Stop conditions

Pause and ask before proceeding when:

* the requested behavior conflicts with existing persisted data and no safe compatibility or migration behavior can be inferred;
* a destructive operation or remote deployment is required but not requested;
* credentials, production access, or an irreversible external action is needed;
* unrelated user edits overlap the exact lines that must be changed and cannot be safely preserved;
* two materially different product behaviors are both plausible and choosing one could affect user data or existing claims.

Otherwise, make the safest reasonable assumption, document it if material, and complete the task.

## 12. Instruction precedence

Follow:

1. system and tool safety requirements;
2. the user's explicit request;
3. the nearest applicable `AGENTS.md`;
4. `RULES.md`;
5. existing repository conventions.

If the user's request intentionally requires deviating from a repository rule, follow the request when safe and call out the deviation in the final response.
