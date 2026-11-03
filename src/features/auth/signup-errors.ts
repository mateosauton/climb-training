const REPEATED_SIGNUP_CODES = new Set([
  "user_repeated_signup",
  "user_already_exists",
  "email_exists"
]);

const REPEATED_SIGNUP_MESSAGES = new Set([
  "user already registered",
  "a user with this email address has already been registered",
  "email address already registered by another user"
]);

export interface SignupErrorFields {
  code?: string | null;
  message?: string | null;
  status?: number | null;
}

export interface SignupIdentityUser {
  id?: string;
  email?: string | null;
  identities?: unknown[] | null;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return undefined;
}

function isKnownMessage(message: string | null | undefined): boolean {
  return message !== null && message !== undefined && REPEATED_SIGNUP_MESSAGES.has(message.trim().toLowerCase());
}

function isRepeatedSignupError(error: SignupErrorFields): boolean {
  return (typeof error.code === "string" && REPEATED_SIGNUP_CODES.has(error.code)) || isKnownMessage(error.message);
}

function readPayload(value: unknown): { repeated: boolean; emptyIdentities: boolean; hasSession: boolean } {
  if (!value || typeof value !== "object") return { repeated: false, emptyIdentities: false, hasSession: false };
  const record = value as Record<string, unknown>;
  const nested = record.error && typeof record.error === "object" ? record.error as Record<string, unknown> : null;
  const code = firstString(record.error_code, nested?.error_code, record.code, nested?.code);
  const message = firstString(
    record.msg,
    record.message,
    nested?.msg,
    nested?.message,
    typeof record.error === "string" ? record.error : undefined
  );
  const user = record.user && typeof record.user === "object"
    ? record.user as Record<string, unknown>
    : typeof record.id === "string"
      ? record
      : null;
  const identities = user && Array.isArray(user.identities) ? user.identities : undefined;
  const session = record.session && typeof record.session === "object" ? record.session as Record<string, unknown> : null;
  return {
    repeated: (code !== undefined && REPEATED_SIGNUP_CODES.has(code)) || isKnownMessage(message),
    emptyIdentities: Array.isArray(identities) && identities.length === 0,
    hasSession: typeof record.access_token === "string" || typeof session?.access_token === "string"
  };
}

function hasEmptyIdentities(user: SignupIdentityUser | null | undefined): boolean {
  return Array.isArray(user?.identities) && user.identities.length === 0;
}

/** Signup can report an existing account with HTTP 200. Status is not consulted. */
export function repeatedSignupFailure(input: {
  error: SignupErrorFields | null;
  user?: SignupIdentityUser | null;
  session?: unknown;
  body?: unknown;
}): "email_exists" | null {
  if (input.error && isRepeatedSignupError(input.error)) return "email_exists";
  if (input.error) return null;
  const body = readPayload(input.body);
  if (body.repeated) return "email_exists";
  const signedIn = Boolean(input.session) || body.hasSession;
  if (!signedIn && (body.emptyIdentities || hasEmptyIdentities(input.user))) return "email_exists";
  return null;
}
