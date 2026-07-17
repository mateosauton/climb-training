import { useEffect, useState } from "react";

import App from "./App";
import type { AuthClient, AuthUser } from "./features/auth/auth-client";
import { authRedirectUrl, type AuthConfig } from "./features/auth/auth-config";
import { AuthGate } from "./features/auth/AuthGate";
import { AuthProvider, useAuth } from "./features/auth/AuthProvider";
import type { CloudRepository } from "./features/cloud/cloud-repository";
import type { CloudHydration } from "./features/cloud/cloud-types";
import type { CloudImport } from "./features/cloud/cloud-import";
import type { CloudAvatarClient } from "./features/cloud/cloud-avatar";

type AppRootProps = {
  client: AuthClient | null;
  config: AuthConfig | null;
  origin: string;
  baseUrl: string;
  repository?: CloudRepository | null;
  cloudImport?: CloudImport | null;
  cloudAvatarClient?: CloudAvatarClient | null;
};

function CloudBootstrap({ user, repository, cloudImport, cloudAvatarClient }: { user: AuthUser; repository: CloudRepository | null | undefined; cloudImport: CloudImport | null | undefined; cloudAvatarClient: CloudAvatarClient | null | undefined }) {
  const auth = useAuth();
  const [attempt, setAttempt] = useState(0);
  const [ready, setReady] = useState(!repository);
  const [error, setError] = useState(false);
  const [hydration, setHydration] = useState<CloudHydration | null>(null);

  useEffect(() => {
    if (!repository) return;
    let current = true;
    setReady(false);
    setError(false);
    void repository.ensureProfile().then(async () => {
      const state = await repository.hydrate();
      if (current) {
        setHydration(state);
        setReady(true);
      }
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
      cloudHydration={hydration}
      cloudAvatarClient={cloudAvatarClient}
    />
  );
}

export function AppRoot({ client, config, origin, baseUrl, repository, cloudImport, cloudAvatarClient }: AppRootProps) {
  const redirectTo = authRedirectUrl(origin, baseUrl);
  return (
    <AuthProvider client={config ? client : null} redirectTo={redirectTo}>
      <AuthGate>{(user) => <CloudBootstrap key={user.id} user={user} repository={repository} cloudImport={cloudImport} cloudAvatarClient={cloudAvatarClient} />}</AuthGate>
    </AuthProvider>
  );
}
