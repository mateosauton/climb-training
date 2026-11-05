import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";

import App from "../../App";
import { ONBOARDING_COPY } from "./onboarding-copy";

describe("first-run onboarding", () => {
  beforeEach(() => localStorage.clear());

  it("keeps the old questionnaire off Hoy and offers it from the first session log and Perfil", async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Cuestionario del escalador")).not.toBeInTheDocument();
    expect(screen.getByTestId("hoy")).toBeInTheDocument();

    await user.click(screen.getAllByRole("tab", { name: "Log" })[0]);
    expect(screen.getByTestId("first-session-questionnaire")).toHaveTextContent(ONBOARDING_COPY.questionnairePromptBody);
    await user.click(screen.getByRole("button", { name: ONBOARDING_COPY.questionnairePromptCta }));
    expect(screen.getByRole("dialog", { name: "Cuestionario del escalador" })).toBeInTheDocument();
  });
});
