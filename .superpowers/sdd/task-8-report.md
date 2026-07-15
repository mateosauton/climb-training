# Task 8 report

Implemented cloud-primary bootstrap without changing Supabase generators or video/import internals.

- Created the cloud client/repository once at the entry point and pass it through `AppRoot`.
- Authenticated users now wait for profile creation and active-plan loading; failures keep the tracker unavailable with a Spanish retry action.
- Kept local data as recoverable migration/import input, with explicit Spanish import-pending and retry states.
- Questionnaire submission saves verified local recovery state first, then uses the cloud repository with a stable retry payload and idempotency key.
- Added integration coverage for signed-out isolation, cloud bootstrap/loading/retry, recoverable import retry, and questionnaire persistence.

Verified:

- `npm test -- --run src/features/cloud/cloud-integration.test.tsx src/features/user-data/user-data-integration.test.tsx`
- `npm run typecheck`
- `npm run build`
- `npm run test:e2e`
