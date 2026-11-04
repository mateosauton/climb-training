import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import App from "../../App";
import { ONBOARDING_COPY } from "./onboarding-copy";
import { finishHealthOnboarding } from "./onboarding-storage";

async function openAccount(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Abrir perfil de Mateo" }));
  await user.click(screen.getByRole("tab", { name: "Cuenta" }));
}

describe("reconnect Salud from Perfil", () => {
  beforeEach(() => localStorage.clear());

  it("opens the Salud offer after a skip without the first-run gate", async () => {
    finishHealthOnboarding("test-user", "skip");
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole("heading", { name: ONBOARDING_COPY.saludTitle })).not.toBeInTheDocument();
    await openAccount(user);
    expect(screen.queryByRole("button", { name: ONBOARDING_COPY.profileHealthDisconnect })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.profileHealthConnect }));

    expect(screen.getByRole("heading", { name: ONBOARDING_COPY.saludTitle })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ONBOARDING_COPY.ctaIos })).toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: ONBOARDING_COPY.saludSkip })[0]);

    expect(screen.getByTestId("hoy")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Cuenta" }));
    expect(screen.getByRole("button", { name: ONBOARDING_COPY.profileHealthConnect })).toBeInTheDocument();
  });

  it("opens the Salud offer after disconnect", async () => {
    finishHealthOnboarding("test-user", "connected");
    const user = userEvent.setup();
    render(<App />);

    await openAccount(user);
    expect(screen.queryByRole("button", { name: ONBOARDING_COPY.profileHealthConnect })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.profileHealthDisconnect }));
    expect(screen.getByRole("button", { name: ONBOARDING_COPY.profileHealthConnect })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.profileHealthConnect }));

    expect(screen.getByRole("heading", { name: ONBOARDING_COPY.saludTitle })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: ONBOARDING_COPY.profileHealthDisconnect })).not.toBeInTheDocument();
  });
});
