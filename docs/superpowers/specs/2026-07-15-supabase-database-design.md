# Supabase Database Design

**Date:** 2026-07-15
**Status:** Approved for implementation planning
**Scope:** Supabase-primary persistence for independent athletes authenticated with email and password.

## Outcome

Replace browser-local persistence with a secure Supabase data layer. Each authenticated athlete owns an isolated profile, immutable questionnaire and fact history, versioned generated training plans, training activity, and private climbing videos. A one-time idempotent import preserves existing local data.

The database must support a hybrid plan generator: deterministic rules enforce safety and load constraints, while AI personalizes the plan within those bounds. Published plan versions are immutable so completed sessions always retain their original prescription and context.

## Current context

The React/Vite application currently stores a schema-3 user envelope in `localStorage` and video blobs in IndexedDB. The envelope contains identity metadata, immutable profile facts, session logs, guided-session history, and video-analysis metadata. A separate feature branch implements Supabase email/password signup, email verification, sign-in, password recovery, password updates, and sign-out.

The connected Supabase project uses PostgreSQL 17.6. Its `public` schema contains no application tables or policies, so the application schema can be introduced without reconciling existing public data.

## Goals

1. Make Supabase the primary source of athlete data.
2. Isolate every athlete through Supabase Auth and row-level security.
3. Preserve immutable questionnaire, profile-fact, and plan-version history.
4. Generate individualized plans from onboarding data through a rules-and-AI pipeline.
5. Store climbing videos privately in Supabase Storage.
6. Import existing local data exactly once without loss or duplication.
7. Support reliable activity tracking, analysis history, and future reporting.
8. Keep credentials, privileged functions, and generation internals out of the browser.

## Non-goals

- Coach, team, administrator, or shared-athlete access in the first version.
- Athlete-authored or manually edited training plans in the first version.
- Using email addresses as ownership keys.
- Mutable published plans.
- Storing passwords, confirmation tokens, recovery tokens, or sessions in application tables.
- Exposing AI credentials or Supabase secret/service-role keys to the client.
- Treating AI output as valid without deterministic safety checks and schema validation.

## Approaches considered

### Relational core with flexible snapshots — selected

Use normalized tables for ownership, plan structure, activity, media, and operational state. Preserve questionnaire answers, generation inputs, and selected analysis payloads as versioned, validated `jsonb`. This balances strong integrity and queryability with flexibility while the questionnaire and generator evolve.

### Fully normalized

Represent every questionnaire field, prescription attribute, and generation decision relationally. This improves narrow analytical queries but makes early product changes migration-heavy and couples the database too tightly to unstable generator output.

### Document-oriented mirror

Store most of the current local envelope in one `jsonb` row per athlete. This is easy to import but weak for concurrency, granular RLS, plan immutability, reporting, and media lifecycle management.

## Architecture and trust boundaries

The Supabase Auth UUID is the canonical athlete ID. Email is mutable contact/display metadata and is never used in foreign keys, ownership checks, or RLS policies.

The system has three persistence boundaries:

- `public`: athlete-facing application tables exposed through the Supabase Data API. Every athlete-owned table has RLS enabled.
- `private`: generation jobs, rule evaluations, AI provenance, privileged functions, and operational details. Browser roles receive no access.
- Supabase Storage: a private `climbing-videos` bucket whose objects use `{athlete_id}/{video_id}/...` paths.

A trusted server endpoint coordinates plan generation and privileged imports. It validates the authenticated user, creates private jobs, applies deterministic rules, calls the AI provider, validates generated output, and publishes plans atomically. AI credentials and elevated Supabase credentials remain server-side.

## Authentication and profile lifecycle

Supabase Auth owns signup, email verification, password login, password recovery, password updates, sessions, and sign-out. Application tables never copy authentication secrets.

`public.athlete_profiles` contains one row per verified/authenticated account:

- `athlete_id uuid primary key references auth.users(id)`;
- display name and non-authentication preferences;
- onboarding state;
- optional active plan reference;
- creation and update timestamps.

The profile is created idempotently on the first authenticated application access or by a narrowly scoped database trigger. Email changes do not affect ownership or history.

## Questionnaire and immutable facts

`public.questionnaire_submissions` stores each completed form as an immutable snapshot:

- athlete ID;
- questionnaire and answer-schema versions;
- validated answers in `jsonb`;
- submission status and timestamp;
- client-generated idempotency key.

`public.athlete_facts` preserves the existing immutable fact model:

- athlete ID, category, key, typed `jsonb` value, and unit;
- recorded timestamp;
- source type, source field, and source version;
- optional `supersedes_id` pointing to an earlier fact owned by the same athlete.

Current profile values are projections of the newest valid fact in each category/key stream. Facts cannot be updated or deleted through athlete-facing APIs.

## Exercise catalog

`public.exercise_catalog` contains shared, system-managed exercise definitions:

- stable ID and content version;
- title, instructions, cues, contraindications, and safety guidance;
- equipment and movement tags;
- optional trusted media references;
- publication and retirement status.

Authenticated athletes may read published exercises. They cannot insert, update, or delete catalog records.

## Generation pipeline

`private.plan_generation_jobs` tracks:

- athlete and questionnaire submission IDs;
- idempotency key and lifecycle status;
- questionnaire/input snapshot;
- ruleset, prompt, model, and generator versions;
- deterministic rule results and safety validation;
- attempt count, timestamps, and sanitized error details;
- validated output before publication.

Generation follows this sequence:

1. An immutable questionnaire submission requests a plan.
2. The trusted endpoint creates or reuses a job by idempotency key.
3. Deterministic rules calculate safe load, availability constraints, exclusions, and required recovery.
4. AI personalizes structure, sequencing, cues, and rationale within the approved bounds.
5. Strict server validation rejects unknown exercises, unsafe loads, missing required fields, invalid schedules, and malformed output.
6. One transaction writes the complete next plan version and marks it active.

Failed jobs leave the prior active plan untouched. Partial output is never visible as a published plan.

## Immutable plan model

`public.training_plans` contains one row per athlete plan version:

- athlete ID and monotonically increasing version number;
- source questionnaire and generation-job references;
- generator, ruleset, prompt, model, and output-schema versions;
- status, rationale, safety result, and publication timestamp.

`public.plan_sessions` contains ordered scheduled sessions:

- plan and athlete IDs;
- stable position and schedule offset or date;
- phase, objective, intensity, expected duration, and recovery guidance.

`public.plan_blocks` contains ordered execution blocks within a session:

- block position, phase, title, instructions, duration, and completion rules.

`public.plan_block_exercises` contains ordered prescriptions:

- exercise-catalog reference and content version;
- sets, reps, duration, load, rest, cues, substitutions, and generator context.

Once published, a plan and its descendants cannot be updated or deleted. A new questionnaire or meaningful goal change creates a new version. Previous plans remain readable and continue to anchor historical activity.

Only one plan may be active for an athlete. Activation and publication occur in one transaction to avoid a missing or partially visible active plan.

## Training activity

`public.session_runs` records actual attempts against planned sessions:

- athlete, plan, and planned-session references;
- started, paused, completed, skipped, or abandoned state;
- start, end, and last-progress timestamps;
- readiness and completion summary.

`public.session_block_progress` records progress against individual planned blocks, including elapsed time, completion state, and athlete notes.

`public.session_logs` stores performance and recovery measurements such as RPE, pump, pain, attempts, moves, best link, foot cuts, pull weight, sleep, energy, and notes. Valid range constraints apply to every bounded metric.

Activity rows can be corrected by their owner where product behavior requires it, but corrections never mutate the referenced plan prescription.

## Videos and analyses

`public.video_assets` contains metadata for private Storage objects:

- athlete and optional session-run references;
- stable video ID and Storage object path;
- original filename, MIME type, byte size, duration, checksum, and upload status;
- creation, upload, and deletion timestamps.

`public.video_analyses` contains immutable analysis versions:

- athlete and video IDs;
- analysis version, method, analyzer/model version, and timestamp;
- structured metrics, advice, and athlete notes;
- processing status and sanitized error details.

New analysis never overwrites an earlier version.

The private bucket path begins with the authenticated UUID. Storage policies validate the first path segment for select, insert, update/upsert, and delete. Database metadata must reference a path owned by the same athlete.

## Local-to-cloud import

`public.import_receipts` records:

- athlete ID;
- source storage key and schema version;
- deterministic payload hash;
- import version, lifecycle status, counts, and timestamps;
- sanitized failure information.

A unique athlete/source/hash constraint turns repeated submissions into safe no-ops. Imported source IDs are retained or mapped deterministically so retries cannot duplicate facts, logs, guided history, analyses, or video metadata.

The schema-3 local envelope maps as follows:

- identity to `athlete_profiles`;
- facts to `athlete_facts`;
- session logs to imported session runs and logs;
- guided-session history to session runs and block progress;
- video metadata to `video_assets` and `video_analyses`;
- IndexedDB blobs to private Storage uploads.

Database records and video uploads use a resumable staged workflow because Storage uploads cannot participate in the same PostgreSQL transaction. Checksums and upload states make retries verifiable. Local data remains untouched as recovery data until cloud records and uploads are confirmed.

## Row-level security and grants

All athlete-owned public tables enable RLS. Owner policies compare the row's `athlete_id` with `(select auth.uid())`. Foreign keys and database validation ensure related plan, activity, video, analysis, and supersession records belong to the same athlete.

Policy behavior:

- `anon` receives no application-data access.
- `authenticated` reads and writes only permitted records owned by the current UUID.
- Questionnaire submissions, facts, published plan content, and analysis versions are append-only or read-only as appropriate.
- Athletes cannot directly create or publish generated plans.
- Exercise catalog access is authenticated read-only for published records.
- `private` grants nothing to `anon` or `authenticated`.
- Security-definer functions, if required, live only in `private`, set a safe `search_path`, and expose a narrow reviewed interface.

Views in exposed schemas use security-invoker behavior. No authorization decision uses user-editable metadata or email claims.

## Integrity, indexes, and conventions

- Primary IDs are UUIDs generated server-side.
- Timestamps use UTC `timestamptz`.
- Plan versions are unique by `(athlete_id, version_number)`.
- Session and block positions are unique within their parent.
- Fact supersession links are same-athlete and acyclic by application/database validation.
- Metric checks enforce valid ranges for pain, RPE, pump, sleep, energy, duration, attempts, and loads.
- Published plan immutability is enforced in the database, not only in the UI.
- `jsonb` payloads carry explicit schema versions and pass strict trusted-server validation before persistence.

Indexes support:

- athlete/time lookups for submissions, facts, plans, runs, videos, and analyses;
- current fact streams by athlete/category/key/time;
- active plan retrieval;
- scheduled and completed-session history;
- generation status and idempotency lookup;
- import receipt and upload-state lookup;
- video-analysis version history.

## Error behavior

| Condition | Behavior |
|---|---|
| Duplicate import request | Return the existing receipt; create no records. |
| Interrupted video import | Resume missing uploads after checksum/state verification. |
| Invalid questionnaire payload | Reject before creating a generation job. |
| Rules detect unsafe input | Record a safe failure and publish no plan. |
| AI timeout or malformed output | Retry within limits; retain the existing active plan. |
| Partial database publication | Roll back the transaction completely. |
| Cross-athlete identifier supplied | RLS and ownership constraints reject access. |
| Video object uploaded without final metadata | Mark or detect it for asynchronous orphan cleanup. |
| Analysis failure | Preserve the video and prior analyses; record a sanitized failure state. |

## Privacy and safety

Profile, injury, pain, body, recovery, performance, and video data are sensitive. The application must not log raw records, questionnaire answers, signed Storage URLs, access tokens, or AI payloads containing identifiable data.

Only the minimum required athlete context is sent to the AI provider. Prompt and output retention policies must be documented before production use. Safety rules remain deterministic and authoritative; generated advice cannot override pain limits, contraindications, or recovery requirements.

Account deletion requires a trusted workflow that removes private Storage objects and athlete-owned database records before removing the Auth user. It is not implemented implicitly through client-side cascading operations.

## Verification

### Database and migration tests

- A repeated import produces the same receipt and no duplicate records.
- Imported facts preserve values, sources, timestamps, and supersession history.
- Imported logs, guided history, analysis metadata, and videos remain linked to the correct athlete.
- Constraint tests reject invalid metrics, broken ownership, and invalid ordering.
- Published plan updates and deletes fail.

### Authorization tests

- Anonymous access returns no application data.
- Two authenticated test users can access only their own records and Storage prefixes.
- An athlete cannot insert or publish a plan directly.
- An athlete cannot read another UUID's profile, plan, activity, media metadata, or object.
- Exercise catalog reads include only published content.

### Generator tests

- Rule evaluation is deterministic for fixed inputs and versions.
- Unsafe inputs never reach publication.
- Generated output must match the strict schema and reference valid exercises.
- Idempotent retries do not create duplicate jobs or plan versions.
- Failed generation leaves the previous active plan unchanged.
- Publication is atomic and activates exactly one plan.

### Video tests

- Interrupted uploads resume safely.
- Checksums detect mismatched objects.
- Upsert policies require the complete Storage permission set.
- New analyses append versions instead of overwriting history.
- Orphan cleanup never deletes another athlete's objects.

### Operational verification

- Run Supabase database security and performance advisors after implementation.
- Inspect grants, RLS policies, exposed views, functions, and Storage policies.
- Verify migrations from a clean project and from representative local envelopes.
- Run the application unit, type, build, integration, and end-to-end suites.

## Implementation sequence

Implementation planning should order work as follows:

1. Establish local Supabase migration tooling and base schemas.
2. Add profile, questionnaire, facts, catalog, and RLS foundations.
3. Add immutable plan and generation-job structures.
4. Add activity tables and ownership constraints.
5. Add private Storage, video metadata, and analysis history.
6. Build and verify the staged idempotent importer.
7. Integrate the trusted hybrid generator and atomic publication flow.
8. Switch the application from local-primary persistence to Supabase-primary persistence.
9. Run authorization, migration, advisor, and full application verification.
