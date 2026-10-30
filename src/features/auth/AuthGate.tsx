import { CircleAlert, Eye, EyeOff, LoaderCircle, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";

import { AUTH_COPY } from "./auth-copy";
import {
  acceptNext,
  authPath,
  authScreenFromPathname,
  destinationAfterLogin,
  isCredentialScreen,
  loginRedirectFor,
  navigate,
  type AuthScreen
} from "./auth-routes";
import { useAuth } from "./AuthProvider";

type AuthGateProps = {
  children: (user: { id: string; email: string | null }) => ReactNode;
};

function useAuthLocation() {
  const [location, setLocation] = useState(() => ({
    pathname: window.location.pathname,
    search: window.location.search
  }));

  useEffect(() => {
    const sync = () => setLocation({
      pathname: window.location.pathname,
      search: window.location.search
    });
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  return location;
}

function AuthSurface({ children }: { children: ReactNode }) {
  return (
    <main className="auth-gate">
      <div className="auth-shell">{children}</div>
    </main>
  );
}

function GateLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const follow = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    navigate(href);
  };
  return <a className={className} href={href} onClick={follow}>{children}</a>;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  onBlur,
  autoComplete,
  placeholder,
  disabled,
  invalid,
  describedBy,
  extra,
  hint,
  showLabel = AUTH_COPY.showPassword,
  hideLabel = AUTH_COPY.hidePassword
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  autoComplete: string;
  placeholder?: string;
  disabled: boolean;
  invalid?: boolean;
  describedBy?: string;
  extra?: ReactNode;
  hint?: ReactNode;
  showLabel?: string;
  hideLabel?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-field">
      <label className="auth-label" htmlFor={id}>{label}</label>
      <div className="auth-control">
        <input
          id={id}
          className="auth-input"
          type={visible ? "text" : "password"}
          name={autoComplete === "current-password" ? "current-password" : "new-password"}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          disabled={disabled}
          required
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
        />
        <button
          className="auth-toggle"
          type="button"
          aria-label={visible ? hideLabel : showLabel}
          onClick={() => setVisible((current) => !current)}
          disabled={disabled}
        >
          {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {extra}
      {hint}
    </div>
  );
}

function LegalPage({ screen }: { screen: "terms" | "privacy" }) {
  const title = screen === "terms" ? "Términos" : "Política de privacidad";
  const body = screen === "terms"
    ? "Estos términos rigen el uso de Maillon. Al crear una cuenta aceptas usar el servicio para guardar tu plan y tus sesiones."
    : "Maillon guarda tus sesiones en este dispositivo y las sincroniza con tu cuenta. No vendemos tus datos.";
  return (
    <AuthSurface>
      <section className="auth-card">
        <p className="auth-wordmark">Maillon</p>
        <h1 className="auth-title">{title}</h1>
        <p className="auth-subtitle">{body}</p>
        <GateLink className="auth-outline" href="/escalada/login">Volver a iniciar sesión</GateLink>
      </section>
    </AuthSurface>
  );
}

export function AuthGate({ children }: AuthGateProps) {
  const auth = useAuth();
  const location = useAuthLocation();
  const screen = authScreenFromPathname(location.pathname);
  const nextRaw = new URLSearchParams(location.search).get("next");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [passwordInvalid, setPasswordInvalid] = useState(false);

  useEffect(() => {
    if (auth.loading || !auth.configured) return;
    if (screen === "terms" || screen === "privacy") return;
    if (auth.recoveryMode && screen !== "reset-new") {
      navigate(authPath("reset-new", nextRaw), "replace");
      return;
    }
    if (auth.user && !auth.recoveryMode && isCredentialScreen(screen)) {
      navigate(destinationAfterLogin(nextRaw), "replace");
      return;
    }
    if (!auth.user && !auth.recoveryMode && screen === null) {
      navigate(loginRedirectFor(location.pathname, location.search), "replace");
    }
  }, [auth.configured, auth.loading, auth.recoveryMode, auth.user, location.pathname, location.search, nextRaw, screen]);

  const openScreen = (nextScreen: AuthScreen) => {
    setPassword("");
    setConfirmation("");
    setVerificationCode("");
    setLocalError(null);
    setPasswordInvalid(false);
    auth.clearFeedback();
    navigate(authPath(nextScreen, new URLSearchParams(window.location.search).get("next")));
  };

  const validatePassword = (requireMatch: boolean) => {
    const tooShort = password.length < 8;
    setPasswordInvalid(tooShort);
    if (tooShort) return false;
    if (requireMatch && password !== confirmation) {
      setLocalError(AUTH_COPY.passwordMismatch);
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
    if (screen === "reset-new" || auth.recoveryMode) {
      if (validatePassword(true)) await auth.updatePassword(password);
      return;
    }
    if (screen === "signup") {
      if (validatePassword(false)) await auth.signUp(email.trim(), password);
      return;
    }
    if (screen === "reset") {
      await auth.requestPasswordReset(email.trim());
      return;
    }
    await auth.signIn(email.trim(), password);
  };

  if (screen === "terms" || screen === "privacy") return <LegalPage screen={screen} />;

  if (auth.loading || (auth.user && !auth.recoveryMode && isCredentialScreen(screen)) || (auth.recoveryMode && screen !== "reset-new")) {
    return (
      <AuthSurface>
        <div className="auth-status" role="status">
          <LoaderCircle className="auth-spinner" size={20} aria-hidden="true" />
          Verificando tu sesión…
        </div>
      </AuthSurface>
    );
  }

  if (!auth.configured) {
    return (
      <AuthSurface>
        <section className="auth-card">
          <p className="auth-wordmark">Maillon</p>
          <h1 className="auth-title">Configura el acceso por correo</h1>
          <p className="auth-subtitle">Falta conectar este despliegue con Supabase Auth.</p>
          <p className="auth-note" role="alert">
            <ShieldCheck size={18} aria-hidden="true" /> Define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, luego vuelve a desplegar.
          </p>
        </section>
      </AuthSurface>
    );
  }

  if (auth.user && !auth.recoveryMode) return children(auth.user);

  const formScreen: AuthScreen = screen === "signup" || screen === "reset" || screen === "reset-new" ? screen : "login";
  const isVerifyingEmail = Boolean(auth.pendingVerificationEmail);
  const isNewPassword = formScreen === "reset-new" || auth.recoveryMode;
  const resetSent = formScreen === "reset" && auth.notice === AUTH_COPY.resetSent;
  const visibleError = localError ?? auth.error;
  const needsConfirm = visibleError === AUTH_COPY.confirmEmail;
  const showBanner = acceptNext(nextRaw) !== null;
  const title = isNewPassword
    ? AUTH_COPY.newPasswordTitle
    : isVerifyingEmail
      ? "Confirma tu correo"
      : formScreen === "signup"
        ? AUTH_COPY.signupTitle
        : formScreen === "reset"
          ? AUTH_COPY.resetTitle
          : AUTH_COPY.wordmark;
  const description = isNewPassword
    ? AUTH_COPY.newPasswordSubtitle
    : isVerifyingEmail
      ? "Ingresa el código de seis dígitos que enviamos a tu correo."
      : formScreen === "signup"
        ? AUTH_COPY.signupSubtitle
        : formScreen === "reset"
          ? AUTH_COPY.resetSubtitle
          : AUTH_COPY.loginSubtitle;

  return (
    <AuthSurface>
      {showBanner ? <p className="auth-banner" role="status">{AUTH_COPY.deepLink}</p> : null}
      <section className="auth-card" data-screen={isNewPassword ? "reset-new" : formScreen}>
        <header className="auth-header">
          {title === AUTH_COPY.wordmark ? (
            <h1 className="auth-wordmark">{AUTH_COPY.wordmark}</h1>
          ) : (
            <>
              <p className="auth-wordmark">{AUTH_COPY.wordmark}</p>
              <h1 className="auth-title">{title}</h1>
            </>
          )}
          <p className="auth-subtitle">{description}</p>
        </header>

        {needsConfirm ? (
          <div className="auth-error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <p>
              {AUTH_COPY.confirmEmail}{" "}
              <button type="button" onClick={() => void auth.resendConfirmation(email.trim())} disabled={auth.busy}>
                {AUTH_COPY.resendLink}
              </button>
            </p>
          </div>
        ) : visibleError ? (
          <div className="auth-error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <p>{visibleError}</p>
          </div>
        ) : null}
        {resetSent ? <p className="auth-note" role="status">{AUTH_COPY.resetSent}</p> : null}
        {auth.notice && !resetSent ? <p className="auth-note" role="status">{auth.notice}</p> : null}

        <form className="auth-form" onSubmit={submit}>
          {isVerifyingEmail ? (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-verification-code">Código de verificación</label>
              <div className="auth-control">
                <input
                  id="auth-verification-code"
                  className="auth-input"
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
            </div>
          ) : !isNewPassword ? (
            <div className="auth-field">
              <label className="auth-label" htmlFor="auth-email">Correo</label>
              <div className="auth-control">
                <input
                  id="auth-email"
                  className="auth-input"
                  type="email"
                  name="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="tu@correo.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={auth.busy}
                  required
                />
              </div>
            </div>
          ) : null}

          {!isVerifyingEmail && !resetSent && formScreen !== "reset" ? (
            <PasswordField
              id="auth-password"
              label={isNewPassword ? "Nueva contraseña" : "Contraseña"}
              value={password}
              onChange={setPassword}
              onBlur={() => {
                if (formScreen === "signup" || isNewPassword) setPasswordInvalid(password.length > 0 && password.length < 8);
              }}
              autoComplete={formScreen === "login" && !isNewPassword ? "current-password" : "new-password"}
              placeholder={formScreen === "signup" ? "Crea una contraseña" : "••••••••"}
              disabled={auth.busy}
              invalid={passwordInvalid}
              describedBy={formScreen === "signup" || isNewPassword ? "auth-password-hint" : undefined}
              hint={formScreen === "signup" || isNewPassword ? (
                <p id="auth-password-hint" className="auth-hint" data-invalid={passwordInvalid || undefined}>
                  {AUTH_COPY.passwordHint}
                </p>
              ) : null}
              extra={formScreen === "login" ? (
                <a
                  className="auth-forgot"
                  href={authPath("reset", nextRaw)}
                  onClick={(event) => {
                    event.preventDefault();
                    openScreen("reset");
                  }}
                >
                  {AUTH_COPY.forgot}
                </a>
              ) : null}
            />
          ) : null}

          {isNewPassword && !isVerifyingEmail ? (
            <PasswordField
              id="auth-confirmation"
              label="Confirmar contraseña"
              value={confirmation}
              onChange={setConfirmation}
              onBlur={() => {
                if (confirmation && confirmation !== password) setLocalError(AUTH_COPY.passwordMismatch);
              }}
              autoComplete="new-password"
              placeholder="••••••••"
              disabled={auth.busy}
              invalid={localError === AUTH_COPY.passwordMismatch}
              showLabel="Mostrar confirmación de contraseña"
              hideLabel="Ocultar confirmación de contraseña"
            />
          ) : null}

          {!resetSent ? (
            <button className="auth-primary" type="submit" disabled={auth.busy}>
              {auth.busy ? <LoaderCircle className="auth-spinner" size={18} aria-hidden="true" /> : null}
              {isVerifyingEmail ? "Confirmar código" : isNewPassword ? AUTH_COPY.savePassword : formScreen === "signup" ? AUTH_COPY.createAccount : formScreen === "reset" ? AUTH_COPY.sendLink : AUTH_COPY.signIn}
            </button>
          ) : null}

          {formScreen === "signup" && !isVerifyingEmail ? (
            <p className="auth-legal">
              Al crear tu cuenta aceptas los{" "}
              <GateLink href="/escalada/terminos">Términos</GateLink>
              {" "}y la{" "}
              <GateLink href="/escalada/privacidad">Política de privacidad</GateLink>.
            </p>
          ) : null}
        </form>

        {!isNewPassword && !isVerifyingEmail && formScreen === "login" ? (
          <>
            <hr className="auth-divider" />
            <div className="auth-switch">
              <p className="auth-switch-prompt">{AUTH_COPY.noAccount}</p>
              <a
                className="auth-outline"
                href={authPath("signup", nextRaw)}
                onClick={(event) => {
                  event.preventDefault();
                  openScreen("signup");
                }}
              >
                {AUTH_COPY.createAccount}
              </a>
            </div>
          </>
        ) : null}

        {!isNewPassword && !isVerifyingEmail && formScreen === "signup" ? (
          <>
            <hr className="auth-divider" />
            <div className="auth-switch">
              <p className="auth-switch-prompt">{AUTH_COPY.hasAccount}</p>
              <a
                className="auth-outline"
                href={authPath("login", nextRaw)}
                onClick={(event) => {
                  event.preventDefault();
                  openScreen("login");
                }}
              >
                Inicia sesión
              </a>
            </div>
          </>
        ) : null}

        {!isVerifyingEmail && (formScreen === "reset" || isNewPassword) ? (
          <GateLink className="auth-text-link" href={authPath("login", nextRaw)}>{AUTH_COPY.backToSignIn}</GateLink>
        ) : null}
      </section>
      <p className="auth-footer">{AUTH_COPY.footer}</p>
    </AuthSurface>
  );
}
