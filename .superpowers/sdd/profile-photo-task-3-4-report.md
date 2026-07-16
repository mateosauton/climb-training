# Tasks 3–4 report: profile photo UI and navigation

Status: DONE

## Outcome

- Added an accessible reusable profile-photo picker for JPEG, PNG, and WebP files up to 5 MiB.
- Added circular preview, replacement, invalid-file feedback, and object URL cleanup.
- Added avatar upload before onboarding completion. The dialog remains open and exposes an alert when upload or profile-path persistence fails.
- Added avatar replacement from Profile and signed-avatar hydration.
- Propagated the real cloud avatar client from `main.tsx` through `AppRoot` to `App`.
- Replaced the generic sidebar identity with signed avatar/fallback, athlete name, and current → target grade.
- Made the avatar the only primary access button for Profile, while preserving internal `goToTab("profile")` navigation.
- Removed Profile from desktop and mobile primary tabs; mobile navigation now has four columns.

## TDD evidence

### RED

Command:

`npm test -- --run src/features/profile/ProfilePhotoPicker.test.tsx src/features/user-data/user-data-integration.test.tsx`

Observed failures:

- `ProfilePhotoPicker` import did not exist.
- Sidebar did not expose athlete identity/avatar navigation.
- Profile was still present as a primary tab.

After adding the cloud integration test, the onboarding test also exercised the missing upload-before-close behavior and failure alert.

### GREEN

Focused command:

`npm test -- --run src/features/profile/ProfilePhotoPicker.test.tsx src/features/user-data/user-data-integration.test.tsx src/features/cloud/cloud-integration.test.tsx`

Result: 3 files passed, 18 tests passed.

Full command:

`npm test -- --run`

Result: 32 files passed, 191 tests passed.

Build command:

`npm run build`

Result: passed. Vite retained the pre-existing chunk-size advisory for the main bundle.

Additional check: `git diff --check` passed.

## Files

- `src/features/profile/ProfilePhotoPicker.tsx`
- `src/features/profile/ProfilePhotoPicker.test.tsx`
- `src/App.tsx`
- `src/AppRoot.tsx`
- `src/main.tsx`
- `src/features/cloud/cloud-integration.test.tsx`
- `src/features/user-data/user-data-integration.test.tsx`
- `src/features/user-data/user-data-export-ui.test.tsx`
- `e2e/user-data.spec.ts`

## Commits

- `4d2b560 add profile photo UI`

## Self-review

- Upload uses the authenticated athlete ID, then persists the returned path, then loads the signed URL.
- Onboarding state closes only after the avatar workflow succeeds; failure leaves both the selected file and dialog available for retry.
- Object URLs are revoked on replacement and unmount.
- Avatar storage paths are never rendered directly as public URLs.
- Existing tests that navigated through the removed primary Profile tab now use the accessible avatar button.
- No SQL, repository, or cloud-avatar service implementation was changed.

## Concerns

- The production build reports the repository's existing bundle-size advisory (`~891 kB` main JS before gzip); this task does not materially address code splitting.
- E2E source was updated for the new navigation, but browser E2E was not run; the complete Vitest suite and production build passed.

## Reviewer follow-up: picker operability

Addressed all important review findings:

- Replaced the label-based visible control with a native `button` that activates the hidden input through a ref.
- Reset the file input value after every valid selection so the same file/name can be selected again.
- Clear the previous avatar upload error whenever a new valid file is selected from onboarding or Profile.
- Reworked replacement/cleanup coverage to use actual file uploads and added keyboard and same-file reselection coverage.

RED command:

`npm test -- --run src/features/profile/ProfilePhotoPicker.test.tsx src/features/cloud/cloud-integration.test.tsx`

RED result: 3 expected failures: no visible button role, same-file callback fired once instead of twice, and stale upload error remained visible.

GREEN command:

`npm test -- --run src/features/profile/ProfilePhotoPicker.test.tsx src/features/cloud/cloud-integration.test.tsx`

GREEN result: 2 files passed, 16 tests passed.
