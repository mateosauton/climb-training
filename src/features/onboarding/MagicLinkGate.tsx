import { useEffect, useState, type FormEvent } from "react";

import { isValidEmail, mailAppHref, resendCooldownLabel, resendCooldownMs } from "./email";
import { ONBOARDING_COPY } from "./onboarding-copy";
import { markMagicLinkSent, readMagicLinkPending } from "./onboarding-storage";

interface MagicLinkGateProps {
  busy: boolean;
  serverError: string | null;
  onSend: (email: string) => Promise<boolean>;
  onDismissError: () => void;
  onRefreshSession: () => void | Promise<unknown>;
  userAgent?: string;
}

export function MagicLinkGate({
  busy,
  serverError,
  onSend,
  onDismissError,
  onRefreshSession,
  userAgent = navigator.userAgent
}: MagicLinkGateProps) {
  const pending = readMagicLinkPending();
  const [email, setEmail] = useState(pending?.email ?? "");
  const [phase, setPhase] = useState<"gate" | "check">(pending ? "check" : "gate");
  const [localError, setLocalError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!cooldownUntil || cooldownUntil <= Date.now()) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  useEffect(() => {
    if (phase !== "check") return;
    let active = true;
    const check = () => {
      if (active && document.visibilityState === "visible") onRefreshSession();
    };
    check();
    const timer = window.setInterval(check, 1500);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [onRefreshSession, phase]);

  const remaining = cooldownUntil ? cooldownUntil - now : 0;
  const coolingDown = remaining > 0;

  async function send(kind: "first" | "resend") {
    const trimmed = email.trim();
    if (!isValidEmail(trimmed)) {
      setLocalError(ONBOARDING_COPY.gateErrorEmail);
      setPhase("gate");
      return;
    }
    setLocalError(null);
    const sent = await onSend(trimmed);
    if (!sent) return;
    markMagicLinkSent(trimmed);
    setEmail(trimmed);
    setPhase("check");
    if (kind === "resend") {
      const started = Date.now();
      setNow(started);
      setResent(true);
      setCooldownUntil(started + resendCooldownMs());
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send("first");
  }

  function openInbox() {
    if (!isValidEmail(email)) {
      setLocalError(ONBOARDING_COPY.gateErrorEmail);
      return;
    }
    setLocalError(null);
    setPhase("check");
  }

  if (phase === "check") {
    return (
      <>
        <section className="auth-card" data-screen="check-email">
          <header className="auth-header">
            <h1 className="auth-title">{ONBOARDING_COPY.checkTitle}</h1>
            <p className="auth-subtitle">
              {ONBOARDING_COPY.checkBodyLead}{" "}
              <span className="auth-email">{email}</span>
            </p>
          </header>
          <p className="auth-info">{ONBOARDING_COPY.checkInfo}</p>
          {resent ? <p className="auth-resent" role="status">{ONBOARDING_COPY.checkResent}</p> : null}
          {serverError ? <p className="auth-inline-error" role="alert">{serverError}</p> : null}
          <a className="auth-primary" href={mailAppHref(userAgent)}>{ONBOARDING_COPY.checkCta}</a>
          <button
            className="auth-outline"
            type="button"
            onClick={() => void send("resend")}
            disabled={busy || coolingDown}
          >
            {coolingDown ? resendCooldownLabel(remaining) : ONBOARDING_COPY.checkResend}
          </button>
          <button
            className="auth-text-link"
            type="button"
            onClick={() => {
              setPhase("gate");
              setResent(false);
              setCooldownUntil(null);
              onDismissError();
            }}
          >
            {ONBOARDING_COPY.checkChange}
          </button>
        </section>
        <p className="auth-footer">{ONBOARDING_COPY.checkFooter}</p>
      </>
    );
  }

  return (
    <>
      <section className="auth-card" data-screen="gate">
        <header className="auth-header">
          <h1 className="auth-wordmark">Maillon</h1>
          <p className="auth-subtitle">{ONBOARDING_COPY.gateSubtitle}</p>
        </header>
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-field auth-field-stack">
            <label className="auth-label" htmlFor="auth-email">Correo</label>
            <input
              id="auth-email"
              className="auth-input auth-input-plain"
              type="email"
              name="email"
              inputMode="email"
              autoComplete="email"
              placeholder="tu@correo.com"
              value={email}
              aria-invalid={localError ? true : undefined}
              aria-describedby={localError ? "auth-email-error" : undefined}
              onChange={(event) => {
                setEmail(event.target.value);
                if (localError) setLocalError(null);
                if (serverError) onDismissError();
              }}
              disabled={busy}
            />
            {localError ? <p id="auth-email-error" className="auth-inline-error" role="alert">{localError}</p> : null}
          </div>
          {serverError ? <p className="auth-inline-error" role="alert">{serverError}</p> : null}
          <button className="auth-primary" type="submit" disabled={busy}>{ONBOARDING_COPY.gateCta}</button>
          <p className="auth-helper">{ONBOARDING_COPY.gateHelper}</p>
        </form>
        <hr className="auth-divider" />
        <div className="auth-already">
          <p>{ONBOARDING_COPY.gateAlreadyPrompt}</p>
          <button type="button" onClick={openInbox}>{ONBOARDING_COPY.gateAlreadyAction}</button>
        </div>
      </section>
      <p className="auth-footer">{ONBOARDING_COPY.gateFooter}</p>
    </>
  );
}
