# Sign In With Apple Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate the tracker behind a persistent Apple-authenticated Supabase session while preserving and isolating each account's local training data.

**Architecture:** A narrow Supabase adapter feeds a React auth provider and gate. The existing user-data envelope migrates to schema 3 with an Apple subject on each bound identity; a pure reconciliation function claims anonymous data once or activates/creates the correct local record. `App` remains local-first and receives authenticated account controls as props.

**Tech Stack:** React 19, TypeScript, Vite, Supabase Auth, Vitest, Testing Library, Playwright, IndexedDB

---

## File map

- `.env.example`: public Supabase browser variables only.
- `README.md`: Apple/Supabase operator setup and secret-rotation instructions.
- `package.json`, `package-lock.json`: `@supabase/supabase-js` browser dependency.
- `src/vite-env.d.ts`: typed Vite variables.
- `src/features/auth/auth-config.ts`: parse public configuration and compute redirect URL.
- `src/features/auth/auth-client.ts`: narrow auth types and Supabase production adapter.
- `src/features/auth/AuthProvider.tsx`: initial-session and auth-event state machine.
- `src/features/auth/AuthGate.tsx`: loading, configuration, sign-in, and authenticated surfaces.
- `src/features/auth/authenticated-user.ts`: pure Apple-subject/local-record reconciliation.
- `src/features/auth/*.test.ts(x)`: config, provider, gate, and reconciliation tests.
- `src/features/user-data/user-data-types.ts`: schema-3 auth identity types.
- `src/features/user-data/user-data-migration.ts`: create schema-3 local envelopes.
- `src/features/user-data/user-data-validation.ts`: strict schema-3 and unique-subject validation.
- `src/features/user-data/user-data-storage.ts`: v3 persistence and v2-to-v3 migration.
- `src/features/user-data/*.test.ts`: schema migration and validation coverage.
- `src/App.tsx`: reconcile authenticated identity, show account/sign-out UI, and scope reset cleanup.
- `src/main.tsx`: compose auth client/provider/gate around `App`.
- `src/features/auth/auth-integration.test.tsx`: tracker gating, account activation, and sign-out coverage.
- `e2e/auth.spec.ts`: deterministic browser gate and authenticated smoke coverage.

### Task 1: Public configuration and Supabase adapter

**Files:**
- Create: `.env.example`
- Modify: `package.json`, `package-lock.json`, `src/vite-env.d.ts`
- Create: `src/features/auth/auth-config.ts`
- Create: `src/features/auth/auth-client.ts`
- Test: `src/features/auth/auth-config.test.ts`

- [ ] **Step 1: Install the browser client**

Run: `npm install @supabase/supabase-js`

Expected: dependency and lockfile update with no audit vulnerabilities.

- [ ] **Step 2: Write the failing configuration test**

```ts
import { describe, expect, it } from "vitest";
import { readAuthConfig, appleRedirectUrl } from "./auth-config";

describe("auth configuration", () => {
  it("accepts complete public configuration", () => {
    expect(readAuthConfig({ VITE_SUPABASE_URL: "https://demo.supabase.co", VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_demo" })).toEqual({
      url: "https://demo.supabase.co",
      publishableKey: "sb_publishable_demo"
    });
  });

  it("rejects missing public configuration", () => {
    expect(readAuthConfig({})).toBeNull();
  });

  it("returns the Vite base path for Apple OAuth", () => {
    expect(appleRedirectUrl("https://climb.example", "/escalada/")).toBe("https://climb.example/escalada/");
  });
});
```

- [ ] **Step 3: Verify RED**

Run: `npm test -- --run src/features/auth/auth-config.test.ts`

Expected: FAIL because `auth-config.ts` does not exist.

- [ ] **Step 4: Implement configuration and the narrow adapter**

```ts
export type AuthConfig = { url: string; publishableKey: string };
export function readAuthConfig(env: Record<string, string | undefined>): AuthConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const publishableKey = env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  return url && publishableKey ? { url, publishableKey } : null;
}
export function appleRedirectUrl(origin: string, baseUrl: string) {
  return new URL(baseUrl, origin).toString();
}
```

Define `AuthUser`, `AuthSession`, `AuthResult`, and an `AuthClient` with `getSession`, `onAuthStateChange`, `signInWithApple`, and `signOut`. The Supabase adapter maps only `user.id` and `user.email`, calls `signInWithOAuth({ provider: "apple", options: { redirectTo } })`, and exposes the returned unsubscribe function. Do not expose raw tokens.

- [ ] **Step 5: Add public variable declarations and example file**

```ts
interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}
```

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
```

- [ ] **Step 6: Verify GREEN and commit**

Run: `npm test -- --run src/features/auth/auth-config.test.ts && npm run typecheck`

Expected: PASS, then commit:

```bash
git add .env.example package.json package-lock.json src/vite-env.d.ts src/features/auth/auth-config.ts src/features/auth/auth-config.test.ts src/features/auth/auth-client.ts
git commit -m "add Apple auth client"
```

### Task 2: React auth provider and gate

**Files:**
- Create: `src/features/auth/AuthProvider.tsx`
- Create: `src/features/auth/AuthGate.tsx`
- Test: `src/features/auth/AuthProvider.test.tsx`
- Test: `src/features/auth/AuthGate.test.tsx`

- [ ] **Step 1: Write provider tests first**

Use a hand-written `FakeAuthClient` implementing the narrow interface. Assert: the provider starts loading; `getSession` resolves a user; an auth callback replaces/clears the user; unmount calls unsubscribe once; initial errors are normalized; sign-out errors keep the user.

```tsx
function Probe() {
  const auth = useAuth();
  return <output>{JSON.stringify({ loading: auth.loading, user: auth.user, error: auth.error })}</output>;
}
```

- [ ] **Step 2: Verify provider RED**

Run: `npm test -- --run src/features/auth/AuthProvider.test.tsx`

Expected: FAIL because the provider does not exist.

- [ ] **Step 3: Implement the provider**

Create context state `{ configured, loading, user, error, signInWithApple, signOut }`. With a null client, resolve immediately to `configured: false`. With a client, call `getSession`, install exactly one listener, ignore late results after cleanup, and never log raw errors.

- [ ] **Step 4: Verify provider GREEN**

Run: `npm test -- --run src/features/auth/AuthProvider.test.tsx`

Expected: PASS.

- [ ] **Step 5: Write gate tests first**

Assert the tracker child is absent during loading, missing configuration, and signed-out states. Assert Spanish setup text for missing config, `Continuar con Apple` invokes `signInWithApple` once, auth errors use `role="alert"`, and authenticated children render.

- [ ] **Step 6: Verify gate RED, implement, and verify GREEN**

Run RED: `npm test -- --run src/features/auth/AuthGate.test.tsx`

Expected: FAIL because the gate does not exist.

Implement a full-height loading/config/sign-in surface using existing `Card`, `Button`, `Alert`, and `Apple` icon primitives. Keep a pending flag to prevent duplicate OAuth clicks.

Run GREEN: `npm test -- --run src/features/auth/AuthProvider.test.tsx src/features/auth/AuthGate.test.tsx`

Expected: PASS, then commit:

```bash
git add src/features/auth/AuthProvider.tsx src/features/auth/AuthProvider.test.tsx src/features/auth/AuthGate.tsx src/features/auth/AuthGate.test.tsx
git commit -m "build Apple auth gate"
```

### Task 3: User-data schema 3 and safe migration

**Files:**
- Modify: `src/features/user-data/user-data-types.ts`
- Modify: `src/features/user-data/user-data-migration.ts`
- Modify: `src/features/user-data/user-data-validation.ts`
- Modify: `src/features/user-data/user-data-storage.ts`
- Modify: `src/features/user-data/user-data-validation.test.ts`
- Modify: `src/features/user-data/user-data-storage.test.ts`
- Modify: remaining `src/features/user-data/*.test.ts(x)` fixtures

- [ ] **Step 1: Add failing schema tests**

Update fixtures to schema 3 and `identity.auth`. Assert valid null/Apple auth, rejection of malformed providers/subjects, and rejection when two records share the same Apple subject. Add a storage test that places valid schema 2 under `climb4w.users.v2`, loads it, receives schema 3 with `auth: null`, verifies `climb4w.users.v3`, and verifies the v2 source is unchanged.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/features/user-data/user-data-validation.test.ts src/features/user-data/user-data-storage.test.ts`

Expected: FAIL on schema/auth assertions.

- [ ] **Step 3: Implement schema and validation**

```ts
export type UserAuthIdentity = { provider: "apple"; subject: string; email: string | null };
export type UserIdentity = {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  auth: UserAuthIdentity | null;
};
export type UserDataEnvelope = {
  schemaVersion: 3;
  activeUserId: string;
  users: Record<string, UserRecord>;
  migration: { migratedFrom: "climb4w.state.v1" | "climb4w.users.v2" | null; migratedAt: string | null };
};
```

Strictly validate the exact auth keys and collect non-null subjects in a set to reject duplicates.

- [ ] **Step 4: Implement v2-to-v3 loading**

Export `USER_DATA_STORAGE_KEY = "climb4w.users.v3"` and `LEGACY_USER_DATA_STORAGE_KEY = "climb4w.users.v2"`. Parse v2 with a dedicated narrow migration guard, add `auth: null`, set migration to the v2 source and current timestamp, save/verify v3, and never delete or overwrite v2.

- [ ] **Step 5: Verify all user-data tests and commit**

Run: `npm test -- --run src/features/user-data`

Expected: all user-data tests PASS, then commit:

```bash
git add src/features/user-data
git commit -m "link users to Apple identities"
```

### Task 4: Authenticated-user reconciliation

**Files:**
- Create: `src/features/auth/authenticated-user.ts`
- Test: `src/features/auth/authenticated-user.test.ts`

- [ ] **Step 1: Write failing pure-function tests**

Create fixtures with realistic facts/logs/guided state. Assert that `activateAuthenticatedUser`:

- reuses and activates a matching subject;
- refreshes a changed email and `updatedAt`;
- binds the current local record when no record has auth;
- creates a fresh default record when an auth-bound record already exists;
- never changes another record's facts or events.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/features/auth/authenticated-user.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal reconciliation**

```ts
export function activateAuthenticatedUser(
  envelope: UserDataEnvelope,
  user: AuthUser,
  options: { now: string; makeId: () => string }
): UserDataEnvelope
```

Clone only changed records. For a new record, call the existing migration constructor with `defaultState` and empty guided state, take its generated record, bind auth, and insert it without replacing other users.

- [ ] **Step 4: Verify GREEN and commit**

Run: `npm test -- --run src/features/auth/authenticated-user.test.ts`

Expected: PASS, then commit:

```bash
git add src/features/auth/authenticated-user.ts src/features/auth/authenticated-user.test.ts
git commit -m "activate Apple users"
```

### Task 5: Application integration and account-safe reset

**Files:**
- Modify: `src/main.tsx`
- Modify: `src/App.tsx`
- Test: `src/features/auth/auth-integration.test.tsx`

- [ ] **Step 1: Write failing integration tests**

Render the composed app with a fake auth client. Assert signed-out state does not read `climb4w.users.v3`; authenticated state claims existing data and shows the email; a second subject receives a fresh local record; sign-out returns to the gate; a failed sign-out displays an alert and keeps the app mounted.

- [ ] **Step 2: Verify RED**

Run: `npm test -- --run src/features/auth/auth-integration.test.tsx`

Expected: FAIL because `main`/`App` are not composed with auth.

- [ ] **Step 3: Compose the root**

Read configuration from `import.meta.env`, create the adapter only when complete, then render:

```tsx
<AuthProvider client={authClient}>
  <AuthGate>{(user) => <AuthenticatedApp key={user.id} user={user} />}</AuthGate>
</AuthProvider>
```

`AuthenticatedApp` consumes sign-out state and passes `{ authUser, onSignOut, authError }` to `App`.

- [ ] **Step 4: Reconcile before App state initialization**

Change `App` props to require the auth user and account actions. In the lazy initializer, call `loadUserData`, then `activateAuthenticatedUser`, save it when persistence is allowed, and use the reconciled envelope as initial state.

- [ ] **Step 5: Add account controls**

In `SidebarFooter`, render the authenticated email or `Cuenta Apple` and a `Cerrar sesión` outline button. Disable it during sign-out and render `authError` with `role="alert"`. Mobile users must have the same action in the profile backup section.

- [ ] **Step 6: Make reset account-safe**

Replace `clearVideoBlobs()` with `deleteVideoBlobs(ids: string[])`. Before replacing the active record, delete only `activeUser.videoAnalyses.map(video => video.id)`. Construct the fresh record, bind it to the current Apple subject, replace only `users[activeUserId]`, and preserve every other user.

- [ ] **Step 7: Verify GREEN and commit**

Run: `npm test -- --run src/features/auth/auth-integration.test.tsx src/features/user-data/user-data-integration.test.tsx`

Expected: PASS, then commit:

```bash
git add src/main.tsx src/App.tsx src/features/auth/auth-integration.test.tsx
git commit -m "integrate Apple accounts"
```

### Task 6: Browser coverage and operator documentation

**Files:**
- Create: `e2e/auth.spec.ts`
- Modify: `README.md`
- Modify: `playwright.config.ts`

- [ ] **Step 1: Add deterministic E2E auth mode**

Expose a test-only fake through Vite variables used only when `VITE_E2E_AUTH_USER_ID` is present at build time. It implements the same narrow client and never runs in production without the explicit variable. Configure Playwright's web server with a stable test subject and email.

- [ ] **Step 2: Write browser tests**

Assert the authenticated test user reaches the Dashboard, sees its email, reloads with the same local record, and can sign out to the Apple gate. Missing configuration remains covered by the component test because a Playwright web server has one immutable build-time environment.

- [ ] **Step 3: Run browser RED/GREEN cycle**

Run before implementation: `npm run test:e2e -- e2e/auth.spec.ts`

Expected: FAIL on missing auth behavior.

Run after implementation: `npm run test:e2e -- e2e/auth.spec.ts`

Expected: PASS on desktop and mobile projects.

- [ ] **Step 4: Document exact external setup**

Add README steps for Supabase project URL/publishable key, Apple primary App ID, Services ID, production domain, `https://<project-ref>.supabase.co/auth/v1/callback`, Supabase redirect allow list, provider configuration, secure `.p8` handling, and six-month client-secret rotation. State that credentials are configured outside Git and live Apple login is an operator acceptance test.

- [ ] **Step 5: Commit docs and browser coverage**

```bash
git add README.md e2e/auth.spec.ts playwright.config.ts
git commit -m "document Apple auth setup"
```

### Task 7: Final verification and PR

**Files:**
- Review: all changed files and approved design requirements

- [ ] **Step 1: Run the complete quality suite**

```bash
npm test -- --run
npm run typecheck
npm run test:questionnaire
npm run build
npm run test:e2e
```

Expected: every command exits 0 with no test failures.

- [ ] **Step 2: Audit requirements and diff**

Run:

```bash
git diff --check origin/dev...HEAD
git status -sb
git log --oneline origin/dev..HEAD
git diff --stat origin/dev...HEAD
rg -n "service_role|AuthKey_|BEGIN PRIVATE KEY" . -g '!node_modules' -g '!.git'
```

Expected: no whitespace errors, only intended files, concise commits, and no secrets.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin feature/sign-in-with-apple
gh pr create --base dev --head feature/sign-in-with-apple --title "add Apple sign-in" --body-file /tmp/apple-sign-in-pr.md
```

The concise body contains only Summary and Testing. Confirm branch policy and CI state with `gh pr checks --watch` when checks start.
