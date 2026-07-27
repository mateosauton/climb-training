# Climb 4W Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic shadcn presentation with the approved Climb 4W light editorial outdoor system across all product flows.

**Architecture:** Keep accessible Radix/shadcn behavior beneath first-party Climb primitives. Define semantic tokens and original SVG/React visual marks centrally, then compose flow-specific surfaces from those primitives. Preserve all existing auth, storage, cloud, and training logic.

**Tech Stack:** React, TypeScript, Tailwind CSS v4, Radix UI, Vitest, Playwright.

---

### Task 1: Foundations

**Files:** `src/index.css`, `src/components/climb/*`, component tests.

- [ ] Define warm paper, ink, river-blue, lichen, clay, sandstone and grade-scale semantic tokens in both themes.
- [ ] Add first-party visual marks and reusable action, choice-card, load-scale, session-card, recovery, and grade components.
- [ ] Verify accessible names, keyboard state, grade text equivalents, and build output.

### Task 2: Gallery and Mockups

**Files:** `src/features/design-system/*`, `src/main.tsx`, onboarding mockup tests.

- [ ] Add a route-selectable gallery documenting component variants and grade colors.
- [ ] Extend mockup mode so each authentication, onboarding, training, video, and profile flow can be reviewed with seeded data.
- [ ] Verify desktop and narrow-mobile layout has no horizontal overflow.

### Task 3: Product Migration

**Files:** `src/features/auth/*`, `src/features/onboarding/*`, `src/features/guided-session/*`, `src/features/profile/*`, `src/App.tsx`.

- [ ] Replace generic composition with Climb primitives while preserving user-visible labels and behavior.
- [ ] Apply the grade color scale with textual grade labels in plan, logs, dashboard, video and profile views.
- [ ] Verify each existing flow remains functional after migration.

### Task 4: End-to-End Validation

**Files:** `e2e/*.spec.ts`, component tests.

- [ ] Cover registration, verification, onboarding, dashboard, plan, runner, log, video, profile and account journeys at desktop and mobile sizes.
- [ ] Assert 44px touch targets, visible primary actions, no horizontal overflow, unobscured content and keyboard focus.
- [ ] Run typecheck, unit tests, questionnaire checks, every Playwright project and production build before push.
