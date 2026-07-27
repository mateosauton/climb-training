import { KeyRound, LoaderCircle, Mail, ShieldCheck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RopeKnotMark } from "@/components/climb/ClimbMarks";

import type { AuthUser } from "./auth-client";
import { useAuth } from "./AuthProvider";

type AuthGateProps = {
  children: (user: AuthUser) => ReactNode;
};

type FormMode = "sign-in" | "sign-up" | "reset";

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
  const [mode, setMode] = useState<FormMode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const changeMode = (next: FormMode) => {
    setMode(next);
    setPassword("");
    setConfirmation("");
    setVerificationCode("");
    setLocalError(null);
    auth.clearFeedback();
  };

  const validateNewPassword = () => {
    if (password.length < 8) {
      setLocalError("La contraseña debe tener al menos 8 caracteres.");
      return false;
    }
    if (password !== confirmation) {
      setLocalError("Las contraseñas no coinciden.");
      return false;
    }
    return true;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);
    if (auth.pendingVerificationEmail) {
      if (!/^\d{6}$/.test(verificationCode)) {
        setLocalError("Ingresa el código de seis dígitos.");
        return;
      }
      await auth.verifyEmailCode(auth.pendingVerificationEmail, verificationCode);
      return;
    }
    if (auth.recoveryMode) {
      if (validateNewPassword()) await auth.updatePassword(password);
      return;
    }
    if (mode === "sign-up") {
      if (validateNewPassword()) await auth.signUp(email.trim(), password);
      return;
    }
    if (mode === "reset") {
      await auth.requestPasswordReset(email.trim());
      return;
    }
    await auth.signIn(email.trim(), password);
  };

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
            <CardTitle><h1>Configura el acceso por correo</h1></CardTitle>
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

  if (auth.user && !auth.recoveryMode) return children(auth.user);

  const isRecovery = auth.recoveryMode;
  const isVerifyingEmail = Boolean(auth.pendingVerificationEmail);
  const title = isRecovery
    ? "Crea una nueva contraseña"
    : isVerifyingEmail
      ? "Confirma tu correo"
    : mode === "sign-up"
      ? "Crea tu cuenta"
      : mode === "reset"
        ? "Recupera tu acceso"
        : "Escalada 4W";
  const description = isRecovery
    ? "Elige una contraseña nueva para tu cuenta."
    : isVerifyingEmail
      ? "Ingresa el código de seis dígitos que enviamos a tu correo."
    : mode === "sign-up"
      ? "Regístrate para guardar el acceso a tus datos locales."
      : mode === "reset"
        ? "Te enviaremos un enlace seguro por correo."
        : "Inicia sesión para acceder a tu plan y tus registros locales.";
  const visibleError = localError ?? auth.error;

  return (
    <AuthSurface>
      <Card className="border-border/80 shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-sandstone text-river">
            {isRecovery ? <KeyRound className="size-6" aria-hidden="true" /> : isVerifyingEmail ? <Mail className="size-6" aria-hidden="true" /> : <RopeKnotMark className="size-7" />}
          </div>
          <CardTitle><h1>{title}</h1></CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {visibleError ? (
            <Alert variant="destructive" role="alert">
              <AlertTitle>No pudimos completar la acción</AlertTitle>
              <AlertDescription>{visibleError}</AlertDescription>
            </Alert>
          ) : null}
          {auth.notice ? (
            <Alert role="status" aria-live="polite">
              <Mail className="size-4" />
              <AlertTitle>Revisa tu correo</AlertTitle>
              <AlertDescription>{auth.notice}</AlertDescription>
            </Alert>
          ) : null}

          <form className="space-y-4" onSubmit={submit}>
            {isVerifyingEmail ? (
              <div className="space-y-2">
                <Label htmlFor="auth-verification-code">Código de verificación</Label>
                <Input
                  id="auth-verification-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  pattern="[0-9]{6}"
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  disabled={auth.busy}
                  required
                />
              </div>
            ) : !isRecovery ? (
              <div className="space-y-2">
                <Label htmlFor="auth-email">Correo electrónico</Label>
                <Input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={auth.busy}
                  required
                />
              </div>
            ) : null}

            {!isVerifyingEmail && (mode !== "reset" || isRecovery) ? (
              <div className="space-y-2">
                <Label htmlFor="auth-password">{isRecovery ? "Nueva contraseña" : "Contraseña"}</Label>
                <Input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === "sign-in" && !isRecovery ? "current-password" : "new-password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={auth.busy}
                  required
                />
              </div>
            ) : null}

            {!isVerifyingEmail && (isRecovery || mode === "sign-up") ? (
              <div className="space-y-2">
                <Label htmlFor="auth-confirmation">Confirmar contraseña</Label>
                <Input
                  id="auth-confirmation"
                  type="password"
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  disabled={auth.busy}
                  required
                />
              </div>
            ) : null}

            <Button className="h-11 w-full" type="submit" disabled={auth.busy}>
              {auth.busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden="true" /> : null}
              {isVerifyingEmail ? "Confirmar código" : isRecovery ? "Guardar contraseña" : mode === "sign-up" ? "Registrarme" : mode === "reset" ? "Enviar enlace" : "Iniciar sesión"}
            </Button>
          </form>

          {!isRecovery && !isVerifyingEmail ? (
            <div className="flex flex-col items-center gap-1">
              {mode === "sign-in" ? (
                <>
                  <Button type="button" variant="ghost" onClick={() => changeMode("reset")} disabled={auth.busy}>Olvidé mi contraseña</Button>
                  <Button type="button" variant="link" onClick={() => changeMode("sign-up")} disabled={auth.busy}>Crear cuenta</Button>
                </>
              ) : (
                <Button type="button" variant="link" onClick={() => changeMode("sign-in")} disabled={auth.busy}>Volver a iniciar sesión</Button>
              )}
            </div>
          ) : null}
          <p className="text-center text-xs text-muted-foreground">Tus datos de entrenamiento permanecen en este dispositivo.</p>
        </CardContent>
      </Card>
    </AuthSurface>
  );
}
