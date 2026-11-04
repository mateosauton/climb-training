import type { AuthClient, AuthEvent, AuthSession } from "./auth-client";

export function createE2EAuthClient(id: string, email: string | null, signedIn = true): AuthClient {
  let session: AuthSession = signedIn ? { user: { id, email } } : null;
  let pendingEmail: string | null = null;
  let listener: (event: AuthEvent, next: AuthSession) => void = () => undefined;
  return {
    async getSession() {
      return { session, error: null };
    },
    onAuthStateChange(callback) {
      listener = callback;
      return () => { listener = () => undefined; };
    },
    async signUp(nextEmail) {
      pendingEmail = nextEmail;
      return { session: null, error: null };
    },
    async verifyEmailCode() {
      return { session: null, error: "unknown" };
    },
    async signIn(nextEmail) {
      if (pendingEmail && nextEmail === pendingEmail) {
        session = { user: { id, email: nextEmail } };
        pendingEmail = null;
        listener("SIGNED_IN", session);
        return { session, error: null };
      }
      return { session: null, error: "unknown" };
    },
    async requestPasswordReset() {
      return { error: "unknown" };
    },
    async resendConfirmation() {
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
