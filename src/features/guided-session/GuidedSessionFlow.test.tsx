import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TrainingSession } from "@/lib/training";
import type { GuidedSessionDefinition, GuidedSessionState } from "./guided-session-types";
import { createGuidedRun } from "./guided-session-reducer";
import { GUIDED_STORAGE_KEY } from "./guided-session-storage";
import { GuidedSessionFlow } from "./GuidedSessionFlow";

const session: TrainingSession = { id: "w1d1", week: 1, day: 1, date: "2026-07-09", start: "18:30", end: "20:00", phase: "Calibracion", type: "Limit", title: "Escalada W1D1 - Limit", intensity: "alta", summary: "Resumen", drills: [] };
const otherSession: TrainingSession = { ...session, id: "w1d2", day: 2, title: "Escalada W1D2 - Fuerza" };
const block = (id: string) => ({ id, phase: "work" as const, title: `Bloque ${id}`, instruction: "Hace el bloque", steps: ["Paso"], dose: "1 serie, descanso 1 min", cues: ["Control"], avoid: "Detente con dolor", equipment: [], media: [], narrationText: "Hace" });
const definition: GuidedSessionDefinition = { sessionId: session.id, version: 1, objective: "Objetivo", safetyNote: "Seguridad", blocks: [block("a"), block("b")] };
const otherDefinition: GuidedSessionDefinition = { ...definition, sessionId: otherSession.id };
const definitions = { w1d1: definition, w1d2: otherDefinition };
const now = () => "2026-07-14T10:00:00.000Z";

describe("GuidedSessionFlow", () => {
  it("runs summary through blocks and hands completion to Log", async () => {
    const onOpenLog = vi.fn();
    render(<GuidedSessionFlow session={session} definition={definition} definitions={definitions} onCloseToPlan={vi.fn()} onOpenLog={onOpenLog} now={now} />);
    await userEvent.click(screen.getByRole("button", { name: "Empezar sesión" }));
    await userEvent.click(screen.getByRole("button", { name: /completar y seguir/i }));
    expect(screen.getByRole("heading", { name: "Bloque b" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /completar y seguir/i }));
    expect(screen.getByRole("heading", { name: /w1d1 - limit/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /registrar resultados/i }));
    expect(onOpenLog).toHaveBeenCalledWith("w1d1");
  });

  it("pauses, persists, and closes to Plan", async () => {
    const onClose = vi.fn();
    render(<GuidedSessionFlow session={session} definition={definition} definitions={definitions} onCloseToPlan={onClose} onOpenLog={vi.fn()} now={now} />);
    await userEvent.click(screen.getByRole("button", { name: "Empezar sesión" }));
    await userEvent.click(screen.getByRole("button", { name: /pausar o salir/i }));
    await userEvent.click(screen.getByRole("button", { name: /pausar y salir/i }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(JSON.parse(localStorage.getItem(GUIDED_STORAGE_KEY)!).activeRun.status).toBe("paused");
  });

  it("resumes a restored run at its first unresolved block", async () => {
    const activeRun = { ...createGuidedRun(definition, now(), "run"), status: "active" as const, startedAt: now(), activeSegmentStartedAt: now(), completedBlockIds: ["a"], currentBlockIndex: 0 };
    localStorage.setItem(GUIDED_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeRun, history: [] } satisfies GuidedSessionState));
    render(<GuidedSessionFlow session={session} definition={definition} definitions={definitions} onCloseToPlan={vi.fn()} onOpenLog={vi.fn()} now={now} />);
    expect(await screen.findByRole("heading", { name: "Bloque b" })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(GUIDED_STORAGE_KEY)!).activeRun.status).toBe("active");
  });

  it("requires a choice before replacing another unfinished session", async () => {
    const otherRun = { ...createGuidedRun(otherDefinition, now(), "other"), status: "paused" as const };
    localStorage.setItem(GUIDED_STORAGE_KEY, JSON.stringify({ schemaVersion: 1, activeRun: otherRun, history: [] }));
    const onSelectSession = vi.fn();
    render(<GuidedSessionFlow session={session} definition={definition} definitions={definitions} onCloseToPlan={vi.fn()} onOpenLog={vi.fn()} onSelectSession={onSelectSession} now={now} />);
    expect(await screen.findByRole("alertdialog", { name: /sesión en curso/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /volver a la sesión activa/i }));
    expect(onSelectSession).toHaveBeenCalledWith("w1d2");
  });

  it("keeps navigation working and warns when storage writes fail", async () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn(() => { throw new Error("quota"); }), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 } satisfies Storage;
    render(<GuidedSessionFlow session={session} definition={definition} definitions={definitions} storage={storage} onCloseToPlan={vi.fn()} onOpenLog={vi.fn()} now={now} />);
    expect(await screen.findByText(/no se puede guardar/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Empezar sesión" }));
    expect(screen.getByRole("heading", { name: "Bloque a" })).toBeInTheDocument();
  });

  it("focuses, scrolls and announces block transitions", async () => {
    const scrollTo = vi.fn();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: scrollTo });
    render(<GuidedSessionFlow session={session} definition={definition} definitions={definitions} onCloseToPlan={vi.fn()} onOpenLog={vi.fn()} now={now} />);
    await userEvent.click(screen.getByRole("button", { name: "Empezar sesión" }));
    await userEvent.click(screen.getByRole("button", { name: /completar y seguir/i }));
    await waitFor(() => expect(screen.getByRole("heading", { name: "Bloque b" })).toHaveFocus());
    expect(screen.getByText("Bloque 2 de 2: Bloque b")).toHaveAttribute("aria-live", "polite");
    expect(scrollTo).toHaveBeenCalled();
  });
});
