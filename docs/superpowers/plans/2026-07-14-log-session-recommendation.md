# Post-save Session Recommendation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reset the log form after save and replace log history with a scored, actionable session recommendation and clear next actions.

**Architecture:** Put deterministic coaching logic in a small pure module so it can be tested independently. App state holds only the latest post-save assessment; persisted logs remain unchanged and continue feeding dashboard metrics.

**Tech Stack:** React, TypeScript, Vitest, Testing Library

---

### Task 1: Recommendation engine

**Files:**
- Create: `src/features/session-recommendation/session-recommendation.ts`
- Test: `src/features/session-recommendation/session-recommendation.test.ts`

- [ ] **Step 1: Write failing score tests**

Test that `buildSessionRecommendation(log, session)` always returns a score from 1–10, rewards productive low-pain sessions, and prioritizes pain/recovery guidance for risky sessions.

- [ ] **Step 2: Verify RED**

Run `npm test -- src/features/session-recommendation/session-recommendation.test.ts`; expect failure because the module does not exist.

- [ ] **Step 3: Implement the pure recommendation function**

Normalize effort against `session.intensity`, combine completion/output, pain, sleep/energy, foot cuts, and RPE into a bounded score, then return a summary and up to three prioritized Spanish coaching actions.

- [ ] **Step 4: Verify GREEN**

Run the same test command; expect all recommendation tests to pass.

### Task 2: Post-save flow

**Files:**
- Modify: `src/App.tsx`
- Test: `src/features/session-recommendation/session-recommendation-flow.test.tsx`

- [ ] **Step 1: Write failing interaction tests**

Seed a completed profile, open Log, enter distinct values and notes, save, and assert: the log persists; history is absent; score and advice appear; input values are reset; `Registrar otra sesión` restores a blank form; and `Continuar` opens Dashboard.

- [ ] **Step 2: Verify RED**

Run `npm test -- src/features/session-recommendation/session-recommendation-flow.test.tsx`; expect missing post-save UI assertions to fail.

- [ ] **Step 3: Implement minimal React state and UI**

Add `savedRecommendation` state. On successful save, build the assessment, persist the log, reset `logForm` and errors, and show the result card instead of the form. Replace the history card with guidance explaining that an assessment appears after save. Wire the two result actions to a fresh log and Dashboard.

- [ ] **Step 4: Verify GREEN**

Run both recommendation test files; expect them to pass.

### Task 3: Full verification and delivery

**Files:**
- Modify only files required by Tasks 1–2.

- [ ] Run `npm test -- --run`, `npm run typecheck`, and `npm run build`; expect zero failures.
- [ ] Review the diff for accidental history UI or stale reset controls.
- [ ] Commit with a concise message, push `codex/log-session-recommendation`, and open a concise PR with summary and testing.
