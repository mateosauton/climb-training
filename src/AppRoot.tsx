import App from "./App";
import type { AuthClient, AuthUser } from "./features/auth/auth-client";
import { authRedirectUrl, type AuthConfig } from "./features/auth/auth-config";
import { AuthGate } from "./features/auth/AuthGate";
import { AuthProvider, useAuth } from "./features/auth/AuthProvider";

type AppRootProps = {
  client: AuthClient | null;
  config: AuthConfig | null;
  origin: string;
  baseUrl: string;
};

function AuthenticatedApp({ user }: { user: AuthUser }) {
  const auth = useAuth();
  return (
    <App
      authUser={user}
      onSignOut={auth.signOut}
      authError={auth.error}
      signingOut={auth.signingOut}
    />
  );
}

export function AppRoot({ client, config, origin, baseUrl }: AppRootProps) {
  const redirectTo = authRedirectUrl(origin, baseUrl);
  return (
    <AuthProvider client={config ? client : null} redirectTo={redirectTo}>
      <AuthGate>{(user) => <AuthenticatedApp key={user.id} user={user} />}</AuthGate>
    </AuthProvider>
  );
}
