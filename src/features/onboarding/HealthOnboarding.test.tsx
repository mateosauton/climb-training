import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HealthOnboarding } from "./HealthOnboarding";
import type { HealthConnector } from "./health-platform";
import { HEALTH_METRICS, ONBOARDING_COPY } from "./onboarding-copy";

function deferredConnector(): { connector: HealthConnector; resolve: (value: "connected" | "denied") => void } {
  let resolve: (value: "connected" | "denied") => void = () => undefined;
  const connector: HealthConnector = {
    connect: () => new Promise((done) => {
      resolve = done;
    })
  };
  return { connector, resolve: (value) => resolve(value) };
}

describe("HealthOnboarding", () => {
  it("shows one native CTA, the P0 metrics, HRV as optional, and a skip on every offer state", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<HealthOnboarding platform="ios" connector={{ connect: async () => "connected" }} onSkip={onSkip} onConnected={() => undefined} />);

    expect(screen.getByRole("button", { name: ONBOARDING_COPY.ctaIos })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ONBOARDING_COPY.ctaAndroid })).not.toBeInTheDocument();
    for (const metric of HEALTH_METRICS) {
      expect(screen.getByText(metric.label)).toBeInTheDocument();
      expect(screen.getByText(metric.detail)).toBeInTheDocument();
    }
    expect(screen.getByText("HRV").closest("li")).toHaveAttribute("data-metric", "optional");
    expect(screen.getByText("Sueño").closest("li")).toHaveAttribute("data-metric", "p0");
    expect(screen.getByText(ONBOARDING_COPY.saludTrust)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: ONBOARDING_COPY.saludSkip }).length).toBeGreaterThan(0);

    await user.click(screen.getAllByRole("button", { name: ONBOARDING_COPY.saludSkip })[0]);
    expect(onSkip).toHaveBeenCalledOnce();
    expect(screen.queryByRole("heading", { name: ONBOARDING_COPY.listoTitle })).not.toBeInTheDocument();
  });

  it("shows Health Connect alone on Android", () => {
    render(<HealthOnboarding platform="android" connector={{ connect: async () => "denied" }} onSkip={() => undefined} onConnected={() => undefined} />);
    expect(screen.getByRole("button", { name: ONBOARDING_COPY.ctaAndroid })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ONBOARDING_COPY.ctaIos })).not.toBeInTheDocument();
  });

  it("reaches Listo only after a connection and Hoy after that", async () => {
    const user = userEvent.setup();
    const onConnected = vi.fn();
    const pending = deferredConnector();
    render(<HealthOnboarding platform="ios" connector={pending.connector} onSkip={() => undefined} onConnected={onConnected} />);

    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.ctaIos }));
    expect(screen.getByRole("status")).toHaveTextContent(ONBOARDING_COPY.loadingIos);
    expect(screen.getByRole("button", { name: ONBOARDING_COPY.loadingContinue })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ONBOARDING_COPY.saludSkip })).toBeInTheDocument();

    pending.resolve("connected");
    expect(await screen.findByRole("heading", { name: ONBOARDING_COPY.listoTitle })).toBeInTheDocument();
    expect(screen.getByText(ONBOARDING_COPY.listoExample)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.listoCta }));
    expect(onConnected).toHaveBeenCalledOnce();
  });

  it("keeps retry, settings, and skip when permission is denied", async () => {
    const user = userEvent.setup();
    const onSkip = vi.fn();
    render(<HealthOnboarding platform="ios" connector={{ connect: async () => "denied" }} onSkip={onSkip} onConnected={() => undefined} />);

    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.ctaIos }));
    expect(await screen.findByRole("alert")).toHaveTextContent(ONBOARDING_COPY.deniedTitle);
    expect(screen.getByText(ONBOARDING_COPY.deniedBody)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ONBOARDING_COPY.deniedRetry })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ONBOARDING_COPY.deniedSettings })).toHaveAttribute("href", "x-apple-health://");
    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.deniedSkip }));
    expect(onSkip).toHaveBeenCalledOnce();
  });
});
