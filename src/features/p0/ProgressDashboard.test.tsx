import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ProgressDashboard } from "./ProgressDashboard";

const training = { createdAt: "2026-11-03T12:00:00.000Z", sessionId: "plan-1", bestLink: 8, footCuts: 3, rpe: 7, pain: 1, moves: 12, pullWeight: 0, notes: "", id: "train" };

describe("progress dashboard anchor", () => {
  it("logs a fixed hang on the same edge and keeps it out of the weekly KPIs", async () => {
    const user = userEvent.setup();
    const onSaveAnchor = vi.fn();
    render(
      <ProgressDashboard
        logs={[training]}
        today="2026-11-03"
        athleteInitials="MS"
        onOpenProfile={vi.fn()}
        onSaveAnchor={onSaveAnchor}
        anchorStatus="idle"
      />
    );

    expect(screen.getByRole("heading", { name: "Progreso" })).toBeInTheDocument();
    expect(screen.getByText("8 movs")).toBeInTheDocument();
    expect(screen.getByText(/Sin ancla/)).toBeInTheDocument();
    expect(screen.getByText(/mismo canto de 20 mm/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Guardar ancla" }));
    expect(onSaveAnchor).not.toHaveBeenCalled();
    expect(screen.getByText("Anotá el resultado.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText("Canto"));
    await user.type(screen.getByLabelText("Canto"), "Beastmaker 20 mm");
    await user.type(screen.getByLabelText("Segundos"), "32");
    await user.click(screen.getByRole("button", { name: "Guardar ancla" }));

    expect(onSaveAnchor).toHaveBeenCalledWith({ protocol: "hang-20mm", result: 32, setup: "Beastmaker 20 mm" });
    expect(screen.getByText("8 movs")).toBeInTheDocument();
  });

  it("shows the four-week history and the due date for the protocol in use", async () => {
    const user = userEvent.setup();
    render(
      <ProgressDashboard
        logs={[
          training,
          { id: "h1", sessionId: "anchor:hang-20mm", createdAt: "2026-10-06T12:00:00.000Z", notes: "Beastmaker 20 mm", moves: 28, pullWeight: 0, bestLink: 99, footCuts: 40, rpe: 10, pain: 9 },
          { id: "h2", sessionId: "anchor:weighted-pullups", createdAt: "2026-10-06T12:00:00.000Z", notes: "Barra de casa", moves: 0, pullWeight: 10, bestLink: 0, footCuts: 0, rpe: 0, pain: 0 }
        ]}
        today="2026-11-03"
        athleteInitials="MS"
        onOpenProfile={vi.fn()}
        onSaveAnchor={vi.fn()}
        anchorStatus="idle"
      />
    );

    expect(screen.getByText("8 movs")).toBeInTheDocument();
    expect(screen.queryByText("99 movs")).not.toBeInTheDocument();
    expect(screen.getByText("Toca el ancla. La última suspensión 20 mm fue el 6 oct.")).toBeInTheDocument();
    expect(screen.getByText("28 s")).toBeInTheDocument();
    expect(screen.getByText("10 kg")).toBeInTheDocument();
    expect(screen.getAllByText("primera marca")).toHaveLength(2);

    await user.click(screen.getByRole("radio", { name: "Dominadas lastradas" }));
    expect(screen.getByText(/mismo agarre/)).toBeInTheDocument();
    expect(screen.getByText("Toca el ancla. La última dominadas lastradas fue el 6 oct.")).toBeInTheDocument();
    expect(screen.getByLabelText("Barra y agarre")).toHaveValue("Barra de casa");
  });
});
