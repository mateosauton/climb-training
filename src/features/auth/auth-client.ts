import { createClient, type AuthChangeEvent, type AuthError, type Session, type SupabaseClient } from "@supabase/supabase-js";

import type { AuthConfig } from "./auth-config";

export type { AuthConfig } from "./auth-config";

export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  user: AuthUser;
} | null;

export type AuthEvent = AuthChangeEvent;
export type AuthFailure = "invalid_credentials" | "weak_password" | "email_rate_limit" | "rate_limit" | "expired_link" | "unknown";
export type AuthActionResult = { error: AuthFailure | null };
export type AuthSessionResult = AuthActionResult & { session: AuthSession };

export interface AuthClient {
  getSession(): Promise<AuthSessionResult>;
  onAuthStateChange(callback: (event: AuthEvent, session: AuthSession) => void): () => void;
  signUp(email: string, password: string, redirectTo: string): Promise<AuthSessionResult>;
  verifyEmailCode(email: string, code: string): Promise<AuthSessionResult>;
  signIn(email: string, password: string): Promise<AuthSessionResult>;
  requestPasswordReset(email: string, redirectTo: string): Promise<AuthActionResult>;
  updatePassword(password: string): Promise<AuthActionResult>;
  signOut(): Promise<AuthActionResult>;
}

function toSession(session: Session | null): AuthSession {
  return session ? { user: { id: session.user.id, email: session.user.email ?? null } } : null;
}

function toFailure(error: AuthError | null): AuthFailure | null {
  if (!error) return null;
  if (error.code === "over_email_send_rate_limit") return "email_rate_limit";
  if (error.status === 429 || error.code?.includes("rate_limit")) return "rate_limit";
  if (error.code === "invalid_credentials" || error.code === "email_not_confirmed") return "invalid_credentials";
  if (error.code === "weak_password") return "weak_password";
  if (error.code === "otp_expired" || error.code === "flow_state_expired") return "expired_link";
  return "unknown";
}

export function createSupabaseAuthClient(config: AuthConfig): AuthClient {
  const client: SupabaseClient = createClient(config.url, config.publishableKey);
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      return { session: toSession(data.session), error: toFailure(error) };
    },
    onAuthStateChange(callback) {
      const { data } = client.auth.onAuthStateChange((event, session) => callback(event, toSession(session)));
      return () => data.subscription.unsubscribe();
    },
    async signUp(email, password, redirectTo) {
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo }
      });
      return { session: toSession(data.session), error: toFailure(error) };
    },
    async verifyEmailCode(email, code) {
      const { data, error } = await client.auth.verifyOtp({ email, token: code, type: "email" });
      return { session: toSession(data.session), error: toFailure(error) };
    },
    async signIn(email, password) {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      return { session: toSession(data.session), error: toFailure(error) };
    },
    async requestPasswordReset(email, redirectTo) {
      const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
      return { error: toFailure(error) };
    },
    async updatePassword(password) {
      const { error } = await client.auth.updateUser({ password });
      return { error: toFailure(error) };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      return { error: toFailure(error) };
    }
  };
}
