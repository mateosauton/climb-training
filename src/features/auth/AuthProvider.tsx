import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { AuthClient, AuthFailure, AuthUser } from "./auth-client";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: AuthUser | null;
  error: string | null;
  notice: string | null;
  busy: boolean;
  recoveryMode: boolean;
  pendingVerificationEmail: string | null;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  updatePassword: (password: string) => Promise<boolean>;
  clearFeedback: () => void;
  signingOut: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  client: AuthClient | null;
  redirectTo: string;
  children: ReactNode;
};

function failureMessage(failure: AuthFailure, fallback: string): string {
  if (failure === "invalid_credentials") return "El correo o la contraseña no son correctos.";
  if (failure === "weak_password") return "La contraseña no cumple los requisitos de seguridad.";
  if (failure === "email_rate_limit") return "El servicio de correo alcanzó su límite temporal. Intenta de nuevo más tarde.";
  if (failure === "rate_limit") return "Demasiados intentos. Espera un momento y vuelve a intentar.";
  if (failure === "expired_link") return "El enlace venció. Solicita uno nuevo.";
  return fallback;
}

export function AuthProvider({ client, redirectTo, children }: AuthProviderProps) {
  const [loading, setLoading] = useState(Boolean(client));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);
  const actionFlight = useRef(false);
  const signOutFlight = useRef(false);

  useEffect(() => {
    if (!client) {
      setLoading(false);
      setUser(null);
      return;
    }

    let active = true;
    let authEventVersion = 0;
    const unsubscribe = client.onAuthStateChange((event, session) => {
      if (!active) return;
      authEventVersion += 1;
      setUser(session?.user ?? null);
      if (session) setPendingVerificationEmail(null);
      setRecoveryMode(event === "PASSWORD_RECOVERY");
      setError(null);
      setLoading(false);
    });

    const versionAtStart = authEventVersion;
    void client.getSession().then((result) => {
      if (!active || authEventVersion !== versionAtStart) return;
      if (result.error) {
        setError("No pudimos verificar tu sesión. Intenta de nuevo.");
        setUser(null);
      } else {
        setUser(result.session?.user ?? null);
        if (result.session) setPendingVerificationEmail(null);
      }
      setLoading(false);
    }).catch(() => {
      if (!active) return;
      setError("No pudimos verificar tu sesión. Intenta de nuevo.");
      setUser(null);
      setLoading(false);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [client]);

  const clearFeedback = useCallback(() => {
    setError(null);
    setNotice(null);
  }, []);

  const beginAction = useCallback(() => {
    if (!client || actionFlight.current) return false;
    actionFlight.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    return true;
  }, [client]);

  const finishAction = useCallback(() => {
    actionFlight.current = false;
    setBusy(false);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!client || !beginAction()) return false;
    try {
      const result = await client.signIn(email, password);
      if (result.error) {
        setError(failureMessage(result.error, "No pudimos iniciar sesión. Intenta de nuevo."));
        return false;
      }
      setUser(result.session?.user ?? null);
      return Boolean(result.session);
    } catch {
      setError("No pudimos iniciar sesión. Intenta de nuevo.");
      return false;
    } finally {
      finishAction();
    }
  }, [beginAction, client, finishAction]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!client || !beginAction()) return false;
    try {
      const result = await client.signUp(email, password, redirectTo);
      if (result.error) {
        setError(failureMessage(result.error, "No pudimos crear la cuenta. Intenta de nuevo."));
        return false;
      }
      if (result.session) {
        setUser(result.session.user);
        setPendingVerificationEmail(null);
      } else {
        setPendingVerificationEmail(email);
        setNotice("Revisa tu correo para obtener el código de seis dígitos.");
      }
      return true;
    } catch {
      setError("No pudimos crear la cuenta. Intenta de nuevo.");
      return false;
    } finally {
      finishAction();
    }
  }, [beginAction, client, finishAction, redirectTo]);

  const verifyEmailCode = useCallback(async (email: string, code: string) => {
    if (!client || !beginAction()) return false;
    try {
      const result = await client.verifyEmailCode(email, code);
      if (result.error || !result.session) {
        setError(result.error ? failureMessage(result.error, "No pudimos confirmar el código. Intenta de nuevo.") : "No pudimos confirmar el código. Intenta de nuevo.");
        return false;
      }
      setUser(result.session.user);
      setPendingVerificationEmail(null);
      return true;
    } catch {
      setError("No pudimos confirmar el código. Intenta de nuevo.");
      return false;
    } finally {
      finishAction();
    }
  }, [beginAction, client, finishAction]);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!client || !beginAction()) return false;
    try {
      const result = await client.requestPasswordReset(email, redirectTo);
      if (result.error) {
        if (result.error === "email_rate_limit") {
          setNotice("Si existe una cuenta, recibirás un enlace para cambiar tu contraseña.");
          return true;
        }
        setError(failureMessage(result.error, "No pudimos enviar el enlace. Intenta de nuevo."));
        return false;
      }
      setNotice("Si existe una cuenta, recibirás un enlace para cambiar tu contraseña.");
      return true;
    } catch {
      setError("No pudimos enviar el enlace. Intenta de nuevo.");
      return false;
    } finally {
      finishAction();
    }
  }, [beginAction, client, finishAction, redirectTo]);

  const updatePassword = useCallback(async (password: string) => {
    if (!client || !beginAction()) return false;
    try {
      const result = await client.updatePassword(password);
      if (result.error) {
        setError(failureMessage(result.error, "No pudimos actualizar la contraseña. Solicita un enlace nuevo."));
        return false;
      }
      setRecoveryMode(false);
      setNotice("Contraseña actualizada.");
      return true;
    } catch {
      setError("No pudimos actualizar la contraseña. Solicita un enlace nuevo.");
      return false;
    } finally {
      finishAction();
    }
  }, [beginAction, client, finishAction]);

  const signOut = useCallback(async () => {
    if (!client || signOutFlight.current) return;
    signOutFlight.current = true;
    setSigningOut(true);
    clearFeedback();
    try {
      const result = await client.signOut();
      if (result.error) setError("No pudimos cerrar sesión. Intenta de nuevo.");
      else {
        setUser(null);
        setRecoveryMode(false);
        setPendingVerificationEmail(null);
      }
    } catch {
      setError("No pudimos cerrar sesión. Intenta de nuevo.");
    } finally {
      signOutFlight.current = false;
      setSigningOut(false);
    }
  }, [clearFeedback, client]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: Boolean(client),
    loading,
    user,
    error,
    notice,
    busy,
    recoveryMode,
    pendingVerificationEmail,
    signIn,
    signUp,
    verifyEmailCode,
    requestPasswordReset,
    updatePassword,
    clearFeedback,
    signingOut,
    signOut
  }), [busy, clearFeedback, client, error, loading, notice, pendingVerificationEmail, recoveryMode, requestPasswordReset, signIn, signOut, signUp, signingOut, updatePassword, user, verifyEmailCode]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
