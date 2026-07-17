import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { defaultState } from "../../lib/training";

describe("user data export UI", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("climb4w.state.v1", JSON.stringify({
      ...defaultState,
      profile: { ...defaultState.profile, questionnaireCompleted: true }
    }));
  });

  it("labels the export as sensitive and previews the complete user envelope", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Abrir perfil de Mateo" }));
    await user.click(await screen.findByRole("tab", { name: "Cuenta" }));
    expect(screen.getByText("Respaldo de datos")).toBeInTheDocument();
    expect(screen.getByText(/incluye perfil, sesiones y análisis/)).toBeInTheDocument();

    const exported = JSON.parse((screen.getByLabelText("JSON exportado del tracker") as HTMLTextAreaElement).value);
    expect(exported.schemaVersion).toBe(3);
    expect(exported.users[exported.activeUserId].facts.length).toBeGreaterThan(0);
    expect(exported).not.toHaveProperty("plan");
    expect(exported.app.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
