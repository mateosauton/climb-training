# Versioned User JSON Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace anonymous fragmented browser persistence with one versioned, user-owned JSON envelope that preserves sourced fact history and all existing tracker events.

**Architecture:** Add a focused `src/features/user-data` domain containing types, a complete field registry, fact operations, validation, migration, projection, persistence, and export. `App.tsx` keeps its existing single-user screens but derives compatibility state from the active `UserRecord`; its seven state mutations call explicit user-data operations. Guided-session persistence is bridged into the active user record without changing the runner state machine.

**Tech Stack:** React 19, TypeScript, Vite 8, localStorage, IndexedDB for existing video blobs, Vitest, React Testing Library, Playwright.

---

## File map

- `src/features/user-data/user-data-types.ts`: canonical v2 envelope and fact types.
- `src/features/user-data/user-field-registry.ts`: explicit goal/profile category, unit, and projection mapping.
- `src/features/user-data/user-facts.ts`: append, supersede, current-fact, and projection operations.
- `src/features/user-data/user-data-validation.ts`: strict unknown-data guards and relationship validation.
- `src/features/user-data/user-data-migration.ts`: deterministic v1 tracker + guided-state migration.
- `src/features/user-data/user-data-storage.ts`: v2 load/save orchestration and recovery results.
- `src/features/user-data/user-data-export.ts`: deterministic sensitive-data export and filename.
- `src/features/user-data/user-guided-storage.ts`: Storage-compatible bridge backed by the active user record.
- `src/features/user-data/*.test.ts`: domain, migration, storage, and export tests.
- `src/App.tsx`: canonical envelope state, seven mutation integrations, export UI, and warnings.
- `src/features/guided-session/GuidedSessionFlow.tsx`: receive the user-backed storage bridge.
- `src/features/guided-session/GuidedResumeBanner.tsx`: consume active-user guided state from App.
- `e2e/user-data.spec.ts`: migration, history, persistence, export, and mobile coverage.
- `README.md`: document v2 local data and sensitive export behavior.

### Task 1: Define the canonical types and complete field registry

**Files:**
- Create: `src/features/user-data/user-data-types.ts`
- Create: `src/features/user-data/user-field-registry.ts`
- Create: `src/features/user-data/user-field-registry.test.ts`
- Read: `src/lib/training.ts`
- Read: `src/lib/profile-questionnaire.ts`

- [ ] **Step 1: Write the failing registry coverage test**

The test imports `defaultState`, enumerates `Object.keys(defaultState.goals)` and `Object.keys(defaultState.profile)`, and asserts that the registry contains exactly those keys once, with a valid category, destination, and unit. It also asserts that `project` and `focus` map to goals while questionnaire completion fields map to profile.

Run: `npm test -- --run src/features/user-data/user-field-registry.test.ts`

Expected: FAIL because the registry module does not exist.

- [ ] **Step 2: Add the exact contracts**

Define `UserFactCategory`, `UserFactValue`, `UserFactSource`, `UserFact`, `UserIdentity`, `UserRecord`, `UserDataEnvelope`, `UserFieldDefinition`, and `UserDataLoadResult` exactly from the approved spec. Import `SessionLog`, `VideoAnalysis`, and `TrackerState` from `src/lib/training.ts`, and `GuidedSessionState` from the guided feature rather than redefining them.

- [ ] **Step 3: Implement the explicit registry**

Export `USER_FIELD_REGISTRY: Record<keyof TrackerState["goals"] | keyof TrackerState["profile"], UserFieldDefinition>`. Assign units including `years`, `cm`, `kg`, `hours`, `0-10`, and `boolean` only where the current field semantics justify them; use `null` otherwise. Do not classify keys with string matching at runtime.

- [ ] **Step 4: Verify and commit**

Run: `npm test -- --run src/features/user-data/user-field-registry.test.ts`

Expected: registry coverage passes with no missing or extra keys.

```bash
git add src/features/user-data/user-data-types.ts src/features/user-data/user-field-registry.ts src/features/user-data/user-field-registry.test.ts
git commit -m "add user data schema"
```

### Task 2: Implement immutable fact history and current projections

**Files:**
- Create: `src/features/user-data/user-facts.ts`
- Create: `src/features/user-data/user-facts.test.ts`

- [ ] **Step 1: Write failing fact-operation tests**

Cover `appendChangedFacts`, `currentFactsByKey`, and `projectTrackerState`. Assert that unchanged values add no records; changed values append one new fact pointing to the prior ID; clearing a supplied value appends `null`; meaningful `false`, `0`, and `[]` survive; source and injected time are preserved; two fixture users cannot affect one another; latest facts project into the exact existing `goals` and `profile` shapes.

Run: `npm test -- --run src/features/user-data/user-facts.test.ts`

Expected: FAIL because fact functions do not exist.

- [ ] **Step 2: Implement deterministic fact creation**

Export:

```ts
appendChangedFacts(record, values, source, recordedAt, makeId): UserRecord
currentFactsByKey(facts): Map<string, UserFact>
projectTrackerState(record): TrackerState
```

Use registry keys only. Compare arrays by item/value and primitives by `Object.is`; never mutate existing facts or records. Projection begins with a cloned `defaultState`, applies current facts, and uses `record.sessionLogs` and `record.videoAnalyses` for event collections.

- [ ] **Step 3: Verify red-green behavior and commit**

Run: `npm test -- --run src/features/user-data/user-facts.test.ts`

Expected: all immutable history and projection tests pass.

```bash
git add src/features/user-data/user-facts.ts src/features/user-data/user-facts.test.ts
git commit -m "track user fact history"
```

### Task 3: Validate v2 data and migrate legacy browser state

**Files:**
- Create: `src/features/user-data/user-data-validation.ts`
- Create: `src/features/user-data/user-data-validation.test.ts`
- Create: `src/features/user-data/user-data-migration.ts`
- Create: `src/features/user-data/user-data-migration.test.ts`
- Read: `src/features/guided-session/guided-session-storage.ts`

- [ ] **Step 1: Write failing validation tests**

Test a fully valid two-user fixture and rejection of wrong schema version, absent active user, unknown category/key, invalid value type, duplicate fact IDs, cross-user `userId`, broken `supersedes`, supersession cycles, duplicate event IDs, and invalid guided-session state.

Run: `npm test -- --run src/features/user-data/user-data-validation.test.ts`

Expected: FAIL because `validateUserDataEnvelope` is missing.

- [ ] **Step 2: Implement strict validation**

Export `validateUserDataEnvelope(value: unknown): UserDataEnvelope | null`. Validate every nested field and ensure each superseded fact belongs to the same user and fact stream. Reuse guided-state validation by exporting a narrow validator from `guided-session-storage.ts` if needed; do not accept arbitrary objects with type assertions.

- [ ] **Step 3: Write failing migration tests**

Seed `climb4w.state.v1` and `climb4w.guided.v1` fixtures containing all goals/profile fields, `false`, `0`, arrays, logs, videos, active guided progress, and history. Assert stable injected user/fact IDs, preserved event IDs/timestamps, migration source metadata, identical projection, and idempotence when v2 already exists.

Run: `npm test -- --run src/features/user-data/user-data-migration.test.ts`

Expected: FAIL because migration does not exist.

- [ ] **Step 4: Implement migration**

Export:

```ts
migrateLegacyUserData(options: {
  tracker: TrackerState;
  guided: GuidedSessionState;
  now: string;
  makeId: () => string;
}): UserDataEnvelope
```

Use one generated opaque user ID, one ID per included fact, and `source.type: "migration"`. Include non-empty legacy strings plus meaningful numbers, booleans, and arrays. Copy logs/videos/guided state without rewriting their IDs.

- [ ] **Step 5: Verify and commit**

Run:

```bash
npm test -- --run src/features/user-data/user-data-validation.test.ts
npm test -- --run src/features/user-data/user-data-migration.test.ts
```

Expected: all validation and migration tests pass.

```bash
git add src/features/user-data/user-data-validation.ts src/features/user-data/user-data-validation.test.ts src/features/user-data/user-data-migration.ts src/features/user-data/user-data-migration.test.ts src/features/guided-session/guided-session-storage.ts
git commit -m "migrate user data"
```

### Task 4: Add persistence, recovery, export, and guided-state bridge

**Files:**
- Create: `src/features/user-data/user-data-storage.ts`
- Create: `src/features/user-data/user-data-storage.test.ts`
- Create: `src/features/user-data/user-data-export.ts`
- Create: `src/features/user-data/user-data-export.test.ts`
- Create: `src/features/user-data/user-guided-storage.ts`
- Create: `src/features/user-data/user-guided-storage.test.ts`

- [ ] **Step 1: Write failing storage and export tests**

Cover valid v2 load, first migration, no-legacy default user, corrupt v2 isolation without overwrite/remigration, write failure, write-then-read verification failure, stable user ID on reload, deterministic two-space JSON, all fact/event history, app metadata, user/date filename, and exclusion of `plan`, blob values, and object URLs.

Run:

```bash
npm test -- --run src/features/user-data/user-data-storage.test.ts
npm test -- --run src/features/user-data/user-data-export.test.ts
```

Expected: FAIL because storage/export modules do not exist.

- [ ] **Step 2: Implement storage orchestration**

Export `USER_DATA_STORAGE_KEY = "climb4w.users.v2"`, `loadUserData`, and `saveUserData`. `loadUserData` accepts a Storage instance, injected time/ID functions, legacy normalizers, and definitions for guided reconciliation. Return `{ envelope, warning, migrated }`; never overwrite invalid v2 raw data. `saveUserData` writes, reads back, validates equality by canonical JSON, and returns `{ ok, error }` without throwing.

- [ ] **Step 3: Implement deterministic export**

Export `buildUserDataExport(envelope, exportedAt)` and `userDataExportFilename(envelope, exportedAt)`. The export contains the canonical envelope plus `app: { name: "Escalada 4W Tracker", exportedAt, planVersion: "2026-07-09/2026-08-05" }` and no shared plan.

- [ ] **Step 4: Build the guided storage bridge test-first**

The bridge implements only `getItem`, `setItem`, and `removeItem` behavior needed by guided storage. For `climb4w.guided.v1`, reads serialize `activeUser.guidedSessions`; writes validate the supplied guided JSON and call `replaceGuidedSessions(next)`. Unknown keys delegate to the provided browser Storage. Tests assert guided progress updates only the active user and never creates a second v2 envelope.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/features/user-data`

Expected: persistence, recovery, export, and guided bridge tests pass.

```bash
git add src/features/user-data/user-data-storage.ts src/features/user-data/user-data-storage.test.ts src/features/user-data/user-data-export.ts src/features/user-data/user-data-export.test.ts src/features/user-data/user-guided-storage.ts src/features/user-data/user-guided-storage.test.ts
git commit -m "persist user JSON data"
```

### Task 5: Integrate the canonical envelope into the existing app

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/guided-session/GuidedSessionFlow.tsx`
- Create: `src/features/user-data/user-data-integration.test.tsx`

- [ ] **Step 1: Write failing integration tests**

Test that profile save appends `profile-form` facts; questionnaire save appends `questionnaire` facts with `QUESTIONNAIRE_VERSION`; skip records completion facts; log submission appends to `sessionLogs`; save/remove video updates `videoAnalyses`; reset creates a fresh single-user envelope after clearing blobs; guided storage writes update the active user's `guidedSessions`; a storage error shows a persistent warning while the in-memory projection remains updated.

Run: `npm test -- --run src/features/user-data/user-data-integration.test.tsx`

Expected: FAIL because App still persists `TrackerState` directly.

- [ ] **Step 2: Replace App's persistence root**

Initialize `const [userData, setUserData] = useState(loadUserData(...).envelope)` and derive `activeUser` plus `state = projectTrackerState(activeUser)`. Keep a ref synchronized for the guided bridge. Save `userData` through `saveUserData` in one effect; remove the effect that writes `climb4w.state.v1`.

- [ ] **Step 3: Replace the seven tracker mutations**

Profile, questionnaire, and skip use `appendChangedFacts` with their exact sources. Log/video functions immutably append/remove active-user events. Reset constructs a new default envelope. Preserve current UI behavior and selected-session calculations.

- [ ] **Step 4: Wire guided persistence into the user record**

Create one memoized guided Storage bridge and pass it to `GuidedSessionFlow`. Replace direct Plan snapshots from `window.localStorage` with `activeUser.guidedSessions`. Ensure runner saves trigger App state updates and resume banners rerender immediately.

- [ ] **Step 5: Verify integration and commit**

Run:

```bash
npm test -- --run src/features/user-data/user-data-integration.test.tsx
npm test -- --run
npm run typecheck
```

Expected: integration, existing unit/component tests, and typecheck pass.

```bash
git add src/App.tsx src/features/guided-session/GuidedSessionFlow.tsx src/features/user-data/user-data-integration.test.tsx
git commit -m "integrate user JSON store"
```

### Task 6: Update the Profile backup experience

**Files:**
- Modify: `src/App.tsx`
- Create: `src/features/user-data/user-data-export-ui.test.tsx`
- Modify: `README.md`

- [ ] **Step 1: Write failing export UI tests**

Assert active user ID and a sensitive-local-data warning are visible; Copy, preview, and Download consume the identical `buildUserDataExport` string; preview includes schema version and fact history; the filename contains user ID and ISO date; no shared `plan` array appears.

Run: `npm test -- --run src/features/user-data/user-data-export-ui.test.tsx`

Expected: FAIL against the legacy partial export.

- [ ] **Step 2: Implement the backup UI**

Replace `exportJson` with the canonical export. Keep existing buttons and textarea, add the user ID and warning text, and change download filename through `userDataExportFilename`. Do not render raw JSON until the user presses View JSON.

- [ ] **Step 3: Update documentation and verify**

Document `climb4w.users.v2`, immutable fact history, video-blob separation, legacy recovery keys, and sensitive export handling in README.

Run:

```bash
npm test -- --run src/features/user-data/user-data-export-ui.test.tsx
npm run test:questionnaire
npm run build
```

Expected: UI/regression/build checks pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/features/user-data/user-data-export-ui.test.tsx README.md
git commit -m "update user data export"
```

### Task 7: Add migration and mobile browser coverage

**Files:**
- Create: `e2e/user-data.spec.ts`
- Modify: `playwright.config.ts` only if a dedicated project helper is needed

- [ ] **Step 1: Add end-to-end migration tests**

Before page load, seed legacy tracker/guided keys. Verify unchanged profile/log UI, one v2 user, migration metadata, preserved guided progress, and unchanged legacy keys. Reload and assert the same active user ID with unchanged fact/event counts.

- [ ] **Step 2: Add history and event tests**

Change one profile field twice and inspect exported JSON for a three-link migration/change/change chain. Complete a guided session and add a log; assert both live under the active user and guided completion does not fabricate a second log.

- [ ] **Step 3: Add mobile/privacy tests**

At 390×844 and 320×568, verify Profile export controls have no overflow or covered actions. Intercept requests and assert no request body or URL contains `climb4w.users.v2`, the active user ID, or serialized fact values.

- [ ] **Step 4: Run the complete verification matrix**

Run:

```bash
npm test -- --run
npm run test:e2e
npm run typecheck
npm run test:questionnaire
npm run build
git diff --check
```

Expected: all unit/component/browser tests pass across desktop and three mobile projects; build/typecheck exit 0; no whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add e2e/user-data.spec.ts playwright.config.ts
git commit -m "test user JSON migration"
```

## Final acceptance audit

- [ ] All current profile and goal fields have one registry definition.
- [ ] Every changed answer produces a sourced fact and valid supersession link.
- [ ] Legacy tracker and guided data migrate once without loss or duplication.
- [ ] One active user owns facts, logs, video analyses, and guided sessions.
- [ ] Existing UI behavior is preserved through current-value projection.
- [ ] Copy, preview, and download return the same complete v2 export.
- [ ] Video binaries and the shared plan are excluded from JSON.
- [ ] Corrupt v2 data is never overwritten or silently remigrated.
- [ ] No user data is logged, committed, or sent over the network.
- [ ] Desktop and 390×844, 360×800, and 320×568 checks pass.
- [ ] The feature branch is ready for a protected pull request into `dev`.
