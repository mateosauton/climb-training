import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

import type { AuthConfig } from "./auth-config";

export type AuthUser = {
  id: string;
  email: string | null;
};

export type AuthSession = {
  user: AuthUser;
} | null;

export type AuthResult = {
  error: string | null;
};

export interface AuthClient {
  getSession(): Promise<{ session: AuthSession; error: string | null }>;
  onAuthStateChange(callback: (session: AuthSession) => void): () => void;
  signInWithApple(redirectTo: string): Promise<AuthResult>;
  signOut(): Promise<AuthResult>;
}

function toSession(session: Session | null): AuthSession {
  return session ? { user: { id: session.user.id, email: session.user.email ?? null } } : null;
}

export function createSupabaseAuthClient(config: AuthConfig): AuthClient {
  const client: SupabaseClient = createClient(config.url, config.publishableKey);
  return {
    async getSession() {
      const { data, error } = await client.auth.getSession();
      return { session: toSession(data.session), error: error?.message ?? null };
    },
    onAuthStateChange(callback) {
      const { data } = client.auth.onAuthStateChange((_event, session) => callback(toSession(session)));
      return () => data.subscription.unsubscribe();
    },
    async signInWithApple(redirectTo) {
      const { error } = await client.auth.signInWithOAuth({
        provider: "apple",
        options: { redirectTo }
      });
      return { error: error?.message ?? null };
    },
    async signOut() {
      const { error } = await client.auth.signOut();
      return { error: error?.message ?? null };
    }
  };
}
