# Sign In With Apple Design

## Summary

Add Sign in with Apple to the React/Vite tracker through Supabase Auth. The app remains local-first: Supabase authenticates the person and persists the browser session, while profile facts, session logs, guided runs, and video analyses stay on the device. The authenticated Apple subject selects one local user record, preventing the UI from exposing another signed-in user's data on a shared browser.

## Goals

- Require an authenticated Apple session before rendering training data.
- Restore valid sessions across reloads and support explicit sign-out.
- Associate each Apple subject with one stable local user record.
- Preserve the existing anonymous user's data when the first Apple account signs in.
- Create an empty local record for a later Apple account on the same browser.
- Keep Supabase secrets and Apple signing material out of the client and repository.
- Provide automated coverage and operator setup instructions.

## Non-goals

- Cross-device data synchronization or a Supabase database.
- Password, email-link, or non-Apple identity providers.
- Account merging, deletion, or server-side authorization.
- Capturing Apple's full name; the OAuth flow does not expose it reliably, so the existing profile name remains authoritative.
- Treating browser storage as protection from someone with device or developer-tools access.

## Approaches considered

### Supabase OAuth flow (selected)

The SPA calls `signInWithOAuth({ provider: "apple" })`; Supabase handles Apple's authorization-code exchange and token validation, then redirects to the configured app URL. This adds one maintained browser dependency and avoids custom authentication infrastructure.

### Apple JS with Supabase ID-token exchange

This can capture the name returned during the first authorization, but it requires loading Apple's script, generating and correlating nonces, handling popup events, and maintaining more browser-specific code. The tracker already collects a profile name, so the extra complexity has little value.

### Direct Apple OAuth with Vercel Functions

Owning the callback, client-secret generation, token exchange, validation, and session cookies provides control but creates unnecessary security and maintenance work for this SPA.

## Architecture

### Auth boundary

`src/features/auth/auth-client.ts` owns the narrow auth contract used by React. Its production adapter wraps a single `@supabase/supabase-js` client configured from `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Only the publishable browser key is accepted; service-role and secret keys are never used by the client.

`src/features/auth/AuthProvider.tsx` performs the initial `getSession`, subscribes to `onAuthStateChange`, and exposes `loading`, `user`, `error`, `signInWithApple`, and `signOut`. Subscription cleanup is mandatory. OAuth redirects back to `new URL(import.meta.env.BASE_URL, window.location.origin)` so production returns to `/escalada/` and local development returns to the Vite base URL.

`src/features/auth/AuthGate.tsx` has four states:

1. A neutral loading screen while the initial session resolves.
2. A configuration screen when either public environment variable is absent.
3. A Spanish sign-in card with the official black Apple-style action and a recoverable error message.
4. The application after a user exists.

The gate does not render `App` before authentication, so local data is not loaded into React for a signed-out visitor. User cancellation remains on the sign-in screen and is reported without destructive changes.

### Session identity

The existing local envelope advances from schema 2 to schema 3. `UserIdentity` gains:

```ts
type UserAuthIdentity = {
  provider: "apple";
  subject: string;
  email: string | null;
};

type UserIdentity = {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  auth: UserAuthIdentity | null;
};
```

The record ID remains an app-local ID; Apple's stable Supabase user ID is stored as `auth.subject`. Authorization decisions never use editable user metadata.

`src/features/auth/authenticated-user.ts` exports a pure reconciliation function:

- If a record already has the subject, make it active and refresh its stored email.
- If no record is bound and no record in the envelope has any auth identity, bind the current local record to the first authenticated Apple subject. This is the one-time anonymous-data claim.
- Otherwise create a fresh default user record bound to the new subject and make it active.
- Never copy facts, logs, guided history, or video metadata between records.

The function receives `now` and `makeId` so its behavior is deterministic in tests.

### Data migration and persistence

The canonical key becomes `climb4w.users.v3`. Loading follows this order:

1. Validate and return schema 3 when present.
2. If schema 2 is present, add `auth: null` to each identity, validate schema 3, save it under the v3 key, and leave the v2 source untouched for recovery.
3. Otherwise run the existing v1 migration and produce schema 3 directly.
4. Corrupt source data remains unchanged and produces the existing recoverable warning.

`App` receives the authenticated subject, reconciles the loaded envelope before first render, and saves the reconciled envelope. Switching accounts remounts `App` with the subject as its React key, ensuring no previous account state survives in component memory.

Video blob identifiers remain random and are reachable only through the active record's video metadata. Resetting data must delete only the active record's referenced blob IDs instead of clearing the entire object store, preserving other local accounts' videos.

### UI integration

`src/main.tsx` builds the auth client, renders `AuthProvider`, and supplies `AuthGate` with `App` keyed by the authenticated subject.

The existing sidebar footer shows the authenticated email when available, otherwise `Cuenta Apple`, plus a `Cerrar sesión` action. Sign-out errors remain visible and do not unmount the active app until Supabase confirms the session ended.

The theme preference remains device-wide. All user facts, logs, guided state, and video metadata remain inside the active schema-3 user record.

## Error handling

- Missing environment variables produce setup guidance rather than a runtime exception.
- Initial session failures show a retryable auth error and no training data.
- OAuth initiation failures stay on the sign-in screen.
- A callback or provider error is normalized into a short Spanish message; raw tokens and provider payloads are never displayed or logged.
- Local migration/save failures retain the current in-memory recovery behavior and preserve the source key.
- Sign-out failures keep the current session and data visible with an error message.

## Configuration and credentials

Repository configuration includes `.env.example` containing only:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

The operator must provide:

1. A Supabase project URL and publishable key from **Supabase Dashboard → Project Settings → API Keys**.
2. A paid Apple Developer membership with a primary App ID enabled for Sign in with Apple.
3. A Services ID from **Apple Developer → Certificates, Identifiers & Profiles → Identifiers**, associated with the primary App ID.
4. The production domain and Supabase callback URL registered on that Services ID. The callback is `https://<project-ref>.supabase.co/auth/v1/callback`.
5. A Sign in with Apple key (`.p8`), Key ID, Team ID, and Services ID entered directly into **Supabase Dashboard → Authentication → Providers → Apple**.
6. Local and production `/escalada/` URLs in the Supabase Auth redirect allow list.

The `.p8` file and generated Apple client secret must never be pasted into chat, stored in `.env`, or committed. Apple's OAuth client secret must be rotated at least every six months.

## Testing

### Unit tests

- Auth configuration accepts complete public variables and rejects missing values.
- OAuth uses provider `apple` and the `/escalada/` return URL.
- Session initialization, auth-state updates, unsubscribe, sign-out success, and errors behave deterministically through a fake auth adapter.
- User reconciliation reuses an existing subject, claims anonymous data once, creates an isolated later user, refreshes email, and never transfers event collections.
- Schema-2 data migrates to valid schema 3 without mutating or deleting the source.
- Schema-3 validation rejects malformed auth identities and duplicate Apple subjects.
- Reset deletes only active-user video blobs.

### Component and browser tests

- Loading and missing-configuration states do not render the tracker.
- The sign-in action invokes Apple OAuth once and exposes recoverable failures.
- An authenticated user sees the tracker, account label, and sign-out action.
- Signing out returns to the gate.
- An end-to-end test uses a deterministic injected auth adapter; live Apple credentials are not required in CI.

### Verification commands

```bash
npm test -- --run
npm run typecheck
npm run build
npm run test:e2e
```

## Delivery

Work is committed in small, concise changes on `feature/sign-in-with-apple`. The feature PR targets `dev` according to `docs/BRANCHING.md`; only a later `dev` promotion may target `main`. The PR documents the external Apple/Supabase setup as a deployment prerequisite and remains draft only if those external credentials prevent a live provider check.
