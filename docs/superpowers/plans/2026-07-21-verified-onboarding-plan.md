# Verified Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Verify email registration with a six-digit code, require the profile questionnaire, and generate a plan once it is submitted.

**Architecture:** The auth adapter will verify Supabase’s emailed OTP and surface an explicit confirmation state through the provider and gate. The cloud repository will return the persisted questionnaire ID so the app can call the existing plan-generation function after a successful questionnaire submission. The UI will keep the onboarding dialog open until the required questionnaire is saved and show generation status with retry support.

**Tech Stack:** React, TypeScript, Supabase Auth, Supabase Edge Functions, Vitest, Playwright.

---

### Task 1: Add verified email registration

**Files:**
- Modify: `src/features/auth/auth-client.ts`
- Modify: `src/features/auth/AuthProvider.tsx`
- Modify: `src/features/auth/AuthGate.tsx`
- Test: `src/features/auth/auth-client.test.ts`
- Test: `src/features/auth/AuthProvider.test.tsx`
- Test: `src/features/auth/AuthGate.test.tsx`

- [x] **Step 1: Write failing tests for adapter OTP verification and the code-entry gate.**
- [x] **Step 2: Run `npm test -- --run src/features/auth/auth-client.test.ts src/features/auth/AuthProvider.test.tsx src/features/auth/AuthGate.test.tsx` and confirm the new expectations fail.**
- [x] **Step 3: Add `verifyEmailCode(email, code)` using `supabase.auth.verifyOtp({ email, token: code, type: "email" })`; expose pending verification state, a numeric six-digit code input, and confirmation action.**
- [x] **Step 4: Re-run the focused auth tests and confirm they pass.**

### Task 2: Connect questionnaire completion to plan generation

**Files:**
- Modify: `src/features/cloud/cloud-types.ts`
- Modify: `src/features/cloud/cloud-repository.ts`
- Modify: `src/App.tsx`
- Test: `src/features/cloud/cloud-repository.test.ts`
- Test: `src/features/cloud/cloud-integration.test.tsx`

- [x] **Step 1: Write failing tests that require questionnaire persistence to return its ID and plan generation to receive that ID.**
- [x] **Step 2: Run `npm test -- --run src/features/cloud/cloud-repository.test.ts src/features/cloud/cloud-integration.test.tsx` and confirm the new expectations fail.**
- [x] **Step 3: Return the questionnaire ID from the idempotent upsert, remove the first-onboarding skip action, await cloud save, invoke `generatePlan`, and show generation failure/retry feedback.**
- [x] **Step 4: Re-run the focused cloud tests and confirm they pass.**

### Task 3: Prove the browser flow

**Files:**
- Modify: `src/features/auth/e2e-auth-client.ts`
- Modify: `src/main.tsx`
- Modify: `playwright.config.ts`
- Create: `e2e/registration-onboarding.spec.ts`

- [x] **Step 1: Add a deterministic signed-out development auth client that accepts the test code and emits an authenticated user.**
- [x] **Step 2: Write the browser test: register, enter the six-digit code, complete the questionnaire, assert generation, and save screenshots.**
- [x] **Step 3: Run `npm run test:e2e -- --project=desktop` and inspect the explicit screenshots.**

### Task 4: Final verification and commit

**Files:**
- Modify: changed feature and test files only

- [x] **Step 1: Run `npm test -- --run`, `npm run typecheck`, `npm run build`, `npm run test:questionnaire`, and all browser tests.**
- [x] **Step 2: Inspect the working tree and screenshots against the requested flow.**
- [ ] **Step 3: Commit the tested changes with a concise message.**
