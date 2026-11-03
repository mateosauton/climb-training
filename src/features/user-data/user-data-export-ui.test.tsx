import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

  it("downloads the active user's session history as CSV from the same backup", async () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({
      ...defaultState,
      profile: { ...defaultState.profile, questionnaireCompleted: true },
      logs: [{
        id: "log-1",
        sessionId: "plan-session-1",
        createdAt: "2026-11-03T18:00:00.000Z",
        notes: "nota, con coma",
        rpe: 8,
        pump: 4,
        pain: 1,
        attempts: 5,
        moves: 11,
        bestLink: 9,
        footCuts: 2,
        pullWeight: 0,
        sleep: 7,
        energy: 6
      }]
    }));
    const blobs: Blob[] = [];
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      blobs.push(blob as Blob);
      return "blob:session-csv";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Abrir perfil de Mateo" }));
    await user.click(await screen.findByRole("tab", { name: "Cuenta" }));
    await user.click(screen.getByRole("button", { name: "Descargar CSV" }));

    expect(blobs).toHaveLength(1);
    await expect(blobs[0].text()).resolves.toBe(
      "date,session_id,rpe,pain,best_link,foot_cuts,attempts,moves,pump,energy,sleep,notes\n" +
      "2026-11-03,plan-session-1,8,1,9,2,5,11,4,6,7,\"nota, con coma\"\n"
    );
  });
});
