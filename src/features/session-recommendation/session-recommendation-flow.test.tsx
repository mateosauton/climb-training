import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "../../App";
import { defaultState } from "../../lib/training";
import { USER_DATA_STORAGE_KEY } from "../user-data/user-data-storage";

describe("log post-save recommendation flow", () => {
  beforeEach(() => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({
      ...defaultState,
      profile: { ...defaultState.profile, questionnaireCompleted: true }
    }));
  });

  it("saves, clears the form, and offers a fresh log or dashboard continuation", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("tab", { name: "Log" })[0]);
    await user.clear(screen.getByLabelText("RPE"));
    await user.type(screen.getByLabelText("RPE"), "8");
    await user.type(screen.getByLabelText("Notas"), "Beta nueva en el crux");
    await user.click(screen.getByRole("button", { name: "Guardar log" }));

    expect(await screen.findByText("Evaluación de tu sesión")).toBeInTheDocument();
    expect(screen.getByText(/\d+\/10/)).toBeInTheDocument();
    expect(screen.queryByText("Historial")).not.toBeInTheDocument();

    await waitFor(() => {
      const envelope = JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY) || "null");
      expect(envelope.users[envelope.activeUserId].sessionLogs.at(-1).notes).toBe("Beta nueva en el crux");
    });

    await user.click(screen.getByRole("button", { name: "Registrar otra sesión" }));
    expect(screen.getByLabelText("RPE")).toHaveValue(8);
    expect(screen.getByLabelText("Notas")).toHaveValue("");

    await user.type(screen.getByLabelText("Notas"), "segunda sesión");
    await user.click(screen.getByRole("button", { name: "Guardar log" }));
    await user.click(await screen.findByRole("button", { name: "Continuar" }));
    expect(screen.getAllByRole("tab", { name: "Dashboard" })[0]).toHaveAttribute("data-state", "active");
  });
});
