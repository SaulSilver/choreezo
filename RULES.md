# RULES.md

Detailed correctness rules for changes to **Choreezo**.

These rules supplement [`AGENTS.md`](AGENTS.md). Agents must read both before editing.

## Correctness contract

A change is complete only when all of the following are true:

1. The requested behavior works on the primary success path.
2. Loading, empty, null, cancellation, retry, and error paths remain valid where relevant.
3. Persisted and public contracts remain compatible, or an explicit migration is included.
4. Every affected state representation, consumer, and execution environment is updated consistently.
5. Relevant local checks pass, or the exact unverified surface is reported.
6. The diff contains no unrelated edits, secrets, generated noise, temporary debug code, or accidental formatting churn.

## Mandatory rules

### Scope and evidence

* Do not edit before locating the behavior's source of truth and at least one call site, consumer, or implementation.
* Do not guess that a field, export, route, storage key, or document path is unused. Search for it.
* Follow the dependency chain as far as needed to understand the requested behavior safely.
* Do not fix adjacent issues unless they block the requested change. Report important unrelated issues separately.
* Do not perform opportunistic renames, formatting passes, dependency upgrades, or abstraction rewrites.
* Never discard pre-existing worktree changes.
* Review diffs by file and distinguish your edits from existing user edits.
* Do not broaden the scope merely because a wider cleanup would be convenient.

### Types and APIs

* Keep TypeScript strict.
* Do not introduce `any`, unchecked casts, blanket type assertions, or non-null assertions merely to silence the compiler.
* Prefer narrowing `unknown`, explicit null handling, and existing domain types.
* When changing an interface, route param, exported function, store action, or shared utility contract, update all call sites in the same change.
* Preserve backward-compatible optional fields when old Firestore or AsyncStorage records may omit them.
* Validate data at trust boundaries when malformed external or persisted input can reach the changed path. A TypeScript type alone is not runtime validation.
* Do not change the meaning of an existing field without an explicit migration or compatibility plan.
* Prefer additive contract changes when compatibility matters.

### Firestore and persistence

* Keep all raw client Firestore reads and writes in `src/services/*`.
* Screens and stores may call service functions. They must not call Firestore APIs directly.
* Preserve established collection paths and document IDs unless an explicit migration is part of the task.
* Use `buildCreateMetadata()` for creates.
* Use `buildUpdateMetadata()` for updates.
* Never replace or regenerate `createdAt` during an update.
* Use a batch or transaction when multiple writes must succeed atomically.
* If partial success is acceptable, make that behavior explicit in code.
* Make generation and seeding retry-safe.
* Query for existing assignments first and do not overwrite claims or create duplicate chore/date slots.
* Treat `userId: null` as a real domain state, not a missing value.
* Keep `manuallyAssigned` on assignment documents until a deliberate data migration removes it.
* Normalize invite codes consistently at comparison boundaries.
* Reads of persisted data must tolerate older compatible records with missing optional fields.
* Do not silently change storage keys, collection paths, document IDs, or persisted field semantics.
* Do not log tokens, credentials, private profile data, or full Firestore records.
* Do not deploy Firestore rules or Cloud Functions as part of ordinary verification.

### Client state and asynchronous UI

* Stores own shared state, shared transitions, cached views, and persistence.
* Screens own orchestration and rendering.
* When an entity is cached in more than one store field, such as current-week and per-week assignments, update every representation in one logical state transition.
* Do not mutate arrays, objects, function arguments, or existing Zustand state in place.
* Return new values.
* For request-backed UI, clear stale errors at the appropriate retry boundary.
* Set loading before asynchronous work and reset loading in `finally` where appropriate.
* Guard async results when a screen, apartment, selected week, request key, or other context can change before the request completes.
* A late response must not overwrite newer state.
* Preserve distinct first-load and pull-to-refresh behavior when the UI already distinguishes them.
* Empty data is not automatically an error.
* Render the existing empty state unless the product behavior explicitly says otherwise.
* Do not duplicate shared state in screen-local state without a clear reason.
* Do not reset persisted state merely to simplify a UI change.

### Dates, scheduling, and notifications

* A week key is `ISO week-year * 100 + ISO week`.
* Do not combine a calendar year with an ISO week number.
* Any change to week calculation, week start, date serialization, or scheduling must be checked in both `src/utils/dateUtils.ts` and `functions/src/index.ts`.
* Exercise year-boundary examples around December 29 through January 4.
* Exercise Monday and Sunday boundaries.
* Check local-time versus UTC behavior for date-sensitive changes.
* Persist assignment dates as `yyyy-MM-dd`.
* Do not parse or serialize assignment dates through UTC in a way that can shift the calendar day.
* Preserve the invariant that weekly generation creates one unassigned slot per chore per day and never replaces an existing assignment.
* Scheduled notification changes must preserve preference checks, missing-token handling, apartment scoping, and the distinction between local dates and UTC schedules.
* Do not assume client and server date logic are equivalent merely because the implementations look similar.

### Navigation, auth, and configuration

* Add or change routes through the typed navigator param lists.
* Do not pass untyped route payloads.
* Preserve the root flow between profile setup, apartment setup, and the main app.
* Choreezo currently uses Firestore without Firebase Authentication.
* Do not assume `request.auth` exists.
* Do not describe `firestore.rules` as production-ready while the repository marks them as not working.
* Never commit secrets or real Firebase/EAS credentials.
* Use the existing environment-file pattern.
* Public Expo variables may contain only values that are safe to expose in the client bundle.
* Do not hand-edit generated native projects when Expo config or plugins are the source of truth.

## Known hazards in the current repository

* `src/utils/dateUtils.ts#getWeekNumber` currently combines `getYear` with `getISOWeek`, while the server calculates an ISO week-year. Treat client/server equivalence as unverified at year boundaries until this is corrected and tested.
* `firestore.rules` is headed "Not working" and relies on `request.auth`, while the app currently uses Firestore without Firebase Authentication. Do not deploy or rely on these rules without an explicit auth or security task.
* Any code path that duplicates date, week, scheduling, or assignment logic across client and server should be treated as a parity risk until both implementations are inspected.

## Verification matrix

Run only checks relevant to the files changed.

The repository currently has no configured test or lint script. Do not imply that tests or lint passed.

| Changed surface                                                                      | Required local verification                                                                  |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Documentation only                                                                   | Inspect rendered structure and links, then run `git diff --check`                            |
| Client TypeScript, React Native UI, stores, services, or shared utilities            | `npx tsc --noEmit`                                                                           |
| `functions/**`                                                                       | `npm --prefix functions run build`                                                           |
| Shared contract, date, scheduling, or metadata behavior used by client and functions | Run both TypeScript checks above                                                             |
| `package.json` or lockfile                                                           | Run the affected TypeScript check and confirm manifest/lockfile consistency                  |
| `app.json` or `eas.json`                                                             | Parse and review the config; run the client TypeScript check if code also changed            |
| `firestore.rules`                                                                    | Review every affected read/write path and report that no automated rules check is configured |

For behavior that cannot be exercised locally, provide a short manual test recipe instead of claiming verification.

When multiple verification rows apply, run all applicable checks unless one fully subsumes another.

## Risk-based review checklist

Before finishing, answer the applicable questions:

* **Data:** Are old records, null values, missing fields, IDs, storage keys, and timestamps safe?
* **State:** Can stale requests, cached copies, retries, duplicate actions, or partial failures produce inconsistent UI?
* **Dates:** Do client and server agree at timezone, week, and ISO-year boundaries?
* **Security:** Did the change expose secrets, broaden a data path, weaken authorization assumptions, or rely on auth that does not exist?
* **UX:** Are loading, empty, error, cancellation, disabled, refresh, and retry states still reachable and correct?
* **Operations:** Is the change idempotent where it needs to be, and does it avoid unintended remote writes, deployments, notifications, or duplicate scheduled work?
* **Compatibility:** Can older Firestore and AsyncStorage records still be read safely?
* **Diff:** Is every changed line necessary for the request?

## Prohibited shortcuts

* No disabling strict compiler options.
* No blanket ignore directives added merely to make checks pass.
* No swallowing errors with empty `catch` blocks in new or modified behavior.
* No hard-coded production identifiers, credentials, timestamps, or user data.
* No raw Firestore access outside `src/services/*`.
* No duplicate source of truth for domain models, storage keys, collection paths, route contracts, or shared algorithms without an explicit compatibility reason.
* No destructive Git commands, remote deployments, app submissions, or production data mutation unless the user explicitly requests them.
* No claims of "all checks passed" when a check was skipped, unavailable, failed, or only manually inspected.
* No weakening data compatibility merely to simplify the implementation.
* No replacing an existing claim, assignment, or persisted user state during generation or seeding unless explicitly requested.
