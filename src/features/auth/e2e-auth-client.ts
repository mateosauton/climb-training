import type { AuthClient, AuthEvent, AuthSession } from "./auth-client";

export function createE2EAuthClient(id: string, email: string | null): AuthClient {
  let session: AuthSession = { user: { id, email } };
  let listener: (event: AuthEvent, next: AuthSession) => void = () => undefined;
  return {
    async getSession() {
      return { session, error: null };
    },
    onAuthStateChange(callback) {
      listener = callback;
      return () => { listener = () => undefined; };
    },
    async signUp() {
      return { session: null, error: "unknown" };
    },
    async signIn() {
      return { session: null, error: "unknown" };
    },
    async requestPasswordReset() {
      return { error: "unknown" };
    },
    async updatePassword() {
      return { error: "unknown" };
    },
    async signOut() {
      session = null;
      listener("SIGNED_OUT", null);
      return { error: null };
    }
  };
}
