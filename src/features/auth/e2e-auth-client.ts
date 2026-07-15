import type { AuthClient, AuthSession } from "./auth-client";

export function createE2EAuthClient(id: string, email: string | null): AuthClient {
  let session: AuthSession = { user: { id, email } };
  let listener: (next: AuthSession) => void = () => undefined;
  return {
    async getSession() {
      return { session, error: null };
    },
    onAuthStateChange(callback) {
      listener = callback;
      return () => { listener = () => undefined; };
    },
    async signInWithApple() {
      return { error: "E2E sign-in is not interactive" };
    },
    async signOut() {
      session = null;
      listener(null);
      return { error: null };
    }
  };
}
