# Task 4 report

## Completed

- Added a null-safe browser cloud-client factory using only `AuthConfig.url` and `AuthConfig.publishableKey`.
- Added typed cloud DTOs and authenticated repository operations for profile bootstrap, questionnaire submission, active-plan reads, session-run creation, and session-log writes.
- Added fake-client contract tests confirming athlete IDs are derived from the authenticated Supabase user and never accepted from callers.
- Sanitized provider/database failures into stable `unauthenticated` or `unavailable` application errors.

## Verification

- `npm test -- --run src/features/cloud/cloud-repository.test.ts`
- `npm run typecheck`

## Schema dependency

`ensureProfile()` invokes the authenticated public `ensure_athlete_profile` RPC supplied by the forward migration below.

## Final review fixes

- Added forward migration `20260715171111_cloud_repository_security_and_idempotency.sql`; it creates a non-empty, athlete-scoped unique questionnaire idempotency key (with unique legacy backfill), a public zero-argument authenticated profile RPC derived from `auth.uid()`, and no private-schema grant.
- The repository now uses `upsert(..., { onConflict: "athlete_id,idempotency_key", ignoreDuplicates: true })`, so repeated questionnaire submissions safely retain one durable record.
- Session-run creation now requires `planId` and `planSessionId`, sends `plan_id`, and starts with the schema-valid `in_progress` status. The migration backfills and requires `plan_id`, uses a composite plan/athlete foreign key, and validates that the session belongs to that plan and athlete; RLS continues to enforce the authenticated athlete boundary.
- Expanded the fake-client contracts for valid payloads, no caller-supplied athlete ID, conflict-safe retries, unauthenticated failures, and the valid initial run status. Added pgTAP coverage for durable questionnaire idempotency and the public profile RPC's authenticated boundary.

## Final review verification

- Passed: `npm test -- --run src/features/cloud/cloud-repository.test.ts` (5 tests).
- Passed: `npm run typecheck`.
- Passed: `git diff --check`.
- Passed: static pgTAP assertion count (8, matching `select plan(8)`).
- Blocked: `npx supabase@latest db reset --local --no-seed` because Docker is unavailable; SQL migration and pgTAP execution remain pending a running Docker daemon.
