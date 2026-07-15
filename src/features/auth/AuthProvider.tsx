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
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<boolean>;
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
      if (result.session) setUser(result.session.user);
      else setNotice("Revisa tu correo para confirmar tu cuenta.");
      return true;
    } catch {
      setError("No pudimos crear la cuenta. Intenta de nuevo.");
      return false;
    } finally {
      finishAction();
    }
  }, [beginAction, client, finishAction, redirectTo]);

  const requestPasswordReset = useCallback(async (email: string) => {
    if (!client || !beginAction()) return false;
    try {
      const result = await client.requestPasswordReset(email, redirectTo);
      if (result.error) {
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
    signIn,
    signUp,
    requestPasswordReset,
    updatePassword,
    clearFeedback,
    signingOut,
    signOut
  }), [busy, clearFeedback, client, error, loading, notice, recoveryMode, requestPasswordReset, signIn, signOut, signUp, signingOut, updatePassword, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
