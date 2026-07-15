import { useEffect, useState } from "react";

import App from "./App";
import type { AuthClient, AuthUser } from "./features/auth/auth-client";
import { authRedirectUrl, type AuthConfig } from "./features/auth/auth-config";
import { AuthGate } from "./features/auth/AuthGate";
import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import type { CloudRepository } from "./features/cloud/cloud-repository";
import type { CloudImport } from "./features/cloud/cloud-import";

type AppRootProps = {
  client: AuthClient | null;
  config: AuthConfig | null;
  origin: string;
  baseUrl: string;
  repository?: CloudRepository | null;
  cloudImport?: CloudImport | null;
};

function CloudBootstrap({ user, repository, cloudImport }: { user: AuthUser; repository: CloudRepository | null | undefined; cloudImport: CloudImport | null | undefined }) {
  const auth = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(!repository);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!repository) return;
    let current = true;
    setReady(false);
    setError(false);
    void repository.ensureProfile().then(async () => {
      await repository.listActivePlan();
      if (current) setReady(true);
    }).catch(() => {
      if (current) setError(true);
    });
    return () => { current = false; };
  }, [attempt, repository, user.id]);

  if (!ready) {
    return (
      <main className="flex min-h-svh items-center justify-center bg-background px-4 text-foreground">
        {error ? (
          <div role="alert" className="max-w-sm space-y-3 text-center">
            <p>No pudimos preparar tus datos en la nube. Tus datos locales de recuperación siguen intactos.</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="rounded-md border px-3 py-2">Reintentar</button>
          </div>
        ) : <p role="status">Preparando tus datos en la nube…</p>}
      </main>
    );
  }

  return (
    <App
      authUser={user}
      onSignOut={auth.signOut}
      authError={auth.error}
      signingOut={auth.signingOut}
      cloudRepository={repository}
      cloudImport={cloudImport}
      cloudVerified={Boolean(repository)}
    />
  );
}

export function AppRoot({ client, config, origin, baseUrl, repository, cloudImport }: AppRootProps) {
  const redirectTo = authRedirectUrl(origin, baseUrl);
  return (
    <AuthProvider client={config ? client : null} redirectTo={redirectTo}>
      <AuthGate>{(user) => <CloudBootstrap key={user.id} user={user} repository={repository} cloudImport={cloudImport} />}</AuthGate>
    </AuthProvider>
  );
}
