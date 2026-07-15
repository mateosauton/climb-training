# Task 5 report

## Delivered

- Added a deterministic schema-3 browser import boundary with recursive key-order canonicalization and SHA-256 hashing.
- Added strict client-side envelope and optional authenticated-identity mismatch rejection before the Edge Function is invoked.
- Added an idempotent completion marker at `climb4w.cloud-import.v1`; existing v1, v2, and v3 recovery data is never changed.
- Added the authenticated `import-local-data` Edge Function. It validates the bearer JWT with Supabase Auth, derives the athlete ID only from that JWT, validates the envelope/hash before database effects, claims/reuses receipts, imports facts/logs, stages video metadata completion only after owner-prefixed Storage objects exist, and makes completed receipts no-ops.
- No credentials or secrets were committed. The Edge Function reads standard Supabase environment variables at runtime.

## Verification

- `npm test -- --run src/features/cloud/cloud-import.test.ts src/features/user-data/user-data-export.test.ts` — passed (9 tests).
- `npm run typecheck` — passed.
- `npm run build` — passed (existing chunk-size warning only).
- `npx supabase@latest functions serve import-local-data --no-verify-jwt` — could not start because Docker Desktop is not available in this environment. The command uses `--no-verify-jwt` only for the requested local-serving check; production code independently validates the bearer token.

## Scope

- No App/UI integration was added.
- Concurrent `cloud-video` workspace changes were intentionally excluded from the Task 5 commit.

## Review follow-up

- Replaced multi-request receipt handling with receipt-row locking and a single trusted database function, so metadata writes, deterministic source-ID mapping, fact supersession resolution, guided-run mapping, and receipt state transition are atomic.
- Empty-video imports now transition directly to `completed`, allowing the existing client completion marker to persist immediately.
- Video completion uses the established `{athlete}/{videoId}/original.<extension>` path and hashes the downloaded private object server-side; request checksums are ignored.
- Added SQL coverage for atomic retry behavior, supersession mapping, and persisted guided-run mapping.
