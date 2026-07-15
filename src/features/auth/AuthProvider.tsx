import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import type { AuthClient, AuthUser } from "./auth-client";

type AuthContextValue = {
  configured: boolean;
  loading: boolean;
  user: AuthUser | null;
  error: string | null;
  signingIn: boolean;
  signingOut: boolean;
  signInWithApple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

type AuthProviderProps = {
  client: AuthClient | null;
  redirectTo: string;
  children: ReactNode;
};

export function AuthProvider({ client, redirectTo, children }: AuthProviderProps) {
  const [loading, setLoading] = useState(Boolean(client));
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const signInFlight = useRef(false);
  const signOutFlight = useRef(false);

  useEffect(() => {
    if (!client) {
      setLoading(false);
      setUser(null);
      return;
    }

    let active = true;
    let authEventVersion = 0;
    const unsubscribe = client.onAuthStateChange((session) => {
      if (!active) return;
      authEventVersion += 1;
      setUser(session?.user ?? null);
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

  const signInWithApple = useCallback(async () => {
    if (!client || signInFlight.current) return;
    signInFlight.current = true;
    setSigningIn(true);
    setError(null);
    try {
      const result = await client.signInWithApple(redirectTo);
      if (result.error) {
        signInFlight.current = false;
        setSigningIn(false);
        setError("No pudimos iniciar sesión con Apple. Intenta de nuevo.");
      }
    } catch {
      signInFlight.current = false;
      setSigningIn(false);
      setError("No pudimos iniciar sesión con Apple. Intenta de nuevo.");
    }
  }, [client, redirectTo]);

  const signOut = useCallback(async () => {
    if (!client || signOutFlight.current) return;
    signOutFlight.current = true;
    setSigningOut(true);
    setError(null);
    try {
      const result = await client.signOut();
      if (result.error) setError("No pudimos cerrar sesión. Intenta de nuevo.");
      else setUser(null);
    } catch {
      setError("No pudimos cerrar sesión. Intenta de nuevo.");
    } finally {
      signOutFlight.current = false;
      setSigningOut(false);
    }
  }, [client]);

  const value = useMemo<AuthContextValue>(() => ({
    configured: Boolean(client),
    loading,
    user,
    error,
    signingIn,
    signingOut,
    signInWithApple,
    signOut
  }), [client, error, loading, signInWithApple, signOut, signingIn, signingOut, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
