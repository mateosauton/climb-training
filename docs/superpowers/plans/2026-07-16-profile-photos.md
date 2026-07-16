# Profile Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist one private Supabase profile photo per athlete and use it as the sole profile-navigation entry in onboarding and the sidebar.

**Architecture:** Add a private Storage bucket and owner-scoped policies, then isolate browser Storage calls in a typed avatar service. Keep only `avatar_path` in `athlete_profiles`; React owns temporary file previews and receives signed display URLs from the service.

**Tech Stack:** React 19, TypeScript, Vitest/Testing Library, Supabase JS/Postgres/Storage, Playwright.

---

### Task 1: Avatar Storage schema

**Files:**
- Create: `supabase/migrations/<generated>_profile_photos.sql`
- Create: `supabase/tests/profile_photos.sql`

- [ ] Write SQL tests asserting a private `profile-photos` bucket, `avatar_path` on `athlete_profiles`, and owner-only select/insert/update/delete policies.
- [ ] Run `supabase test db supabase/tests/profile_photos.sql` and confirm the new assertions fail.
- [ ] Generate the migration with `supabase migration new profile_photos` and add the column, bucket constraints, grants, policies, and profile update RPC required by the client.
- [ ] Re-run `supabase test db supabase/tests/profile_photos.sql` and confirm it passes.
- [ ] Commit with `add profile photo storage`.

### Task 2: Typed avatar service

**Files:**
- Create: `src/features/cloud/cloud-avatar.ts`
- Create: `src/features/cloud/cloud-avatar.test.ts`
- Modify: `src/features/cloud/cloud-types.ts`
- Modify: `src/features/cloud/cloud-repository.ts`
- Modify: `src/features/cloud/cloud-repository.test.ts`

- [ ] Write failing tests for JPEG/PNG/WebP validation, 5 MB rejection, `{athlete_id}/avatar.<ext>` paths, upload with `upsert`, signed URL loading, and profile-path persistence.
- [ ] Run `npm test -- --run src/features/cloud/cloud-avatar.test.ts src/features/cloud/cloud-repository.test.ts` and verify failures are caused by missing avatar behavior.
- [ ] Implement `validateAvatarFile`, `uploadAvatar`, `createAvatarSignedUrl`, and `saveAvatarPath`; expose profile avatar data through cloud hydration/repository types.
- [ ] Re-run the focused tests and confirm they pass.
- [ ] Commit with `add cloud profile photos`.

### Task 3: Onboarding profile-photo control

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/cloud/cloud-integration.test.tsx`
- Create: `src/features/profile/ProfilePhotoPicker.tsx`
- Create: `src/features/profile/ProfilePhotoPicker.test.tsx`

- [ ] Write failing component tests for accessible file selection, circular preview, replacement, invalid input feedback, and upload-before-questionnaire completion.
- [ ] Run the focused Vitest files and confirm expected failures.
- [ ] Implement the reusable picker with object-URL cleanup and connect submission to the avatar service; leave onboarding open and show an alert when upload/save fails.
- [ ] Re-run focused tests and confirm they pass.
- [ ] Commit with `add onboarding profile photo`.

### Task 4: Identity header and profile navigation

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/user-data/user-data-integration.test.tsx`
- Modify: `e2e/user-data.spec.ts`

- [ ] Write failing tests that assert the sidebar shows athlete name and grades, Profile is absent from primary navigation, and the avatar button opens Profile.
- [ ] Run the focused Vitest test and confirm it fails for the current generic block header.
- [ ] Render `AvatarImage` with signed/fallback data, move the existing block dropdown behavior off the identity row, remove the Profile tab button, and make the avatar a labeled button that calls `goToTab("profile")`.
- [ ] Re-run focused tests and confirm they pass.
- [ ] Commit with `update profile navigation`.

### Task 5: Full verification and PR

**Files:**
- Modify only files needed to fix verification failures caused by this feature.

- [ ] Run `npm test -- --run` and require zero failures.
- [ ] Run `npm run typecheck` and require exit 0.
- [ ] Run `npm run build` and require exit 0.
- [ ] Run the relevant Playwright specs with configured test auth and require zero failures, or record the exact external prerequisite if unavailable.
- [ ] Inspect `git diff origin/dev...HEAD`, confirm only scoped changes, and run the Supabase security/advisor checks available in the connected environment.
- [ ] Push `codex/profile-photos` and create a concise PR into `dev` with Summary and Testing only.
