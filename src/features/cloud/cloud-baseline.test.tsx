import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import App from "../../App";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import { defaultState } from "../../lib/training";
import { migrateLegacyUserData } from "../user-data/user-data-migration";
import { USER_DATA_STORAGE_KEY } from "../user-data/user-data-storage";
import { projectTrackerState } from "../user-data/user-facts";
import type { UserDataEnvelope } from "../user-data/user-data-types";

const emptyHydration = {
  facts: [],
  sessionLogs: [],
  guided: { schemaVersion: 1 as const, activeRun: null, history: [] },
  activePlan: null
};

function seedMateoEnvelope() {
  let next = 0;
  const envelope = migrateLegacyUserData({
    tracker: structuredClone(defaultState),
    guided: emptyGuidedSessionState(),
    now: "2026-11-02T00:00:00.000Z",
    makeId: () => `mateo-${++next}`
  });
  localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(envelope));
}

describe("cloud baseline", () => {
  it("starts a fresh cloud signup with an empty name and no injury or recovery pills", async () => {
    const user = userEvent.setup();
    seedMateoEnvelope();
    render(<App cloudVerified cloudHydration={emptyHydration} />);

    expect(screen.getByRole("button", { name: "Abrir perfil de Escalador" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("");

    await user.click(screen.getByRole("button", { name: "4. Carga y recuperacion" }));
    for (const label of ["Dedos sensibles", "Codo cargado", "Hombro cargado", "Piel limitada", "Sueno bajo", "Energia baja", "Sin senales"]) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "false");
    }
    expect(document.querySelectorAll('input[name="recoveryNotes"]')).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "5. Lesiones y salud" }));
    for (const label of ["Ninguna", "Dedos / polea", "Codo", "Hombro", "Muneca"]) {
      expect(screen.getByRole("button", { name: label })).toHaveAttribute("aria-pressed", "false");
    }
    expect(document.querySelectorAll('input[name="injuryHistory"]')).toHaveLength(0);
  });

  it("keeps the Mateo demo seed on the logged-out questionnaire", () => {
    render(<App />);

    expect(screen.getByRole("button", { name: "Abrir perfil de Mateo" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Mateo");
  });
});

describe("questionnaire multi-select in the app", () => {
  it("selects Hangboard alone and lets it be cleared", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "4. Carga y recuperacion" }));

    const hangboard = screen.getByRole("button", { name: "Hangboard" });
    await user.click(hangboard);

    expect(hangboard).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Board 1-2/sem" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Board 3+/sem" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Codo cargado" })).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelectorAll('input[name="trainingLoad"]')).toHaveLength(1);
    expect(document.querySelector('input[name="trainingLoad"]')).toHaveValue("Hangboard");

    await user.click(hangboard);

    expect(hangboard).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelectorAll('input[name="trainingLoad"]')).toHaveLength(0);
  });

  it("does not preselect injury or recovery pills from the demo freeform seed", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "5. Lesiones y salud" }));
    expect(screen.getByRole("button", { name: "Codo" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Hombro" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Dedos / polea" })).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelectorAll('input[name="injuryHistory"]')).toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "4. Carga y recuperacion" }));
    expect(screen.getByRole("button", { name: "Sueno bajo" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: "Energia baja" })).toHaveAttribute("aria-pressed", "false");
    expect(document.querySelectorAll('input[name="recoveryNotes"]')).toHaveLength(0);
  });

  it("saves a questionnaire without legacy freeform injury or recovery tokens", async () => {
    const user = userEvent.setup();
    render(<App />);

    for (let step = 0; step < 5; step += 1) {
      await user.click(screen.getByRole("button", { name: "Siguiente" }));
    }
    await user.click(screen.getByRole("button", { name: "Guardar cuestionario" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    const envelope = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY) || "null") as UserDataEnvelope;
    const projected = projectTrackerState(envelope.users[envelope.activeUserId]);
    expect(projected.profile.name).toBe("Mateo");
    expect(projected.profile.injuryHistory).toBe("");
    expect(projected.profile.recoveryNotes).toBe("");
    expect(projected.profile.injuryHistory).not.toMatch(/codos|Vigilar|Sin lesiones/);
    expect(projected.profile.recoveryNotes).not.toMatch(/sueno|energia|bombeo/i);
  });
});
