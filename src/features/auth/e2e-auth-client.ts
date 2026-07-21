import type { AuthClient, AuthEvent, AuthSession } from "./auth-client";

export const E2E_EMAIL_VERIFICATION_CODE = "123456";

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
    async verifyEmailCode(nextEmail, code) {
      if (pendingEmail !== nextEmail || code !== E2E_EMAIL_VERIFICATION_CODE) {
        return { session: null, error: "invalid_credentials" };
      }
      session = { user: { id, email: nextEmail } };
      pendingEmail = null;
      listener("SIGNED_IN", session);
      return { session, error: null };
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
