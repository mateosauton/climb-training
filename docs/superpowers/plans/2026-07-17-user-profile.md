# User Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved hybrid athlete profile with an identity header, derived training metrics, tabbed editing, responsive behavior, validation, and existing account actions.

**Architecture:** Extract deterministic profile metric/formatting helpers and a focused `UserProfile` feature component while keeping persistence orchestration in `App.tsx`. The component receives existing tracker data and callbacks, maintains one cross-tab form draft, and reuses the current shadcn primitives and profile photo flow.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, Playwright, Tailwind CSS v4, shadcn/ui (`radix-nova`).

---

### Task 1: Derived profile summary

**Files:**
- Create: `src/features/profile/profile-summary.ts`
- Create: `src/features/profile/profile-summary.test.ts`

- [ ] **Step 1: Write failing unit tests**

Cover `formatAgeLocation`, `calculateWeeklyStreak`, `calculateCurrentWeekSessions`, `calculateTrainingLoad`, and `calculateGradeProgress`. Use fixed ISO dates and tracker logs representing empty history, consecutive/non-consecutive weeks, incomplete grades, and low/moderate/high load.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- --run src/features/profile/profile-summary.test.ts`
Expected: FAIL because `profile-summary.ts` does not exist.

- [ ] **Step 3: Implement deterministic helpers**

Export typed pure functions. Accept `now` as an explicit argument for date-sensitive calculations. Return `null` instead of invented progress when grades cannot be normalized. Format age/location by omitting missing values.

- [ ] **Step 4: Run the focused test and verify pass**

Run: `npm test -- --run src/features/profile/profile-summary.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/profile/profile-summary.ts src/features/profile/profile-summary.test.ts
git commit -m "add profile summary metrics"
```

### Task 2: Hybrid profile component

**Files:**
- Create: `src/features/profile/UserProfile.tsx`
- Create: `src/features/profile/UserProfile.test.tsx`
- Modify: `src/features/profile/ProfilePhotoPicker.tsx`

- [ ] **Step 1: Write failing component tests**

Render the feature with representative profile/goals/history props. Assert the header shows `28 años · Salta`, current and target grades, four metric cards, tab names, and athlete summary. Assert missing age/location are omitted. Exercise tab switching and verify unsaved input values remain present.

- [ ] **Step 2: Run the focused component test and verify failure**

Run: `npm test -- --run src/features/profile/UserProfile.test.tsx`
Expected: FAIL because `UserProfile` does not exist.

- [ ] **Step 3: Implement the responsive shadcn composition**

Build the header with `Avatar`, `Badge`, and an edit-focus action; metric cards with accessible labels and `Progress`; scrollable `Tabs` for General, Escalada, Entrenamiento, and Cuenta; a 22rem desktop summary column that stacks below on mobile; and existing account/export/reset actions in Cuenta. Use theme tokens only.

- [ ] **Step 4: Add controlled draft and validation**

Initialize one draft from profile/goals, keep it alive across tab changes, validate age as a positive integer and required goal fields when provided, focus the first invalid input, disable save during submission, and announce success/error through accessible status regions. Submit the complete normalized draft through one callback.

- [ ] **Step 5: Support photo removal**

Extend `ProfilePhotoPicker` with an optional remove callback and render `Eliminar foto` only when a current or pending image exists. Keep file validation and disabled states intact.

- [ ] **Step 6: Run focused profile tests**

Run: `npm test -- --run src/features/profile/UserProfile.test.tsx src/features/profile/ProfilePhotoPicker.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/profile/UserProfile.tsx src/features/profile/UserProfile.test.tsx src/features/profile/ProfilePhotoPicker.tsx src/features/profile/ProfilePhotoPicker.test.tsx
git commit -m "build athlete profile panel"
```

### Task 3: App integration and persistence

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/user-data/user-data-integration.test.tsx`

- [ ] **Step 1: Write failing integration coverage**

Open Perfil in the existing app harness, verify age in the header, edit fields across two tabs, save once, and assert the existing user-data envelope receives profile and goal changes. Cover a recoverable cloud synchronization warning.

- [ ] **Step 2: Run the focused integration test and verify failure**

Run: `npm test -- --run src/features/user-data/user-data-integration.test.tsx`
Expected: FAIL because `App` still renders the legacy profile section.

- [ ] **Step 3: Replace the legacy profile markup**

Render `UserProfile` from the profile tab. Pass the active profile, goals, logs, avatar state/actions, auth identity, theme action, export actions, reset action, and questionnaire action. Remove the superseded profile-only markup while leaving unrelated tabs unchanged.

- [ ] **Step 4: Connect normalized saving**

Adapt the current `saveProfile` persistence path to accept the complete draft, update profile and goals atomically through the existing fact/envelope flow, preserve local success when cloud synchronization fails, and expose saving/result status to `UserProfile`.

- [ ] **Step 5: Run integration and existing profile tests**

Run: `npm test -- --run src/features/user-data/user-data-integration.test.tsx src/features/profile`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/App.tsx src/features/user-data/user-data-integration.test.tsx
git commit -m "integrate user profile"
```

### Task 4: Browser coverage and responsive verification

**Files:**
- Create: `e2e/profile.spec.ts`

- [ ] **Step 1: Add browser tests**

Authenticate with the existing E2E flow, open Perfil, verify the identity header and age, edit and save profile fields, reload, and confirm persistence. Run the layout assertions at desktop and mobile viewports, checking that tabs remain reachable and the summary follows the form on mobile.

- [ ] **Step 2: Run the focused E2E test**

Run: `npx playwright test e2e/profile.spec.ts`
Expected: PASS in all configured projects.

- [ ] **Step 3: Commit**

```bash
git add e2e/profile.spec.ts
git commit -m "test profile workflow"
```

### Task 5: Full verification and PR

**Files:**
- Modify only files required by failures attributable to this feature.

- [ ] **Step 1: Run static verification**

Run: `npm run typecheck && npm run build`
Expected: both commands exit 0.

- [ ] **Step 2: Run all unit/integration tests**

Run: `npm test -- --run && npm run test:questionnaire`
Expected: all tests pass.

- [ ] **Step 3: Run all browser tests**

Run: `npm run test:e2e`
Expected: all configured Playwright tests pass.

- [ ] **Step 4: Review the diff and working tree**

Run: `git diff main...HEAD --check && git status --short`
Expected: no whitespace errors and no unintended changes.

- [ ] **Step 5: Push and create a ready PR**

Push the feature branch and open a non-draft PR targeting `main` with a concise title. PR body:

```markdown
## Summary
- add the hybrid athlete profile and training metrics
- organize editing into responsive shadcn tabs
- cover profile persistence and responsive behavior

## Testing
- npm run typecheck
- npm run build
- npm test -- --run
- npm run test:questionnaire
- npm run test:e2e
```

- [ ] **Step 6: Verify remote checks**

Inspect the PR checks and only declare the PR ready when every required check reports success.
