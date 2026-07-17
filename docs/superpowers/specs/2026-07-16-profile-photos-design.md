# Profile Photos Design

**Date:** 2026-07-16
**Status:** Approved

## Outcome

Add a persistent profile photo to onboarding and use the athlete identity in the sidebar header. The header shows the athlete photo, name, and current-to-target climbing grade. Profile is removed from primary navigation and opens only from the photo button.

## Data and security

- Add nullable `avatar_path` to `public.athlete_profiles`.
- Add a private `profile-photos` Storage bucket restricted to supported image MIME types and a conservative file-size limit.
- Store each image under `{athlete_id}/avatar.<extension>`.
- Storage RLS allows authenticated athletes to select, insert, update, and delete only objects whose first path segment matches `auth.uid()`.
- Persist only the object path in PostgreSQL. Render it through a short-lived signed URL.

## User experience

- Onboarding includes an image picker with circular preview, replace action, supported-format guidance, and validation feedback.
- The selected image uploads when the questionnaire is submitted. Upload failure keeps onboarding open and preserves the local preview so the athlete can retry.
- The sidebar identity block displays the signed image when available and initials otherwise, plus profile name and climbing grade.
- The avatar itself is an accessible button labeled to open the athlete profile.
- Remove Profile from the primary sidebar navigation. Internal links may still open Profile because training flows depend on them.
- The profile form also allows replacing the photo after onboarding.

## Architecture

- Keep Storage operations in a focused cloud avatar module with upload, signed-URL, and deletion behavior.
- Extend the cloud profile projection/repository with `avatar_path` without putting signed URLs into persistent state.
- Keep temporary file and preview URL state in the React UI.
- Upload the object first, then persist the resulting path with the profile submission. If the database update fails, report the failure and allow a retry using the same deterministic object path.

## Validation and errors

- Accept JPEG, PNG, and WebP images up to 5 MB.
- Revoke browser object-preview URLs when replaced or unmounted.
- Use initials when no image exists, signing fails, or the signed URL expires before refresh.
- Surface upload/save failures with an actionable inline alert and do not mark onboarding complete.

## Testing

- Unit-test object path construction, file validation, upload, signed URL creation, and error propagation.
- Component-test onboarding selection/preview/submission and sidebar avatar navigation.
- SQL-test bucket configuration and owner-only Storage policies.
- Run the complete unit suite, typecheck, build, and focused browser tests.
