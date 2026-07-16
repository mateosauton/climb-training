# Supabase Database Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Supabase the primary, RLS-protected data and private video store for independently authenticated climbing athletes.

**Architecture:** PostgreSQL migrations establish public athlete data tables, private generation internals, strict RLS, and a private Storage bucket. The browser accesses only an authenticated repository layer; Edge Functions perform idempotent import, trusted plan generation, and privileged publication. Existing schema-3 browser data is imported once and retained locally as recovery data until verification succeeds.

**Tech Stack:** Supabase PostgreSQL 17, Supabase Auth/Storage/Edge Functions, `@supabase/supabase-js`, React/Vite, TypeScript, Vitest, Playwright.

---

## Global constraints

- Ownership is the authenticated Supabase UUID; email is never an ownership key.
- Every public athlete-owned table enables RLS and scopes rows with `(select auth.uid()) = athlete_id`.
- `private` is not exposed or granted to browser roles. Security-definer functions live there and set `search_path` explicitly.
- Facts, questionnaire submissions, published plans, plan descendants, and analysis versions are immutable.
- The active plan is the only mutable selection; publication and activation happen in one transaction.
- Storage objects use `climbing-videos/{athlete_id}/{video_id}/original.<extension>` and policies validate the first path segment.
- AI output never publishes unless deterministic safety rules and strict schema validation pass.
- The existing local envelope is a recovery copy; import is idempotent by athlete, source schema, and payload hash.
- Never place a service-role key, database password, AI API key, token, or signed Storage URL in Vite variables, source code, test snapshots, docs, or commits.

## Planned files

- Create: `supabase/config.toml` — local Supabase project configuration.
- Create: `supabase/migrations/<timestamp>_foundation.sql` — schemas, types, profiles, questionnaire/facts tables, RLS, and profile bootstrap.
- Create: `supabase/migrations/<timestamp>_plans.sql` — catalog, generation jobs, immutable plans, policies, indexes, and publication function.
- Create: `supabase/migrations/<timestamp>_activity_media.sql` — training activity, private Storage bucket/policies, video metadata/analyses, import receipts.
- Create: `supabase/functions/import-local-data/index.ts` — authenticated staged idempotent importer.
- Create: `supabase/functions/generate-plan/index.ts` — authenticated rules-first plan-generation boundary and provider adapter contract.
- Create: `src/features/cloud/cloud-client.ts` — typed Supabase client used only after Auth configuration succeeds.
- Create: `src/features/cloud/cloud-types.ts` — database-facing DTOs and conversion contracts.
- Create: `src/features/cloud/cloud-repository.ts` — athlete-scoped read/write operations.
- Create: `src/features/cloud/cloud-import.ts` — browser import preparation, hashing, retry status, and recovery behavior.
- Create: `src/features/cloud/cloud-video.ts` — private video upload, resume, metadata, and analysis operations.
- Create: `src/features/cloud/cloud-repository.test.ts` — repository contract tests with a fake client.
- Create: `src/features/cloud/cloud-import.test.ts` — deterministic import-preparation tests.
- Create: `src/features/cloud/cloud-video.test.ts` — object-path and upload lifecycle tests.
- Modify: `src/App.tsx` — replace local-primary writes with cloud repository operations while preserving UI behavior.
- Modify: `src/main.tsx` and `src/AppRoot.tsx` — supply configured authenticated cloud client and onboarding/import boundary.
- Modify: `src/features/user-data/*` — retain legacy parser/export only as migration/recovery support; remove it from primary persistence flow.
- Modify: `README.md` and `.env.example` — document local Supabase, database migrations, non-secret client variables, and required server secrets by name only.
- Create: `supabase/tests/*.sql` — pgTAP/SQL authorization and immutability tests, if supported by the selected local Supabase setup.

### Task 1: Establish Supabase project and foundation schema

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/<timestamp>_foundation.sql`
- Create: `supabase/tests/foundation.sql`

- [ ] **Step 1: Discover the installed Supabase CLI and initialize the project without linking secrets**

Run: `npx supabase@latest --help && npx supabase@latest init --help`

Expected: Current command syntax is recorded before creating `supabase/`; no credential is written into a repository file.

- [ ] **Step 2: Create the migration with the CLI**

Run: `npx supabase@latest migration new foundation`

Expected: The CLI creates the timestamped migration under `supabase/migrations/`.

- [ ] **Step 3: Write failing SQL tests for isolation and immutable facts**

Create tests that establish two authenticated JWT claims, insert profile/fact fixtures through permitted paths, and assert the following:

```sql
-- athlete A cannot select athlete B's profile or fact
select isnt(
  (select count(*) from public.athlete_facts where athlete_id = '00000000-0000-0000-0000-0000000000b2'),
  1::bigint,
  'RLS hides another athlete facts'
);

-- an existing fact cannot be updated
select throws_ok(
  $$update public.athlete_facts set value = '"changed"'::jsonb where id = '00000000-0000-0000-0000-0000000000f1'$$,
  '42501',
  null,
  'facts are immutable'
);
```

- [ ] **Step 4: Implement foundation SQL**

The migration must create `private`, `public.athlete_profiles`, `public.questionnaire_submissions`, and `public.athlete_facts`. Use UUID IDs, UTC timestamps, an `athlete_id references auth.users(id)`, JSONB answer/value columns, source metadata, and same-athlete `supersedes_id` validation. Apply `enable row level security` and policies equivalent to:

```sql
create policy "athletes read own profiles"
on public.athlete_profiles for select to authenticated
using ((select auth.uid()) = athlete_id);

create policy "athletes insert own facts"
on public.athlete_facts for insert to authenticated
with check ((select auth.uid()) = athlete_id);

create policy "athletes read own facts"
on public.athlete_facts for select to authenticated
using ((select auth.uid()) = athlete_id);
```

Do not create athlete update/delete policies for immutable collections. Add a narrowly scoped `private.ensure_athlete_profile()` function or trigger that creates a profile idempotently without trusting email metadata for authorization.

- [ ] **Step 5: Apply locally and run foundation tests**

Run: `npx supabase@latest start && npx supabase@latest db reset --local && <project SQL test command>`

Expected: Migration applies, profiles bootstrap, cross-athlete reads return no rows, and fact mutation is rejected.

- [ ] **Step 6: Commit**

Run: `git add supabase && git commit -m "add Supabase foundation schema"`

### Task 2: Add immutable plan and generation schema

**Files:**
- Create: `supabase/migrations/<timestamp>_plans.sql`
- Create: `supabase/tests/plans.sql`

- [ ] **Step 1: Write failing tests for plan isolation, one active version, and immutability**

Cover a plan, session, block, and prescription fixture. Assert that one athlete cannot see another athlete plan; a second active plan for the same athlete fails; and updates/deletes on published plan descendants fail.

- [ ] **Step 2: Create the plans migration through the CLI**

Run: `npx supabase@latest migration new plans`

Expected: A new timestamped migration exists.

- [ ] **Step 3: Implement shared catalog and private jobs**

Create `public.exercise_catalog` with published/read-only catalog content. Create `private.plan_generation_jobs` with athlete ID, questionnaire ID, status, idempotency key, versioned input/output JSONB, safety result, attempts, and sanitized errors. Revoke public browser roles from `private`.

- [ ] **Step 4: Implement immutable plan hierarchy and atomic publication**

Create `public.training_plans`, `public.plan_sessions`, `public.plan_blocks`, and `public.plan_block_exercises` with foreign keys, ordered-position constraints, `(athlete_id, version_number)` uniqueness, and a partial unique active-plan constraint. Expose a private transactional publication function with this invariant:

```sql
-- within one transaction:
update public.training_plans
set status = 'superseded'
where athlete_id = p_athlete_id and status = 'active';

insert into public.training_plans (..., status, version_number)
values (..., 'active', next_version);
```

Restrict athlete access to select-only published plans. Enforce immutability with a trigger that rejects update/delete once `published_at is not null`.

- [ ] **Step 5: Apply and verify**

Run: `npx supabase@latest db reset --local && <project SQL test command>`

Expected: The plan hierarchy accepts valid ordered data, allows one active version, and rejects mutations after publishing.

- [ ] **Step 6: Commit**

Run: `git add supabase && git commit -m "add immutable training plans"`

### Task 3: Add activity, media, Storage, and import-receipt schema

**Files:**
- Create: `supabase/migrations/<timestamp>_activity_media.sql`
- Create: `supabase/tests/activity_media.sql`

- [ ] **Step 1: Write failing tests for activity ownership, Storage path isolation, and retry receipts**

Assert that athletes cannot create activity against another athlete's plan/session, cannot select or insert a Storage object outside their UUID prefix, and duplicate `(athlete_id, source_schema, payload_hash)` receipts conflict safely.

- [ ] **Step 2: Create migration and model activity**

Run: `npx supabase@latest migration new activity_media`

Create `public.session_runs`, `public.session_block_progress`, and `public.session_logs`. Add check constraints for RPE/pump/pain/energy ranges, non-negative attempt counts and durations, and same-athlete foreign-key ownership enforced by composite keys or trigger validation.

- [ ] **Step 3: Model media and analysis history**

Create `public.video_assets` and append-only `public.video_analyses`. Store object path, checksum, MIME type, byte size, duration, upload/processing states, optional run reference, versioned metrics/advice JSONB, and sanitized failures. Create `public.import_receipts` with unique `(athlete_id, source_schema, payload_hash)`.

- [ ] **Step 4: Create private bucket and complete policies**

Create bucket `climbing-videos` as private. Add storage policies for `select`, `insert`, `update`, and `delete` requiring:

```sql
bucket_id = 'climbing-videos'
and (storage.foldername(name))[1] = (select auth.uid()::text)
```

Use the equivalent `with check` condition for writes. Verify upsert has select, insert, and update permissions.

- [ ] **Step 5: Apply and run tests**

Run: `npx supabase@latest db reset --local && <project SQL test command>`

Expected: ownership, metric constraints, idempotent receipts, and all four Storage operations behave as specified.

- [ ] **Step 6: Commit**

Run: `git add supabase && git commit -m "add activity and media schema"`

### Task 4: Build the authenticated cloud client and repository contracts

**Files:**
- Create: `src/features/cloud/cloud-types.ts`
- Create: `src/features/cloud/cloud-client.ts`
- Create: `src/features/cloud/cloud-repository.ts`
- Create: `src/features/cloud/cloud-repository.test.ts`
- Modify: `src/features/auth/auth-client.ts`

- [ ] **Step 1: Write repository contract tests against a fake query client**

Test these explicit contracts:

```ts
await repository.ensureProfile();
await repository.submitQuestionnaire({ version: 2, answers, idempotencyKey });
await repository.listActivePlan();
await repository.startSessionRun({ planSessionId });
await repository.appendSessionLog({ runId, metrics });
```

Assert each write includes no caller-supplied athlete ID; the repository derives identity from the authenticated Supabase session.

- [ ] **Step 2: Implement narrow client creation**

`cloud-client.ts` must accept the existing `AuthConfig`, construct one Supabase client, and return `null` when configuration is absent. It must not accept or expose a service-role key.

- [ ] **Step 3: Implement typed repository operations**

Use the authenticated client and database DTOs. `ensureProfile` invokes the safe bootstrap RPC; normal athlete reads/writes use RLS-protected public tables. Map database failures to stable application errors without returning raw SQL/provider details to the UI.

- [ ] **Step 4: Run focused tests and static checks**

Run: `npm test -- --run src/features/cloud/cloud-repository.test.ts && npm run typecheck`

Expected: all repository contracts pass and TypeScript has no errors.

- [ ] **Step 5: Commit**

Run: `git add src/features/cloud src/features/auth/auth-client.ts && git commit -m "add cloud data repository"`

### Task 5: Build the deterministic local import boundary

**Files:**
- Create: `supabase/functions/import-local-data/index.ts`
- Create: `src/features/cloud/cloud-import.ts`
- Create: `src/features/cloud/cloud-import.test.ts`
- Modify: `src/features/user-data/user-data-export.ts`
- Modify: `src/features/user-data/user-data-storage.ts`

- [ ] **Step 1: Write failing import tests**

Given a schema-3 envelope fixture, assert canonicalization produces the same SHA-256 payload hash independent of key order; a completed receipt returns success without re-inserting; and malformed, mismatched-user, or unsupported-envelope payloads are rejected before any import side effect.

- [ ] **Step 2: Implement browser canonicalization and recovery state**

Serialize a stable envelope containing facts, logs, guided state, and video metadata but no binary blobs or object URLs. Calculate SHA-256 with `crypto.subtle.digest`. Store only a local import-status marker after the server reports verified completion; leave the legacy keys unchanged.

- [ ] **Step 3: Implement the authenticated Edge Function**

Require a valid bearer JWT and derive `athlete_id` from it. Do not accept it from the body. First insert or read the receipt by `(athlete_id, source_schema, payload_hash)`. In a transaction, validate IDs/ownership, import non-video records with deterministic source-ID mapping, record counts, and set status to `metadata_imported`. Return explicit pending video IDs for staged upload.

- [ ] **Step 4: Add video-stage completion behavior**

After client uploads missing blobs, call the function with the same receipt and verified video checksums. The function confirms owned Storage objects, writes/updates safe metadata, and marks the receipt `completed`. Repeated calls are no-ops.

- [ ] **Step 5: Run focused checks**

Run: `npm test -- --run src/features/cloud/cloud-import.test.ts src/features/user-data/user-data-export.test.ts && npx supabase@latest functions serve import-local-data --no-verify-jwt`

Expected: deterministic test pass; function loads locally with development JWT verification explicitly disabled only for local serving.

- [ ] **Step 6: Commit**

Run: `git add supabase/functions/import-local-data src/features/cloud src/features/user-data && git commit -m "add idempotent cloud import"`

### Task 6: Build private video upload and analysis persistence

**Files:**
- Create: `src/features/cloud/cloud-video.ts`
- Create: `src/features/cloud/cloud-video.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing video lifecycle tests**

Verify `videoPath(userId, videoId, fileName)` always returns `{userId}/{videoId}/original.<safe-extension>` and rejects empty IDs or unsupported extensions. Verify a failed upload leaves an explicit pending metadata state and a retry reuses the same video ID/path.

- [ ] **Step 2: Implement safe Storage upload**

Generate a UUID video ID client-side, derive the object path from the authenticated user, calculate a checksum, upload with the authenticated client, then persist `video_assets` metadata. Never construct a public URL for the private bucket; request a short-lived signed URL only when playback needs one.

- [ ] **Step 3: Persist append-only analyses**

Create a new `video_analyses` row for every analysis attempt/version. Do not overwrite prior rows. Map existing manual video metrics/advice UI data into the versioned payload.

- [ ] **Step 4: Replace IndexedDB as the primary video store**

Modify only the video persistence seams in `App.tsx`; keep existing local blobs as temporary recovery data until the corresponding cloud upload verifies. Show recoverable upload state rather than silently dropping the file.

- [ ] **Step 5: Run focused checks**

Run: `npm test -- --run src/features/cloud/cloud-video.test.ts && npm run typecheck`

Expected: deterministic paths, retry semantics, and types pass.

- [ ] **Step 6: Commit**

Run: `git add src/App.tsx src/features/cloud && git commit -m "store climbing videos in Supabase"`

### Task 7: Implement the rules-first generator boundary

**Files:**
- Create: `supabase/functions/generate-plan/index.ts`
- Create: `supabase/functions/generate-plan/rules.ts`
- Create: `supabase/functions/generate-plan/schema.ts`
- Create: `supabase/functions/generate-plan/rules.test.ts`
- Modify: `src/features/cloud/cloud-repository.ts`

- [ ] **Step 1: Write failing deterministic safety-rule tests**

Cover at least: current pain above the allowed threshold removes high finger-load work; low availability limits sessions per week; an unsupported exercise ID is rejected; and a fixed questionnaire snapshot produces the same rule result and ruleset version.

- [ ] **Step 2: Implement rule input/output schemas**

Define explicit versioned input and generated-plan schemas. The generated plan includes sessions, blocks, catalog exercise IDs, prescriptions, intensity, duration, cues, contraindications, and rationale. Reject unknown keys, invalid numeric ranges, missing required recovery, or exercises absent from the published catalog.

- [ ] **Step 3: Implement job creation and deterministic safety evaluation**

The function derives identity from the JWT, creates/reuses a private job by idempotency key, loads only the athlete's submission and published catalog, evaluates rules, and stores a sanitized versioned safety result. If rules reject the request, set a safe terminal status and return no plan.

- [ ] **Step 4: Implement a provider-neutral generation adapter**

Define:

```ts
export interface PlanGenerator {
  generate(input: ValidatedGenerationInput): Promise<unknown>;
}
```

Load the selected provider endpoint/key only from Edge Function secrets. Until the user selects a provider, return a clear non-publishing `provider_not_configured` job state after deterministic rules pass; do not fabricate a plan or use a Vite variable.

- [ ] **Step 5: Validate and publish atomically**

Validate the adapter output against the strict schema, then invoke the private publication function. On timeout, invalid output, or database failure, preserve the prior active plan and record a sanitized retryable error.

- [ ] **Step 6: Run function tests**

Run: `deno test supabase/functions/generate-plan/rules.test.ts && npx supabase@latest functions serve generate-plan --no-verify-jwt`

Expected: safety tests pass; local function starts; no provider secret appears in output.

- [ ] **Step 7: Commit**

Run: `git add supabase/functions/generate-plan src/features/cloud/cloud-repository.ts && git commit -m "add safe plan generation boundary"`

### Task 8: Switch the app to cloud-primary persistence

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/AppRoot.tsx`
- Modify: `src/App.tsx`
- Modify: `src/features/auth/AuthGate.tsx`
- Modify: `src/features/user-data/user-data-integration.test.tsx`
- Create: `src/features/cloud/cloud-integration.test.tsx`

- [ ] **Step 1: Write failing authenticated integration tests**

Prove that signed-out users cannot load tracker data; an authenticated user receives a cloud profile; first use offers/retries cloud import without deleting local recovery data; and a subsequent reload reads the active cloud plan/activity rather than treating local storage as canonical.

- [ ] **Step 2: Provide the cloud repository after auth initializes**

Create the configured client once at the application root. Do not render cloud-backed app data until Auth initialization succeeds and `ensureProfile` completes. Preserve the existing missing-configuration screen.

- [ ] **Step 3: Replace primary write paths**

Route questionnaire submission, fact append, session start/progress/completion, logs, active plan reads, video metadata, and video analyses through the repository. Keep local envelope parsing/export only for migration/recovery until a later explicit cleanup feature.

- [ ] **Step 4: Add loading and recoverable failures**

Display Spanish loading, retry, import-pending, generation-pending, and upload-pending states. Never discard in-memory form/activity data after a failed remote write; offer a retry with the same idempotency key.

- [ ] **Step 5: Run integration, build, and browser verification**

Run: `npm test -- --run src/features/cloud/cloud-integration.test.tsx src/features/user-data/user-data-integration.test.tsx && npm run typecheck && npm run build && npm run test:e2e`

Expected: all commands pass. The browser suite uses a deterministic authenticated adapter and does not require live credentials.

- [ ] **Step 6: Commit**

Run: `git add src && git commit -m "make Supabase primary data store"`

### Task 9: Verify the remote project and document operations

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Create: `docs/supabase-operations.md`

- [ ] **Step 1: Add non-secret operator documentation**

Document authentication redirect configuration, email SMTP requirements, local Supabase commands, migration application process, Edge Function secret names, private bucket behavior, import recovery, and provider configuration without including real values.

- [ ] **Step 2: Apply migrations to the connected Supabase project only after local verification**

Run the current CLI's documented link/push commands after checking `--help`. Confirm target project reference before pushing. Apply migrations once and record the resulting migration list.

- [ ] **Step 3: Run remote security and performance checks**

Run the available Supabase advisor command or dashboard equivalent. Inspect tables, grants, RLS policies, exposed views, functions, and `storage.objects` policies. Fix every relevant warning before declaring completion.

- [ ] **Step 4: Perform two-user smoke verification**

Use two non-production test accounts. Verify profile isolation, plan isolation, forbidden direct plan creation, private video isolation, idempotent import retry, immutable published plans, and activity persistence.

- [ ] **Step 5: Commit documentation**

Run: `git add README.md .env.example docs && git commit -m "document Supabase operations"`

## Final verification

- [ ] Run `npx supabase@latest db reset --local` and the complete SQL/RLS suite.
- [ ] Run `npm test -- --run`.
- [ ] Run `npm run typecheck`.
- [ ] Run `npm run build`.
- [ ] Run `npm run test:e2e`.
- [ ] Run Supabase security/performance advisors and review every exposed policy/function/Storage rule.
- [ ] Review the full branch diff for credential leakage, unscoped queries, missing `select` policy for updates, and mutable published records.
