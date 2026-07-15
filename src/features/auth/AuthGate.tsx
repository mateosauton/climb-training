import { Apple, LoaderCircle, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { AuthUser } from "./auth-client";
import { useAuth } from "./AuthProvider";

type AuthGateProps = {
  children: (user: AuthUser) => ReactNode;
};

function AuthSurface({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4 py-10 text-foreground">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--primary),transparent_78%),transparent_34rem)]" />
      <div className="relative w-full max-w-md">{children}</div>
    </main>
  );
}

export function AuthGate({ children }: AuthGateProps) {
  const auth = useAuth();

  if (auth.loading) {
    return (
      <AuthSurface>
        <div className="flex items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
          Verificando tu sesión…
        </div>
      </AuthSurface>
    );
  }

  if (!auth.configured) {
    return (
      <AuthSurface>
        <Card>
          <CardHeader>
            <CardTitle><h1>Configura el acceso con Apple</h1></CardTitle>
            <CardDescription>Falta conectar este despliegue con Supabase Auth.</CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <ShieldCheck className="size-4" />
              <AlertTitle>Configuración requerida</AlertTitle>
              <AlertDescription>
                Define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, luego vuelve a desplegar.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </AuthSurface>
    );
  }

  if (!auth.user) {
    return (
      <AuthSurface>
        <Card className="border-border/80 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Apple className="size-6" aria-hidden="true" />
            </div>
            <CardTitle><h1>Escalada 4W</h1></CardTitle>
            <CardDescription>Inicia sesión para acceder a tu plan y tus registros locales.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {auth.error ? (
              <Alert variant="destructive" role="alert">
                <AlertTitle>No se pudo iniciar sesión</AlertTitle>
                <AlertDescription>{auth.error}</AlertDescription>
              </Alert>
            ) : null}
            <Button
              type="button"
              className="h-11 w-full bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/85"
              onClick={auth.signInWithApple}
              disabled={auth.signingIn}
            >
              {auth.signingIn ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : <Apple className="size-4" aria-hidden="true" />}
              Continuar con Apple
            </Button>
            <p className="text-center text-xs text-muted-foreground">Tus datos de entrenamiento permanecen en este dispositivo.</p>
          </CardContent>
        </Card>
      </AuthSurface>
    );
  }

  return children(auth.user);
}
