import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import App from "../../App";
import { readPlanSchedule, resolveActivePlan } from "./active-plan";
import { ActivePlanNotice, PlanScreen } from "./PlanScreen";

function readyPlan(title: string, planId: string, startDate: string) {
  const resolved = resolveActivePlan({
    id: planId,
    published_at: `${startDate}T12:00:00.000Z`,
    sessions: [
      {
        id: `${planId}-next`,
        position: 1,
        scheduled_offset_days: 0,
        phase: "Fuerza y potencia",
        objective: "Construir fuerza.",
        intensity: "moderate",
        expected_duration_minutes: 45,
        recovery_guidance: "Descansá.",
        blocks: [{
          id: `${planId}-block`,
          position: 1,
          phase: "work",
          title,
          instructions: "Hangboard controlado.",
          duration_minutes: 20,
          exercises: [{ id: `${planId}-ex`, position: 1, exercise_id: "ex", exercise_content_version: 1, sets: 7, reps: 3, duration_seconds: null }]
        }]
      },
      {
        id: `${planId}-later`,
        position: 2,
        scheduled_offset_days: 2,
        phase: "Fuerza y potencia",
        objective: "Proyecto.",
        intensity: "high",
        expected_duration_minutes: 60,
        recovery_guidance: "Descansá.",
        blocks: [{
          id: `${planId}-block-2`,
          position: 1,
          phase: "work",
          title: "Bloque proyecto",
          instructions: "4 intentos al 6B del muro.",
          duration_minutes: 30,
          exercises: [{ id: `${planId}-ex-2`, position: 1, exercise_id: "ex2", exercise_content_version: 1, sets: 4, reps: 1, duration_seconds: null }]
        }]
      }
    ]
  }, readPlanSchedule({ publishedAt: `${startDate}T12:00:00.000Z` }));
  if (resolved.status !== "ready") throw new Error(resolved.status);
  return resolved.plan;
}

describe("plan screen", () => {
  it("shows the Maillon week and starts the next session by UUID", async () => {
    const user = userEvent.setup();
    const plan = readyPlan("Fuerza de dedos", "plan-fingers", "2026-11-02");
    const onStartSession = vi.fn();
    render(
      <PlanScreen
        planId={plan.planId}
        sessions={plan.sessions}
        completedSessionIds={new Set()}
        today="2026-11-02"
        athleteInitials="MS"
        onStartSession={onStartSession}
        onOpenProfile={vi.fn()}
      />
    );

    expect(screen.getByRole("heading", { name: "Esta semana" })).toBeInTheDocument();
    expect(screen.getByText("Semana 1 de 1 · Fuerza y potencia")).toBeInTheDocument();
    expect(screen.getByText("HOY · LUN 2")).toBeInTheDocument();
    expect(screen.getByText("Fuerza de dedos")).toBeInTheDocument();
    expect(screen.getByText(/7x3/)).toBeInTheDocument();
    expect(screen.queryByText(/limit \+ fuerza/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Plan de demostración")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Empezar" }));
    expect(onStartSession).toHaveBeenCalledWith("plan-fingers-next");

    await user.click(screen.getByRole("button", { name: "Saltar" }));
    expect(screen.getByText(/Saltaste esta sesión/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Deshacer" }));
    await user.click(screen.getByRole("button", { name: "Dolor → cambiar a movilidad" }));
    expect(screen.getByRole("heading", { name: "Movilidad" })).toBeInTheDocument();
    expect(screen.getByText("Fuerza de dedos")).toBeInTheDocument();
  });

  it("renders a second active plan with different sessions", () => {
    const plan = readyPlan("Potencia corta", "plan-power", "2026-12-08");
    render(
      <PlanScreen
        planId={plan.planId}
        sessions={plan.sessions}
        completedSessionIds={new Set([plan.sessions[0]?.id ?? ""])}
        today="2026-12-08"
        athleteInitials="MS"
        onStartSession={vi.fn()}
        onOpenProfile={vi.fn()}
      />
    );

    expect(screen.getByTestId("plan-screen")).toHaveAttribute("data-plan-id", "plan-power");
    expect(screen.getByText("Potencia corta · hecha")).toBeInTheDocument();
    expect(screen.queryByText("Fuerza de dedos")).not.toBeInTheDocument();
  });

  it("shows two authenticated plans as different Maillon sessions and never the July template", async () => {
    const user = userEvent.setup();
    const hydration = (planId: string, title: string, start: string) => ({
      facts: [{ id: "fact-q", fact_key: "questionnaireCompleted", value: true, source: { type: "import", field: "questionnaireCompleted", version: 1 }, created_at: `${start}T00:00:00.000Z` }],
      sessionLogs: [],
      guided: { schemaVersion: 1 as const, activeRun: null, history: [] },
      activePlan: {
        id: planId,
        published_at: `${start}T00:00:00.000Z`,
        rationale: title,
        version_number: 1,
        sessions: [{
          id: `${planId}-session`,
          position: 1,
          scheduled_offset_days: 0,
          phase: "Fuerza y potencia",
          objective: title,
          intensity: "moderate",
          expected_duration_minutes: 45,
          recovery_guidance: "Descanso.",
          blocks: [{
            id: `${planId}-block`,
            position: 1,
            phase: "work",
            title,
            instructions: "Prescripción propia.",
            duration_minutes: 20,
            exercises: [{ id: `${planId}-exercise`, position: 1, exercise_id: "00000000-0000-4000-8000-0000000000e1", exercise_content_version: 1, sets: 5, reps: 3, duration_seconds: null, cues: ["Control"] }]
          }]
        }]
      },
      profile: { avatarPath: null }
    });

    const first = render(<App cloudVerified cloudHydration={hydration("plan-fingers", "Fuerza de dedos", "2026-11-02")} />);
    await user.click(screen.getAllByRole("tab", { name: "Plan" })[0]);
    expect(screen.getByTestId("plan-screen")).toHaveAttribute("data-plan-id", "plan-fingers");
    expect(screen.getByRole("button", { name: "Empezar" })).toBeInTheDocument();
    expect(screen.getByText("Fuerza de dedos")).toBeInTheDocument();
    expect(screen.queryByText(/limit \+ fuerza/i)).not.toBeInTheDocument();
    expect(screen.queryByTestId("demo-plan-banner")).not.toBeInTheDocument();
    first.unmount();

    render(<App cloudVerified cloudHydration={hydration("plan-power", "Potencia corta", "2026-12-08")} />);
    await user.click(screen.getAllByRole("tab", { name: "Plan" })[0]);
    expect(screen.getByTestId("plan-screen")).toHaveAttribute("data-plan-id", "plan-power");
    expect(screen.getByText("Potencia corta")).toBeInTheDocument();
    expect(screen.queryByText("Fuerza de dedos")).not.toBeInTheDocument();
  });

  it("shows empty, loading, and error states without the demo calendar", () => {
    const { rerender } = render(<ActivePlanNotice status="empty" />);
    expect(screen.getByText("Todavía no tenés un plan activo.")).toBeInTheDocument();
    expect(screen.queryByText(/julio 2026/i)).not.toBeInTheDocument();

    rerender(<ActivePlanNotice status="loading" />);
    expect(screen.getByText("Cargando tu plan…")).toBeInTheDocument();

    rerender(<ActivePlanNotice status="error" onRetry={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos leer tu plan activo.");
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });

  it("shows the same empty plan on the profile badge, plan view, and sidebar", async () => {
    const user = userEvent.setup();
    render(<App cloudVerified cloudHydration={{
      facts: [
        { id: "fact-q", fact_key: "questionnaireCompleted", value: true, source: { type: "import", field: "questionnaireCompleted", version: 1 }, created_at: "2026-11-02T00:00:00.000Z" },
        { id: "fact-current", fact_key: "currentGrade", value: "V6", source: { type: "import", field: "currentGrade", version: 1 }, created_at: "2026-11-02T00:00:00.000Z" },
        { id: "fact-target", fact_key: "targetGrade", value: "7a", source: { type: "import", field: "targetGrade", version: 1 }, created_at: "2026-11-02T00:00:00.000Z" }
      ],
      sessionLogs: [],
      guided: { schemaVersion: 1 as const, activeRun: null, history: [] },
      activePlan: null,
      profile: { avatarPath: null }
    }} />);

    expect(screen.getAllByText("Sin plan activo").length).toBeGreaterThan(0);
    expect(screen.queryByText("Plan activo")).not.toBeInTheDocument();

    await user.click(screen.getAllByRole("tab", { name: "Plan" })[0]);
    expect(screen.getByText("Todavía no tenés un plan activo.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Abrir perfil de Escalador" }));
    const profile = screen.getByRole("region", { name: "Escalador" });
    expect(within(profile).getByRole("heading", { name: "Escalador" })).toBeInTheDocument();
    expect(within(profile).getByLabelText("Nombre")).toHaveValue("");
    expect(within(profile).queryByRole("heading", { name: "Mateo" })).not.toBeInTheDocument();
    await user.click(within(profile).getByRole("tab", { name: "Entrenamiento" }));
    expect(within(profile).getByLabelText("Historial de lesiones")).toHaveValue("");
    expect(within(profile).getByLabelText("Recuperación")).toHaveValue("");
    expect(within(profile).getByText("Sin plan activo")).toBeInTheDocument();
    expect(within(profile).queryByText("Plan activo")).not.toBeInTheDocument();
    expect(within(profile).queryByText("Plan de demostración")).not.toBeInTheDocument();
    expect(within(profile).queryByText("Progreso del plan")).not.toBeInTheDocument();
    expect(within(profile).queryByText("0%")).not.toBeInTheDocument();
    expect(within(profile).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(within(profile).getByText("Completá grados comparables")).toBeInTheDocument();
  });

  it("shows Plan activo on the profile when the cloud plan is ready", async () => {
    const user = userEvent.setup();
    render(<App cloudVerified cloudHydration={{
      facts: [{ id: "fact-q", fact_key: "questionnaireCompleted", value: true, source: { type: "import", field: "questionnaireCompleted", version: 1 }, created_at: "2026-11-02T00:00:00.000Z" }],
      sessionLogs: [],
      guided: { schemaVersion: 1 as const, activeRun: null, history: [] },
      activePlan: {
        id: "plan-ready",
        published_at: "2026-11-02T00:00:00.000Z",
        rationale: "Plan listo",
        version_number: 1,
        sessions: [{
          id: "plan-ready-session",
          position: 1,
          scheduled_offset_days: 0,
          phase: "Fuerza y potencia",
          objective: "Construir fuerza.",
          intensity: "moderate",
          expected_duration_minutes: 45,
          recovery_guidance: "Descansá.",
          blocks: [{
            id: "plan-ready-block",
            position: 1,
            phase: "work",
            title: "Fuerza de dedos",
            instructions: "Hangboard controlado.",
            duration_minutes: 20,
            exercises: [{ id: "plan-ready-ex", position: 1, exercise_id: "ex", exercise_content_version: 1, sets: 5, reps: 3, duration_seconds: null }]
          }]
        }]
      },
      profile: { avatarPath: null }
    }} />);

    await user.click(screen.getByRole("button", { name: "Abrir perfil de Escalador" }));
    const profile = screen.getByRole("region", { name: "Escalador" });
    expect(within(profile).getByRole("heading", { name: "Escalador" })).toBeInTheDocument();
    expect(within(profile).getByLabelText("Nombre")).toHaveValue("");
    expect(within(profile).queryByRole("heading", { name: "Mateo" })).not.toBeInTheDocument();
    expect(within(profile).getByText("Plan activo")).toBeInTheDocument();
    expect(within(profile).queryByText("Sin plan activo")).not.toBeInTheDocument();
    expect(within(profile).queryByText("Plan de demostración")).not.toBeInTheDocument();
  });
});
