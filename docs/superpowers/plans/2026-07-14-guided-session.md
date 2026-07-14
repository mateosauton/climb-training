# Guided Session Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a mobile-first, local-first runner that launches the selected plan session, previews it, guides the athlete block by block with exercise references, resumes safely, and hands completion to the existing log.

**Architecture:** Keep the existing tracker state untouched. Add an isolated `src/features/guided-session` feature with authored definitions, a pure run reducer, versioned storage, and focused summary/runner/completion components; `App.tsx` only launches the flow and receives close/log callbacks. ElevenLabs remains deferred behind deterministic IDs and narration text.

**Tech Stack:** React 19, TypeScript, Vite 8, Tailwind CSS 4, shadcn/Radix components, Vitest, React Testing Library, jsdom, Playwright.

---

## File map

- `src/features/guided-session/guided-session-types.ts`: guide, media, run, state, and event contracts.
- `src/features/guided-session/guided-session-data.ts`: explicitly authored definitions for all 28 `plan` sessions.
- `src/features/guided-session/guided-session-reducer.ts`: pure transitions, reconciliation, and active-time calculations.
- `src/features/guided-session/guided-session-storage.ts`: isolated `climb4w.guided.v1` validation/load/save behavior.
- `src/features/guided-session/GuidedMedia.tsx`: lazy YouTube/external reference presentation.
- `src/features/guided-session/SessionStartSummary.tsx`: selected-session preview.
- `src/features/guided-session/GuidedBlockView.tsx`: current block, progress, navigation, skip, and media.
- `src/features/guided-session/SessionCompletion.tsx`: elapsed/completed/skipped summary and Log handoff.
- `src/features/guided-session/GuidedSessionExitDialog.tsx`: pause/discard confirmation.
- `src/features/guided-session/GuidedSessionFlow.tsx`: feature orchestration, persistence, focus, and recovery warnings.
- `src/features/guided-session/*.test.ts(x)`: unit and component coverage.
- `src/App.tsx`: Plan launch/resume controls and callback integration.
- `src/index.css`: safe-area and reduced-motion utilities only if Tailwind utilities are insufficient.
- `playwright.config.ts`, `e2e/guided-session.spec.ts`: desktop/mobile browser coverage.
- `vite.config.ts`, `package.json`: test configuration and scripts.

### Task 1: Install the test harness

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `vite.config.ts`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Add test dependencies**

Run:

```bash
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event @playwright/test
```

Expected: lockfile updates and install exits 0.

- [ ] **Step 2: Configure Vitest and scripts**

Add `test`, `test:watch`, and `test:e2e` scripts. Configure `vite.config.ts` with `test: { environment: "jsdom", setupFiles: ["./src/test/setup.ts"], css: true }`. In `src/test/setup.ts`, import `@testing-library/jest-dom/vitest`, clear `localStorage` after each test, and provide `matchMedia` when jsdom lacks it.

- [ ] **Step 3: Prove the harness runs**

Run: `npm test -- --run`

Expected: exit 0 with no tests found or a single setup smoke test passing.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json vite.config.ts src/test/setup.ts
git commit -m "add guided session tests"
```

### Task 2: Define and validate all guided content

**Files:**
- Create: `src/features/guided-session/guided-session-types.ts`
- Create: `src/features/guided-session/guided-session-data.ts`
- Create: `src/features/guided-session/guided-session-data.test.ts`
- Read: `public/data/training-plan.md`
- Read: `src/lib/training.ts`

- [ ] **Step 1: Write failing content-contract tests**

Tests must assert: all 28 `plan` IDs have exactly one definition; every definition has `version: 1`, objective, safety note, and at least one block; session/block/media IDs are unique; every block has instruction, at least one cue, narration text, equipment, and a valid phase; demanding blocks have dose/rest and a stop condition; YouTube media has an 11-character ID and an HTTPS URL.

Run: `npm test -- --run src/features/guided-session/guided-session-data.test.ts`

Expected: FAIL because types/data do not exist.

- [ ] **Step 2: Implement the contracts**

Define `GuidedMedia`, `GuidedBlock`, `GuidedSessionDefinition`, `GuidedRunStatus`, `GuidedRun`, `GuidedSessionState`, and the reducer event union exactly as specified in `docs/superpowers/specs/2026-07-14-guided-session-design.md` sections 6–7.

- [ ] **Step 3: Author the 28 definitions**

Build `guidedSessionDefinitions: Record<string, GuidedSessionDefinition>` from the full Markdown plan. Use meaningful units such as warmup, main work, strength/accessory, prehab/cooldown, or recovery review. Reuse matching `exerciseLibrary` dose, rationale, cues, avoid, and references by importing the library; convert YouTube references to media with their known IDs and leave articles as `external`. Do not parse prose at runtime, invent URLs, or add voice controls.

- [ ] **Step 4: Verify content**

Run: `npm test -- --run src/features/guided-session/guided-session-data.test.ts`

Expected: all content-contract tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/guided-session/guided-session-types.ts src/features/guided-session/guided-session-data.ts src/features/guided-session/guided-session-data.test.ts
git commit -m "add guided session content"
```

### Task 3: Build the deterministic run engine

**Files:**
- Create: `src/features/guided-session/guided-session-reducer.ts`
- Create: `src/features/guided-session/guided-session-reducer.test.ts`

- [ ] **Step 1: Write reducer tests first**

Cover create → summary → start; complete and skip disjointness; navigation without implicit completion; rejection of early run completion; last-block completion; pause/resume active-time accumulation with injected ISO timestamps; restore-active-as-paused; clamped indices; definition-version reconciliation by stable block ID; restart and discard.

Run: `npm test -- --run src/features/guided-session/guided-session-reducer.test.ts`

Expected: FAIL because the reducer does not exist.

- [ ] **Step 2: Implement minimal pure transitions**

Export `createGuidedRun`, `guidedSessionReducer`, `elapsedActiveSeconds`, and `reconcileGuidedRun`. Reducer events carry `now` so tests never depend on wall-clock time. `COMPLETE_RUN` returns unchanged state unless every definition block is completed or skipped.

- [ ] **Step 3: Verify reducer**

Run: `npm test -- --run src/features/guided-session/guided-session-reducer.test.ts`

Expected: all reducer tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/guided-session/guided-session-reducer.ts src/features/guided-session/guided-session-reducer.test.ts
git commit -m "add guided session engine"
```

### Task 4: Isolate persistence and recovery

**Files:**
- Create: `src/features/guided-session/guided-session-storage.ts`
- Create: `src/features/guided-session/guided-session-storage.test.ts`

- [ ] **Step 1: Write failing storage tests**

Test missing storage, valid load, malformed JSON isolation, invalid shape isolation, synchronous save under `climb4w.guided.v1`, write failure returned as a typed result, and restore reconciliation that pauses active runs without adding closed-browser time.

Run: `npm test -- --run src/features/guided-session/guided-session-storage.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 2: Implement the adapter**

Export `GUIDED_STORAGE_KEY`, `emptyGuidedSessionState`, `loadGuidedSessionState(storage, definitions, now)`, and `saveGuidedSessionState(storage, state)`. Validate unknown data manually with narrow type guards; never throw into `App` and never read or modify `climb4w.state.v1`.

- [ ] **Step 3: Verify storage**

Run: `npm test -- --run src/features/guided-session/guided-session-storage.test.ts`

Expected: all storage tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/guided-session/guided-session-storage.ts src/features/guided-session/guided-session-storage.test.ts
git commit -m "persist guided sessions"
```

### Task 5: Build the summary, media, block, exit, and completion UI

**Files:**
- Create: `src/features/guided-session/SessionStartSummary.tsx`
- Create: `src/features/guided-session/GuidedMedia.tsx`
- Create: `src/features/guided-session/GuidedBlockView.tsx`
- Create: `src/features/guided-session/GuidedSessionExitDialog.tsx`
- Create: `src/features/guided-session/SessionCompletion.tsx`
- Create: `src/features/guided-session/guided-session-components.test.tsx`

- [ ] **Step 1: Write failing user-facing tests**

Render the components with a small fixture and assert Spanish summary metadata/equipment/safety/ordered blocks; a 44px-capable start action; dose, instructions, numbered steps, cues and avoid; lazy media iframe created only after click with title, `playsinline=1`, no autoplay, and external fallback; progress semantics; previous/complete/skip callbacks; accessible exit confirmation; completion elapsed/completed/skipped counts and selected-session Log callback.

Run: `npm test -- --run src/features/guided-session/guided-session-components.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 2: Implement focused components**

Use existing Button, Card, Badge, Progress, Alert, AlertDialog, and lucide icons. Keep copy Spanish. Media remains collapsed until tapped. Use semantic headings/lists, visible focus states, `aria-valuenow` progress, explicit icon labels, and no autoplay.

- [ ] **Step 3: Verify component behavior**

Run: `npm test -- --run src/features/guided-session/guided-session-components.test.tsx`

Expected: all component tests pass without React accessibility warnings.

- [ ] **Step 4: Commit**

```bash
git add src/features/guided-session/SessionStartSummary.tsx src/features/guided-session/GuidedMedia.tsx src/features/guided-session/GuidedBlockView.tsx src/features/guided-session/GuidedSessionExitDialog.tsx src/features/guided-session/SessionCompletion.tsx src/features/guided-session/guided-session-components.test.tsx
git commit -m "build guided session screens"
```

### Task 6: Orchestrate and integrate the runner

**Files:**
- Create: `src/features/guided-session/GuidedSessionFlow.tsx`
- Create: `src/features/guided-session/GuidedSessionFlow.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing flow tests**

Test summary → active blocks → completion; pause/close persists; resume uses the first unresolved block; starting a different selected session requires cancel/resume/discard; storage failure leaves navigation working and shows a warning; Log callback receives the original session ID; block transitions scroll to top, focus the heading, and update a polite live region.

Run: `npm test -- --run src/features/guided-session/GuidedSessionFlow.test.tsx`

Expected: FAIL because orchestration does not exist.

- [ ] **Step 2: Implement `GuidedSessionFlow`**

Create a fixed full-viewport surface above the app with safe-area header/footer and one scrolling body. Initialize from the storage adapter, dispatch reducer events, save after every transition, and expose `onCloseToPlan()` and `onOpenLog(sessionId)`. Render missing/empty definitions as a recoverable error rather than creating a run.

- [ ] **Step 3: Integrate Plan and Log**

In `App.tsx`, add runner-open state; use `guidedSessionDefinitions[selectedSessionId]`; show `Iniciar sesión` or `Continuar sesión · Bloque X de Y` near the selected session header and in a sticky narrow-screen action. If another run exists, show the specified resume/discard/cancel dialog. On Log handoff, call `selectSession(sessionId)`, `loadLogForSession(sessionId)`, set `activeTab` to `log`, and close the runner. Treat a completed guided run as a Plan completion mark only; dashboard metrics remain log-backed.

- [ ] **Step 4: Verify integration and regression**

Run:

```bash
npm test -- --run
npm run typecheck
npm run test:questionnaire
npm run build
```

Expected: tests/typecheck/build exit 0; the existing questionnaire test remains green.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/features/guided-session/GuidedSessionFlow.tsx src/features/guided-session/GuidedSessionFlow.test.tsx
git commit -m "integrate guided sessions"
```

### Task 7: Add browser and mobile verification

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/guided-session.spec.ts`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/index.css` only if safe-area/reduced-motion rules are required

- [ ] **Step 1: Add Playwright configuration**

Configure Chromium projects for desktop 1440×900, iPhone-like 390×844, Android-like 360×800, and minimum 320×568. Use `npm run dev -- --port 8765` as `webServer`, reuse outside CI, and collect screenshots/traces only on failure.

- [ ] **Step 2: Write the critical E2E paths**

Automate W1D1 launch/summary/complete-or-skip/completion/Log; pause/reload/resume; alternate-session conflict; lazy YouTube embed bounds/no-autoplay/title/fallback; offline written navigation; rest-day completion; keyboard exit dialog and focus changes. At every mobile viewport assert `document.documentElement.scrollWidth <= window.innerWidth`, the primary action is visible, and the footer does not cover the last content element. Run critical layout checks in light and dark themes.

- [ ] **Step 3: Run and fix from evidence**

Run: `npx playwright install chromium && npm run test:e2e`

Expected: all configured desktop/mobile Chromium projects pass.

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

Expected: zero unit/component/E2E failures, typecheck/build exit 0, no whitespace errors.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts e2e/guided-session.spec.ts package.json package-lock.json src/index.css
git commit -m "test guided sessions"
```

## Final acceptance audit

- [ ] Every spec acceptance criterion maps to an automated test or a recorded manual viewport check.
- [ ] All 28 sessions launch a non-empty authored definition.
- [ ] Reload restores one active run as paused and never fabricates elapsed time.
- [ ] Guided completion does not create a metric log.
- [ ] Videos are optional, lazy, responsive, titled, and non-autoplaying.
- [ ] The flow is fully usable at 320px and by keyboard.
- [ ] No ElevenLabs dependency, credential, or inactive voice control ships.
- [ ] Working tree contains only intended files and concise commits.
