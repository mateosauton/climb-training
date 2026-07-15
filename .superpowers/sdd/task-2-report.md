# Task 2 report: immutable plan and generation schema

## Delivered files

- `supabase/migrations/20260715164304_plans.sql`
- `supabase/tests/plans.sql`

## Migration

Created with `npx supabase@latest migration new plans`:

- `20260715164304_plans.sql`

The migration adds the published exercise catalog, private generation jobs,
versioned training-plan hierarchy, RLS/select-only athlete access, publication
function, ordering and active-plan constraints, and published-content mutation
guards.

## Tests and results

- Wrote the pgTAP coverage first for plan isolation, the one-active-plan
  constraint, valid ordered hierarchy, and immutable published descendants.
- `git diff --check` — passed.
- `npx supabase@latest test db --local supabase/tests/plans.sql` — blocked:
  the local Postgres container could not be reached because the Docker daemon is
  unavailable.
- `npx supabase@latest db reset --local && npx supabase@latest test db --local supabase/tests/foundation.sql supabase/tests/plans.sql` — blocked for the same Docker-daemon condition.

## Blockers

Docker Desktop/the Docker daemon must be started to reset the local database and
run the pgTAP suite.

## Self-review

- The foundation migration was not modified.
- No frontend files or secrets were changed.
- Private schema access is revoked from browser roles; private functions use an
  empty search path and fully qualified relations.
- Published plan content and every descendant reject direct updates/deletes. The
  private publication function has the narrowly scoped status-only exception it
  needs to supersede the prior active plan atomically before inserting the next
  active version.

## Review fixes

- Granted `service_role` only `USAGE` on `private`, CRUD access to
  `private.plan_generation_jobs`, and execute access to the private publication
  function. Browser roles retain no private-schema access; the new plan tables
  are also explicitly revoked from `anon`.
- Prevented inserts of sessions, blocks, and prescriptions below a published
  plan, so a published plan cannot gain descendants after publication.
- Changed the exercise catalog key to `(id, content_version)`, allowing content
  revisions while prescriptions retain an exact versioned reference.
- Added triggers that require a generation job's questionnaire, and a plan's
  questionnaire/job sources, to belong to the plan athlete; a plan's two source
  references must also agree with each other.
- Expanded pgTAP coverage for publication/status transitions, private access,
  read-only catalog permissions, descendant RLS isolation, append prevention,
  content versions, and source ownership rules.

## Review-fix verification

- `git diff --check` — passed.
- `rg -n "select (is|ok|throws_ok)\\(" supabase/tests/plans.sql | wc -l` — 21
  planned assertions, matching `select plan(21)`.
- `docker info` — Docker daemon unavailable (`exit 1`).
- `npx supabase@latest test db --local supabase/tests/plans.sql` — blocked:
  local Postgres could not be reached.
- `npx supabase@latest test db --local supabase/tests/foundation.sql supabase/tests/plans.sql`
  — blocked for the same Docker-daemon condition.
