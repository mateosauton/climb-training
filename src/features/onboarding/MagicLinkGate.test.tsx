import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ONBOARDING_COPY } from "./onboarding-copy";
import { MagicLinkGate } from "./MagicLinkGate";

describe("MagicLinkGate", () => {
  beforeEach(() => localStorage.clear());

  it("asks only for an email and sends a magic link", async () => {
    const onSend = vi.fn(async () => true);
    const user = userEvent.setup();
    render(
      <MagicLinkGate busy={false} serverError={null} onSend={onSend} onDismissError={() => undefined} onRefreshSession={() => undefined} />
    );

    expect(screen.getByRole("heading", { name: "Maillon" })).toBeInTheDocument();
    expect(screen.getByText(ONBOARDING_COPY.gateSubtitle)).toBeInTheDocument();
    expect(screen.queryByLabelText("Contraseña")).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/código/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/otp/i)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Correo"), "mateo@correo.com");
    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.gateCta }));

    expect(onSend).toHaveBeenCalledWith("mateo@correo.com");
    expect(screen.getByRole("heading", { name: ONBOARDING_COPY.checkTitle })).toBeInTheDocument();
    expect(screen.getByText(ONBOARDING_COPY.checkInfo)).toBeInTheDocument();
    expect(screen.getByText("mateo@correo.com")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: ONBOARDING_COPY.checkCta })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: ONBOARDING_COPY.checkResend })).toBeEnabled();
  });

  it("blocks a local invalid email before sending", async () => {
    const onSend = vi.fn(async () => true);
    const user = userEvent.setup();
    render(
      <MagicLinkGate busy={false} serverError={null} onSend={onSend} onDismissError={() => undefined} onRefreshSession={() => undefined} />
    );

    await user.type(screen.getByLabelText("Correo"), "mateo@correo");
    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.gateCta }));

    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent(ONBOARDING_COPY.gateErrorEmail);
    expect(screen.getByRole("heading", { name: "Maillon" })).toBeInTheDocument();
  });

  it("starts a 60 second cooldown only after a resend", async () => {
    const onSend = vi.fn(async () => true);
    const user = userEvent.setup();
    render(
      <MagicLinkGate busy={false} serverError={null} onSend={onSend} onDismissError={() => undefined} onRefreshSession={() => undefined} />
    );

    await user.type(screen.getByLabelText("Correo"), "mateo@correo.com");
    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.gateCta }));
    expect(screen.getByRole("button", { name: ONBOARDING_COPY.checkResend })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.checkResend }));

    expect(screen.getByRole("status")).toHaveTextContent(ONBOARDING_COPY.checkResent);
    expect(screen.getByRole("button", { name: /Reenviar en/ })).toBeDisabled();
  });
});
