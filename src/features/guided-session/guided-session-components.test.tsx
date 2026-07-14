import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { TrainingSession } from "@/lib/training";
import type { GuidedBlock, GuidedRun, GuidedSessionDefinition } from "./guided-session-types";
import { GuidedMedia } from "./GuidedMedia";
import { SessionStartSummary } from "./SessionStartSummary";
import { GuidedBlockView } from "./GuidedBlockView";
import { GuidedSessionExitDialog } from "./GuidedSessionExitDialog";
import { SessionCompletion } from "./SessionCompletion";
import { GuidedResumeBanner } from "./GuidedResumeBanner";

const session: TrainingSession = { id: "w1d1", week: 1, day: 1, date: "2026-07-09", start: "18:30", end: "20:00", phase: "Calibracion", type: "Limit + fuerza", title: "Escalada W1D1 - Limit + fuerza", intensity: "alta", summary: "Resumen", drills: [] };
const block: GuidedBlock = {
  id: "board",
  phase: "work",
  title: "Board 45",
  instruction: "Completa intentos de calidad.",
  steps: ["Define los pies", "Carga la cadera"],
  dose: "4 problemas, 3 intentos; descansa 4 min.",
  estimatedMinutes: 30,
  rationale: "Convierte fuerza en tecnica.",
  cues: ["Pie activo", "Escapulas bajas"],
  avoid: "Detente si aparece dolor o baja la velocidad.",
  equipment: ["Palestra", "Pies de gato"],
  media: [{ id: "video", kind: "youtube", label: "Tecnica de pies", url: "https://www.youtube.com/watch?v=8ZAdKNgdYm8", youtubeId: "8ZAdKNgdYm8" }],
  narrationText: "Board 45"
};
const definition: GuidedSessionDefinition = { sessionId: session.id, version: 1, objective: "Calibrar intensidad", safetyNote: "Para ante dolor mayor a 2/10.", blocks: [block] };
const run: GuidedRun = { id: "run", schemaVersion: 1, definitionVersion: 1, sessionId: session.id, status: "completed", currentBlockIndex: 0, completedBlockIds: [block.id], skippedBlockIds: [], startedAt: "2026-07-14T10:00:00.000Z", completedAt: "2026-07-14T10:20:00.000Z", activeSegmentStartedAt: null, accumulatedActiveSeconds: 1200, updatedAt: "2026-07-14T10:20:00.000Z" };

describe("guided session screens", () => {
  it("summarizes metadata, equipment, safety and ordered blocks", async () => {
    const onStart = vi.fn();
    render(<SessionStartSummary session={session} definition={definition} onStart={onStart} onBack={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /limit \+ fuerza/i })).toBeInTheDocument();
    expect(screen.getByText(/calibrar intensidad/i)).toBeInTheDocument();
    expect(screen.getByText(/palestra/i)).toBeInTheDocument();
    expect(screen.getByText(/dolor mayor a 2\/10/i)).toBeInTheDocument();
    expect(screen.getByRole("list")).toHaveTextContent("Board 45");
    const start = screen.getByRole("button", { name: "Empezar sesión" });
    expect(start.className).toMatch(/h-11|min-h-11/);
    await userEvent.click(start);
    expect(onStart).toHaveBeenCalledOnce();
  });

  it("renders block details, progress, and navigation actions", async () => {
    const onComplete = vi.fn();
    const onSkip = vi.fn();
    render(<GuidedBlockView block={block} index={0} total={3} isCompleted={false} onPrevious={vi.fn()} onNext={vi.fn()} onComplete={onComplete} onSkip={onSkip} headingRef={{ current: null }} />);
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByText(block.dose!)).toBeInTheDocument();
    expect(screen.getByRole("list", { name: /pasos/i })).toHaveTextContent("Carga la cadera");
    expect(screen.getByText(/Pie activo/)).toBeInTheDocument();
    expect(screen.getByText(block.avoid!)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /completar y seguir/i }));
    await userEvent.click(screen.getByRole("button", { name: /saltar bloque/i }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("loads YouTube only on demand without autoplay and keeps a fallback", async () => {
    render(<GuidedMedia media={block.media} />);
    expect(screen.queryByTitle(/tecnica de pies/i)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /ver demostración/i }));
    const iframe = screen.getByTitle(/tecnica de pies/i);
    expect(iframe).toHaveAttribute("src", expect.stringContaining("playsinline=1"));
    expect(iframe.getAttribute("src")).not.toContain("autoplay=1");
    expect(screen.getByRole("link", { name: /abrir en youtube/i })).toHaveAttribute("href", block.media[0].url);
  });

  it("explains offline video requirements and recovers when connectivity returns", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    render(<GuidedMedia media={block.media} />);
    await userEvent.click(screen.getByRole("button", { name: /ver demostración/i }));

    expect(screen.getByText("El video necesita conexión")).toBeInTheDocument();
    expect(screen.queryByTitle(/tecnica de pies/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /abrir en youtube/i })).toBeInTheDocument();

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    expect(await screen.findByTitle(/tecnica de pies/i)).toBeInTheDocument();
    expect(screen.queryByText("El video necesita conexión")).not.toBeInTheDocument();
  });

  it("routes internal tracker references through a callback", async () => {
    const onOpenInternal = vi.fn();
    render(<GuidedMedia media={[{ id: "profile", kind: "internal", label: "Perfil y respaldo", url: "#profile" }]} onOpenInternal={onOpenInternal} />);
    await userEvent.click(screen.getByRole("button", { name: /abrir en la app: perfil y respaldo/i }));
    expect(onOpenInternal).toHaveBeenCalledWith("profile");
  });

  it("offers accessible pause and destructive discard confirmation", async () => {
    const onPause = vi.fn();
    const onDiscard = vi.fn();
    render(<GuidedSessionExitDialog open onOpenChange={vi.fn()} onPause={onPause} onDiscard={onDiscard} />);
    expect(screen.getByRole("alertdialog", { name: /pausar sesión/i })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /pausar y salir/i }));
    expect(onPause).toHaveBeenCalledOnce();
  });

  it("shows completion counts and hands the original session to Log", async () => {
    const onOpenLog = vi.fn();
    render(<SessionCompletion session={session} definition={definition} run={run} onOpenLog={onOpenLog} onBack={vi.fn()} onRestart={vi.fn()} />);
    expect(screen.getByText(/20 min/)).toBeInTheDocument();
    expect(screen.getByText(/1 completado/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /registrar resultados/i }));
    expect(onOpenLog).toHaveBeenCalledWith("w1d1");
  });

  it("summarizes a paused run and resumes it directly from Plan", async () => {
    const onResume = vi.fn();
    render(<GuidedResumeBanner session={session} definition={definition} run={{ ...run, status: "paused", currentBlockIndex: 0, completedAt: null }} onResume={onResume} />);
    expect(screen.getByText(/sesión pausada/i)).toBeInTheDocument();
    expect(screen.getByText(/w1d1 - limit \+ fuerza/i)).toBeInTheDocument();
    expect(screen.getByText(/bloque 1 de 1/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /continuar sesión/i }));
    expect(onResume).toHaveBeenCalledOnce();
  });
});
