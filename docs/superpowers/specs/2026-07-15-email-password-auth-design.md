# Email and Password Authentication Design

## Goal

Replace the unreleased Sign in with Apple flow with Supabase email and password authentication so users can create an account, verify their email, sign in, recover a forgotten password, and retain the local climbing data associated with their Supabase user ID.

## Scope

The feature includes account creation, email confirmation messaging, sign-in, sign-out, password-reset email requests, password updates after a recovery link, authenticated local-data reconciliation, configuration guidance, automated tests, and pull-request delivery to `dev`.

The feature does not include Apple OAuth, social login, custom SMTP provisioning, server-side rendering, multi-factor authentication, or a remote database migration. Climb Training remains a client-only Vite application and continues to store training data locally.

## Supabase Integration

The browser uses `@supabase/supabase-js` with these uncommitted Vite variables:

```text
VITE_SUPABASE_URL=https://romannlfmjkukbypkrqw.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
```

The client exposes narrow operations rather than the raw Supabase client:

- `getSession()` and `onAuthStateChange()` maintain session state.
- `signUp(email, password, redirectTo)` creates an account and requests email confirmation.
- `signInWithPassword(email, password)` creates a session for a verified account.
- `resetPasswordForEmail(email, redirectTo)` sends a recovery link.
- `updatePassword(password)` completes recovery after Supabase establishes the recovery session.
- `signOut()` ends the session.

The supplied key is a public publishable key, but it is still kept out of Git. No service-role or secret key is used in the browser.

## Authentication State

`AuthProvider` owns the initial session lookup and exactly one auth-state subscription. It exposes configuration, loading state, the mapped user, a sanitized error, pending action state, recovery mode, and the narrow auth actions.

Supabase emits `PASSWORD_RECOVERY` when a valid recovery link returns to the application. The provider enters recovery mode and keeps the authenticated recovery session available only long enough for the user to set a new password. A successful update leaves recovery mode and shows the authenticated application. Subscription cleanup and late-result guards remain mandatory.

Raw tokens and raw provider errors are never rendered or logged. The UI maps failures to stable Spanish messages while retaining enough distinction for invalid credentials, weak passwords, rate limits, and expired recovery links.

## User Interface

`AuthGate` keeps authenticated application content inaccessible until initialization succeeds. Its signed-out surface has three explicit modes:

1. **Sign in:** email and password fields, submit button, link to account creation, and “forgot password” action.
2. **Create account:** email and password fields, password confirmation, submit button, and a success message instructing the user to verify their inbox.
3. **Request recovery:** email field, submit button, and a non-enumerating success message whether or not the address exists.

Recovery-link sessions render a fourth mode with new-password and confirmation fields. Forms use semantic labels, native email/password attributes, disabled pending controls, `aria-live` status text, and `role="alert"` errors. Password validation requires at least eight characters and matching confirmation before calling Supabase.

## Redirects and Email Delivery

Confirmation and recovery redirects return to `new URL(import.meta.env.BASE_URL, window.location.origin)`, preserving both local Vite routing and the production `/escalada/` base path. The exact local and production URLs must be allow-listed under Supabase Authentication URL Configuration.

Hosted Supabase projects require email verification by default. The bundled trial mailer is suitable only for development because it is best-effort and limited to two messages per hour; production readiness requires custom SMTP configuration outside this code change.

## Local Data Identity

The stable identity remains the Supabase Auth user ID, not the email address. Existing schema-3 identity metadata is generalized from the unreleased Apple label to:

```ts
type UserAuthIdentity = {
  provider: "supabase";
  subject: string;
  email: string | null;
};
```

Reconciliation matches `subject` first, activates the matching local user, and updates its current email. If no subject matches, it may bind the current unclaimed local profile; otherwise it creates an isolated local profile. Email is display metadata and is never used as the ownership key.

Because the Apple implementation has not been merged, its Apple-specific schema does not require a production migration. Tests cover legacy pre-auth data plus the generalized schema-3 record.

## Testing

Automated coverage includes:

- Supabase adapter argument mapping and sanitized results.
- Provider initialization, auth event handling, recovery mode, cleanup, and each action.
- Sign-in, sign-up, confirmation, reset request, recovery update, validation, loading, error, and configured/unconfigured UI states.
- Stable-subject local-data reconciliation and schema validation.
- An authenticated integration path proving tracker data is inaccessible while signed out.
- Full unit tests, type checking, linting, production build, and existing end-to-end tests.

Live email delivery cannot be fully automated without project mailbox access. The PR documents a manual smoke test covering confirmation and password recovery after deployment configuration.

## Delivery

Work continues on `feature/email-password-auth`, the prefix required by repository CI for pull requests into `dev`. The obsolete Apple draft PR is replaced by a concise ready PR targeting `dev`, which is the repository-permitted integration branch. The PR contains only a short summary and commands run.

## References

- [Supabase password-based authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase email templates](https://supabase.com/docs/guides/auth/auth-email-templates)
- [Supabase JavaScript Auth reference](https://supabase.com/docs/reference/javascript/auth-signinwithpassword)
