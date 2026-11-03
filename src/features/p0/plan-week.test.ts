import { describe, expect, it } from "vitest";

import type { ScheduledPlanSession } from "../plan/active-plan";
import { buildProgress } from "./progress-kpis";
import {
  buildLoggerDraft,
  buildWeekPlan,
  emptyPlanWeekEdits,
  moveSession,
  nextThursday,
  plannedAttempts,
  skipSession,
  swapToMobility,
  targetRpe,
  undoSwap
} from "./plan-week";

function session(overrides: Partial<ScheduledPlanSession> = {}): ScheduledPlanSession {
  return {
    id: "session-1",
    planId: "plan-1",
    position: 1,
    week: 2,
    day: 2,
    date: "2026-11-03",
    start: "18:00",
    end: "18:45",
    phase: "Fuerza",
    type: "Fuerza",
    title: "Fuerza de dedos",
    intensity: "media",
    summary: "Hangboard controlado.",
    drills: ["6 series de 10 s"],
    durationMinutes: 45,
    subtitle: "6x10 s en regleta 20 mm",
    ...overrides
  };
}

describe("plan week edits", () => {
  it("reads the plan RPE and the planned attempts", () => {
    expect(targetRpe(session({ summary: "Serie a RPE 8", intensity: "baja" }))).toBe(8);
    expect(targetRpe(session({ summary: "Sin numero", subtitle: "", drills: [], intensity: "alta" }))).toBe(8);
    expect(plannedAttempts(session())).toBe(6);
    expect(plannedAttempts(session({ subtitle: "técnica libre", summary: "técnica libre", drills: [] }))).toBe(1);
  });

  it("moves a skipped day and a pain swap onto Thursday", () => {
    expect(nextThursday("2026-11-03")).toBe("2026-11-05");
    expect(nextThursday("2026-11-05")).toBe("2026-11-12");
    const skipped = skipSession(emptyPlanWeekEdits(), "session-1");
    const view = buildWeekPlan({
      sessions: [session(), session({ id: "session-2", position: 2, date: "2026-11-04", title: "Bloque proyecto", subtitle: "4 intentos", drills: [] })],
      edits: skipped,
      today: "2026-11-03",
      completedSessionIds: new Set()
    });
    expect(view.featured?.skipped).toBe(true);
    expect(view.featured?.title).toBe("Fuerza de dedos");

    const swapped = swapToMobility(emptyPlanWeekEdits(), "session-1", "2026-11-03");
    const after = buildWeekPlan({
      sessions: [session()],
      edits: swapped,
      today: "2026-11-03",
      completedSessionIds: new Set()
    });
    expect(after.featured?.mobility).toBe(true);
    expect(after.featured?.title).toBe("Movilidad");
    expect(after.rows.some((row) => row.title === "Fuerza de dedos" && row.date === "2026-11-05")).toBe(true);
    expect(undoSwap(swapped, "session-1").mobilitySwapIds).toEqual([]);
  });

  it("moves a session onto another day of the week", () => {
    const edits = moveSession(emptyPlanWeekEdits(), "session-2", "2026-11-06");
    const view = buildWeekPlan({
      sessions: [
        session(),
        session({ id: "session-2", position: 2, date: "2026-11-04", title: "Resistencia", subtitle: "4x4", drills: [] })
      ],
      edits,
      today: "2026-11-03",
      completedSessionIds: new Set(["session-1"])
    });
    expect(view.featured?.completed).toBe(true);
    expect(view.rows.find((row) => row.title === "Resistencia")?.date).toBe("2026-11-06");
  });

  it("prefills the logger from today's plan and yesterday's pain", () => {
    const draft = buildLoggerDraft({
      sessions: [session()],
      edits: emptyPlanWeekEdits(),
      today: "2026-11-03",
      logs: [{ createdAt: "2026-11-02T18:00:00.000Z", pain: 1 }]
    });
    expect(draft).toMatchObject({
      label: "Fuerza de dedos",
      rpe: 7,
      pain: 1,
      painHint: "como ayer",
      attempts: 6,
      bestLink: null,
      footCuts: null
    });
    expect(draft?.prefillNote).toMatch(/Prellenado/);
  });
});

describe("progress kpis", () => {
  it("stays blank until there are logs", () => {
    const model = buildProgress([], "2026-11-03");
    expect(model.hasLogs).toBe(false);
    expect(model.cards.map((card) => card.value)).toEqual(["—", "—", "—", "—"]);
    expect(model.reading).toMatch(/Cuando registres/);
  });

  it("summarizes link, foot-cuts, RPE and pain across four weeks", () => {
    const model = buildProgress([
      { createdAt: "2026-10-13T12:00:00.000Z", bestLink: 5, footCuts: 5, rpe: 7, pain: 2 },
      { createdAt: "2026-11-03T12:00:00.000Z", bestLink: 8, footCuts: 3, rpe: 7.4, pain: 1 }
    ], "2026-11-03");
    expect(model.cards.find((card) => card.id === "bestLink")?.value).toBe("8 movs");
    expect(model.cards.find((card) => card.id === "bestLink")?.delta).toBe("+3 vs. S1");
    expect(model.cards.find((card) => card.id === "footCuts")?.delta).toMatch(/−2/);
    expect(model.cards.find((card) => card.id === "rpe")?.delta).toBe("estable");
    expect(model.cards.find((card) => card.id === "pain")?.delta).toBe("bajando");
    expect(model.reading).toMatch(/menos foot-cuts/);
    expect(model.cards[0]?.points).toHaveLength(4);
  });
});
