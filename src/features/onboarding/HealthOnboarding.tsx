import { useState } from "react";

import { healthSettingsHref, nativeHealthPlatform, type HealthConnector, type HealthPlatform, createStubHealthConnector } from "./health-platform";
import { HEALTH_METRICS, LISTO_CHIPS, ONBOARDING_COPY } from "./onboarding-copy";

type SaludPhase = "offer" | "connecting" | "denied" | "ready";

interface HealthOnboardingProps {
  platform?: HealthPlatform;
  connector?: HealthConnector;
  onSkip: () => void;
  onConnected: () => void;
}

export function HealthOnboarding({
  platform = nativeHealthPlatform(navigator.userAgent),
  connector = createStubHealthConnector(),
  onSkip,
  onConnected
}: HealthOnboardingProps) {
  const [phase, setPhase] = useState<SaludPhase>("offer");
  const cta = platform === "android" ? ONBOARDING_COPY.ctaAndroid : ONBOARDING_COPY.ctaIos;
  const loading = platform === "android" ? ONBOARDING_COPY.loadingAndroid : ONBOARDING_COPY.loadingIos;

  async function connect() {
    setPhase("connecting");
    try {
      const result = await connector.connect(platform);
      setPhase(result === "connected" ? "ready" : "denied");
    } catch {
      setPhase("denied");
    }
  }

  return (
    <main className="health-gate" data-screen={phase === "ready" ? "listo" : phase === "offer" ? "salud" : `salud-${phase}`}>
      <div className="health-shell">
        {phase === "ready" ? <Listo onContinue={onConnected} /> : (
          <>
            <header className="health-top">
              <p className="health-wordmark">Maillon</p>
              <button type="button" className="health-text" onClick={onSkip}>{ONBOARDING_COPY.saludSkip}</button>
            </header>
            <p className="health-overline">{ONBOARDING_COPY.saludOverline}</p>
            <h1 className="health-title">{ONBOARDING_COPY.saludTitle}</h1>
            <p className="health-body">{ONBOARDING_COPY.saludBody}</p>
            <ul className="health-metrics">
              {HEALTH_METRICS.map((metric) => (
                <li key={metric.id} data-metric={metric.priority}>
                  <span>{metric.label}</span>
                  <span>{metric.detail}</span>
                </li>
              ))}
            </ul>
            {phase === "connecting" ? (
              <div className="health-status" role="status">
                <p>{loading}</p>
                <p>{ONBOARDING_COPY.loadingBody}</p>
                <span className="health-progress" />
              </div>
            ) : null}
            {phase === "denied" ? (
              <div className="health-denied" role="alert">
                <p>{ONBOARDING_COPY.deniedTitle}</p>
                <p>{ONBOARDING_COPY.deniedBody}</p>
              </div>
            ) : null}
            <div className="health-actions">
              {phase === "offer" ? (
                <button type="button" className="health-primary" onClick={() => void connect()}>{cta}</button>
              ) : null}
              {phase === "connecting" ? (
                <button type="button" className="health-text health-text-block" onClick={onSkip}>{ONBOARDING_COPY.loadingContinue}</button>
              ) : null}
              {phase === "denied" ? (
                <>
                  <button type="button" className="health-primary" onClick={() => void connect()}>{ONBOARDING_COPY.deniedRetry}</button>
                  <a className="health-secondary" href={healthSettingsHref(platform)}>{ONBOARDING_COPY.deniedSettings}</a>
                  <button type="button" className="health-text health-text-block" onClick={onSkip}>{ONBOARDING_COPY.deniedSkip}</button>
                </>
              ) : null}
              {phase === "offer" ? (
                <button type="button" className="health-text health-text-block" onClick={onSkip}>{ONBOARDING_COPY.saludSkip}</button>
              ) : null}
            </div>
            <p className="health-trust">{ONBOARDING_COPY.saludTrust}</p>
          </>
        )}
      </div>
    </main>
  );
}

function Listo({ onContinue }: { onContinue: () => void }) {
  return (
    <>
      <p className="health-overline">{ONBOARDING_COPY.listoOverline}</p>
      <h1 className="health-title">{ONBOARDING_COPY.listoTitle}</h1>
      <p className="health-body">{ONBOARDING_COPY.listoBody}</p>
      <ul className="health-chips">
        {LISTO_CHIPS.map((chip) => (
          <li key={chip.label}>
            <span>{chip.label}</span>
            <strong>{chip.value}</strong>
            <span>{chip.detail}</span>
          </li>
        ))}
      </ul>
      <div className="health-reading">
        <p>{ONBOARDING_COPY.listoReadingLabel}</p>
        <p>{ONBOARDING_COPY.listoReading}</p>
      </div>
      <p className="health-example">{ONBOARDING_COPY.listoExample}</p>
      <button type="button" className="health-primary health-primary-bottom" onClick={onContinue}>{ONBOARDING_COPY.listoCta}</button>
    </>
  );
}
