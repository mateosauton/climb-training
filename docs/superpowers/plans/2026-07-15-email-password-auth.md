# Email and Password Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the unreleased Apple OAuth flow with complete Supabase email/password authentication and publish a verified pull request to `dev`.

**Architecture:** Keep Supabase behind a narrow auth-client adapter, let `AuthProvider` own session and recovery state, and let `AuthGate` own only form modes and local validation. Continue binding local training data to the immutable Supabase user ID, never to email.

**Tech Stack:** React 19, TypeScript, Vite, Supabase JS 2, Vitest, Testing Library, Playwright

---

## File map

- `src/features/auth/auth-client.ts`: typed Supabase adapter and sanitized error categories.
- `src/features/auth/auth-client.test.ts`: adapter mapping tests with a mocked Supabase client.
- `src/features/auth/AuthProvider.tsx`: session lifecycle, auth actions, feedback, and password-recovery state.
- `src/features/auth/AuthProvider.test.tsx`: provider lifecycle and action tests.
- `src/features/auth/AuthGate.tsx`: accessible email/password forms and authenticated gate.
- `src/features/auth/AuthGate.test.tsx`: user-visible auth-flow tests and validation.
- `src/features/auth/auth-config.ts`: provider-neutral redirect helper.
- `src/features/auth/auth-config.test.ts`: redirect helper regression test.
- `src/features/auth/e2e-auth-client.ts`: deterministic adapter conforming to the new interface.
- `src/features/auth/auth-integration.test.tsx`: signed-out isolation regression.
- `src/features/auth/authenticated-user.ts`: write generalized Supabase identity metadata.
- `src/features/auth/authenticated-user.test.ts`: authenticated identity expectations.
- `src/features/user-data/user-data-types.ts`: generalized identity type.
- `src/features/user-data/user-data-schema3.test.ts`: schema fixture expectations.
- `src/features/user-data/user-data-validation.ts`: validate generalized provider metadata.
- `README.md`, `.env.example`: email auth and deployment setup.
- Delete obsolete Apple design and implementation-plan documents after their replacement is complete.

### Task 1: Auth client contract and Supabase adapter

**Files:**
- Create: `src/features/auth/auth-client.test.ts`
- Modify: `src/features/auth/auth-client.ts`
- Modify: `src/features/auth/e2e-auth-client.ts`

- [ ] **Step 1: Write failing adapter tests**

Mock `createClient` and assert the adapter maps these exact calls without exposing tokens or raw user objects:

```ts
await client.signUp("user@example.com", "password1", "https://app.test/escalada/");
expect(auth.signUp).toHaveBeenCalledWith({
  email: "user@example.com",
  password: "password1",
  options: { emailRedirectTo: "https://app.test/escalada/" }
});

await client.signIn("user@example.com", "password1");
expect(auth.signInWithPassword).toHaveBeenCalledWith({
  email: "user@example.com",
  password: "password1"
});

await client.requestPasswordReset("user@example.com", "https://app.test/escalada/");
expect(auth.resetPasswordForEmail).toHaveBeenCalledWith(
  "user@example.com",
  { redirectTo: "https://app.test/escalada/" }
);

await client.updatePassword("new-password1");
expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-password1" });
```

Also assert `onAuthStateChange` forwards `PASSWORD_RECOVERY`, maps only `{id,email}`, unsubscribes, and maps provider codes to `invalid_credentials`, `weak_password`, `rate_limit`, `expired_link`, or `unknown`.

- [ ] **Step 2: Run the new test and verify RED**

Run: `npm test -- --run src/features/auth/auth-client.test.ts`

Expected: FAIL because the email/password methods and auth-event callback do not exist.

- [ ] **Step 3: Implement the minimal typed adapter**

Use this public contract:

```ts
export type AuthEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "USER_UPDATED" | "PASSWORD_RECOVERY";
export type AuthFailure = "invalid_credentials" | "weak_password" | "rate_limit" | "expired_link" | "unknown";
export type AuthActionResult = { error: AuthFailure | null };
export type AuthSessionResult = AuthActionResult & { session: AuthSession };

export interface AuthClient {
  getSession(): Promise<AuthSessionResult>;
  onAuthStateChange(callback: (event: AuthEvent, session: AuthSession) => void): () => void;
  signUp(email: string, password: string, redirectTo: string): Promise<AuthSessionResult>;
  signIn(email: string, password: string): Promise<AuthSessionResult>;
  requestPasswordReset(email: string, redirectTo: string): Promise<AuthActionResult>;
  updatePassword(password: string): Promise<AuthActionResult>;
  signOut(): Promise<AuthActionResult>;
}
```

Map Supabase sessions through the existing `toSession`. Map `error.code` and status without returning `error.message`. Update the E2E adapter with deterministic non-interactive implementations.

- [ ] **Step 4: Run adapter tests and verify GREEN**

Run: `npm test -- --run src/features/auth/auth-client.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/auth-client.ts src/features/auth/auth-client.test.ts src/features/auth/e2e-auth-client.ts
git commit -m "add email auth client"
```

### Task 2: Provider actions and recovery state

**Files:**
- Modify: `src/features/auth/AuthProvider.test.tsx`
- Modify: `src/features/auth/AuthProvider.tsx`

- [ ] **Step 1: Replace Apple tests with failing email-action tests**

Build the fake client from the Task 1 contract. Probe these values and actions:

```tsx
JSON.stringify({
  configured: auth.configured,
  loading: auth.loading,
  user: auth.user,
  error: auth.error,
  notice: auth.notice,
  busy: auth.busy,
  recoveryMode: auth.recoveryMode
})
```

Cover:

- `signIn(email,password)` calls the adapter and uses its returned session.
- `signUp` with a null session shows the confirmation notice.
- password-reset requests show the same non-enumerating success notice.
- `PASSWORD_RECOVERY` enters recovery mode.
- `updatePassword` exits recovery mode after success.
- repeated submissions are ignored while one action is pending.
- adapter failure categories map to stable Spanish text, never raw details.
- initialization races, unmount cleanup, and failed sign-out retain their existing coverage.

- [ ] **Step 2: Run provider tests and verify RED**

Run: `npm test -- --run src/features/auth/AuthProvider.test.tsx`

Expected: FAIL because the provider still exposes Apple OAuth state and actions.

- [ ] **Step 3: Implement provider state and actions**

Expose this context shape:

```ts
type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: AuthUser | null;
  error: string | null;
  notice: string | null;
  busy: boolean;
  recoveryMode: boolean;
  signIn(email: string, password: string): Promise<boolean>;
  signUp(email: string, password: string): Promise<boolean>;
  requestPasswordReset(email: string): Promise<boolean>;
  updatePassword(password: string): Promise<boolean>;
  clearFeedback(): void;
  signingOut: boolean;
  signOut(): Promise<void>;
};
```

Use one in-flight ref for form actions, clear feedback before a request, and translate only `AuthFailure` values. In the subscription, set `recoveryMode` only for `PASSWORD_RECOVERY`; do not render authenticated children while recovery mode is active.

- [ ] **Step 4: Run provider tests and verify GREEN**

Run: `npm test -- --run src/features/auth/AuthProvider.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/AuthProvider.tsx src/features/auth/AuthProvider.test.tsx
git commit -m "add email auth state"
```

### Task 3: Accessible auth forms

**Files:**
- Modify: `src/features/auth/AuthGate.test.tsx`
- Modify: `src/features/auth/AuthGate.tsx`
- Modify: `src/features/auth/auth-integration.test.tsx`

- [ ] **Step 1: Write failing user-flow tests**

Drive the UI with `userEvent` and cover:

```ts
await user.type(screen.getByLabelText("Correo electrónico"), "mateo@example.com");
await user.type(screen.getByLabelText("Contraseña"), "password1");
await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));
expect(authClient.signIn).toHaveBeenCalledWith("mateo@example.com", "password1");
```

Add separate tests for switching to account creation, mismatched passwords, passwords under eight characters, confirmation notice, reset request, recovery password update, disabled pending submission, missing configuration, sanitized errors, loading isolation, and authenticated rendering.

- [ ] **Step 2: Run gate tests and verify RED**

Run: `npm test -- --run src/features/auth/AuthGate.test.tsx src/features/auth/auth-integration.test.tsx`

Expected: FAIL because the Apple-only surface has no email forms.

- [ ] **Step 3: Implement the four form modes**

Use local mode state `"sign-in" | "sign-up" | "reset"`, with recovery mode taking precedence. Use semantic `<form>` submission, `<label>`-backed inputs, `autoComplete="email"`, `current-password`, and `new-password`. Validate required fields, eight-character passwords, and matching confirmations before provider calls. Keep the existing card visual language and replace Apple iconography with `Mail` and `KeyRound`.

- [ ] **Step 4: Run gate tests and verify GREEN**

Run: `npm test -- --run src/features/auth/AuthGate.test.tsx src/features/auth/auth-integration.test.tsx`

Expected: PASS with no React act warnings.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/AuthGate.tsx src/features/auth/AuthGate.test.tsx src/features/auth/auth-integration.test.tsx
git commit -m "add email auth forms"
```

### Task 4: Generalize persisted identity

**Files:**
- Modify: `src/features/user-data/user-data-types.ts`
- Modify: `src/features/user-data/user-data-validation.ts`
- Modify: `src/features/user-data/user-data-schema3.test.ts`
- Modify: `src/features/auth/authenticated-user.ts`
- Modify: `src/features/auth/authenticated-user.test.ts`

- [ ] **Step 1: Change tests to expect the generalized identity**

Replace Apple-specific fixtures with:

```ts
{ provider: "supabase", subject: "user-1", email: "mateo@example.com" }
```

Keep tests proving that subject match wins, email changes do not create a new local user, unclaimed data binds once, and a second subject receives isolated data.

- [ ] **Step 2: Run identity tests and verify RED**

Run: `npm test -- --run src/features/auth/authenticated-user.test.ts src/features/user-data/user-data-schema3.test.ts`

Expected: FAIL because production code still writes and validates `apple`.

- [ ] **Step 3: Replace the provider literal**

Change the type, validator, record creation, and update paths to `provider: "supabase"`. Do not use email for matching.

- [ ] **Step 4: Run all user-data tests and verify GREEN**

Run: `npm test -- --run src/features/auth/authenticated-user.test.ts src/features/user-data/*.test.{ts,tsx}`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/authenticated-user.ts src/features/auth/authenticated-user.test.ts src/features/user-data
git commit -m "generalize auth identity"
```

### Task 5: Configuration and documentation

**Files:**
- Modify: `src/features/auth/auth-config.ts`
- Modify: `src/features/auth/auth-config.test.ts`
- Modify: `README.md`
- Modify: `.env.example`
- Delete: `docs/superpowers/specs/2026-07-14-sign-in-with-apple-design.md`
- Delete: `docs/superpowers/plans/2026-07-14-sign-in-with-apple.md`

- [ ] **Step 1: Write the failing provider-neutral helper test**

Rename `appleRedirectUrl` to `authRedirectUrl` and assert:

```ts
expect(authRedirectUrl("https://example.com", "/escalada/"))
  .toBe("https://example.com/escalada/");
```

- [ ] **Step 2: Run the config test and verify RED**

Run: `npm test -- --run src/features/auth/auth-config.test.ts`

Expected: FAIL because `authRedirectUrl` is not exported.

- [ ] **Step 3: Rename the helper and replace Apple setup docs**

Document the project URL and publishable-key variables, enabling Email provider, Site URL and redirect allow-list configuration, confirmation and recovery smoke tests, two-email-per-hour trial limitation, and custom SMTP requirement for production. Never write the supplied key value into a tracked file. Remove obsolete Apple documentation.

- [ ] **Step 4: Verify documentation and config tests**

Run: `npm test -- --run src/features/auth/auth-config.test.ts && rg -n "Apple|apple|sb_publishable_9q" README.md .env.example src docs/superpowers`

Expected: test PASS; search returns no obsolete implementation reference and no supplied key.

- [ ] **Step 5: Commit**

```bash
git add README.md .env.example src/features/auth/auth-config.ts src/features/auth/auth-config.test.ts docs/superpowers
git commit -m "document email auth setup"
```

### Task 6: Full verification and delivery

**Files:**
- Modify only files required by failures found during verification.

- [ ] **Step 1: Run the complete unit suite**

Run: `npm test -- --run`

Expected: all tests PASS with no warnings.

- [ ] **Step 2: Run static and build checks**

Run: `npm run typecheck && npm run test:questionnaire && npm run build`

Expected: all commands exit 0.

- [ ] **Step 3: Run browser tests**

Run: `npm run test:e2e`

Expected: desktop and mobile projects PASS using the deterministic development-only auth adapter.

- [ ] **Step 4: Review the diff and secrets**

Run: `git diff dev...HEAD --check && git status --short && git diff --stat dev...HEAD && rg -n "sb_publishable_9q|service_role" --glob '!node_modules/**' .`

Expected: no whitespace errors, no uncommitted source changes, and no supplied key or service-role secret.

- [ ] **Step 5: Push and create the PR**

Push `feature/email-password-auth`, close the obsolete Apple draft PR, and create a ready PR to `dev` with a concise title and only Summary and Testing sections. Confirm GitHub CI is green before completion.
