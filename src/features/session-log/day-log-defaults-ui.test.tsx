import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { defaultState } from "../../lib/training";
import { USER_DATA_STORAGE_KEY } from "../user-data/user-data-storage";

function seedTracker(logs: typeof defaultState.logs = []) {
  localStorage.setItem("climb4w.state.v1", JSON.stringify({
    ...defaultState,
    profile: { ...defaultState.profile, questionnaireCompleted: true },
    logs
  }));
}

function savedLog() {
  const envelope = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY) || "null");
  return envelope.users[envelope.activeUserId].sessionLogs.at(-1);
}

describe("15 second session logger", () => {
  beforeEach(() => {
    seedTracker();
    HTMLElement.prototype.hasPointerCapture ??= () => false;
    HTMLElement.prototype.setPointerCapture ??= () => undefined;
    HTMLElement.prototype.releasePointerCapture ??= () => undefined;
    HTMLElement.prototype.scrollIntoView ??= () => undefined;
  });

  it("opens the selected plan day with RPE, dolor and hard attempts ready to save", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("tab", { name: "Log" })[0]);

    expect(screen.getByLabelText("RPE")).toHaveValue(8);
    expect(screen.getByLabelText("Dolor")).toHaveValue(0);
    expect(screen.getByLabelText("Intentos duros")).toHaveValue(12);
    expect(screen.getByText(/Sugerido para este día/i)).toBeInTheDocument();
    expect(screen.getByText("Más datos (opcional)").closest("details")).not.toHaveAttribute("open");

    await user.click(screen.getByRole("button", { name: "Guardar log" }));

    await waitFor(() => {
      expect(savedLog()).toMatchObject({ rpe: 8, pain: 0, attempts: 12, notes: "" });
    });
  });

  it("saves when the optional fields are cleared", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("tab", { name: "Log" })[0]);
    await user.click(screen.getByText("Más datos (opcional)"));
    for (const label of ["Bombeo", "Movimientos", "Mejor link", "Cortes de pie", "Lastre dominada kg", "Sueno", "Energia"]) {
      await user.clear(screen.getByLabelText(label));
    }
    await user.click(screen.getByRole("button", { name: "Guardar log" }));

    await waitFor(() => {
      expect(savedLog()).toMatchObject({
        rpe: 8,
        pain: 0,
        attempts: 12,
        pump: 0,
        moves: 0,
        bestLink: 0,
        footCuts: 0,
        pullWeight: 0,
        sleep: 7,
        energy: 7
      });
    });
  });

  it("uses the latest log of the same day type and a light default on rest days", async () => {
    seedTracker([{
      id: "prior-pe",
      sessionId: "w1d3",
      createdAt: "2026-07-11T12:00:00.000Z",
      notes: "no copiar",
      rpe: 9,
      pump: 8,
      pain: 1,
      attempts: 16,
      moves: 40,
      bestLink: 12,
      footCuts: 2,
      pullWeight: 0,
      sleep: 6,
      energy: 5
    }]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("tab", { name: "Log" })[0]);
    await user.click(screen.getByLabelText("Dia del plan para registrar"));
    await user.click(await screen.findByRole("option", { name: "W2D2 - Power endurance duro" }));

    expect(screen.getByLabelText("RPE")).toHaveValue(9);
    expect(screen.getByLabelText("Dolor")).toHaveValue(1);
    expect(screen.getByLabelText("Intentos duros")).toHaveValue(16);
    expect(screen.getByText(/Según tu última sesión de Power endurance/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Notas")).toHaveValue("");

    await user.click(screen.getByLabelText("Dia del plan para registrar"));
    await user.click(await screen.findByRole("option", { name: "W1D4 - Descanso + movilidad" }));

    expect(screen.getByLabelText("RPE")).toHaveValue(3);
    expect(screen.getByLabelText("Dolor")).toHaveValue(0);
    expect(screen.getByLabelText("Intentos duros")).toHaveValue(0);
    expect(screen.getByText(/Sugerido para este día/i)).toBeInTheDocument();
  });
});
