import { describe, expect, it } from "vitest";

import { sessionLogFromCloudRow } from "../cloud/session-log-binding";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import { validateUserDataEnvelope } from "../user-data/user-data-validation";
import { buildProgress } from "./progress-kpis";
import {
  ANCHOR_INTERVAL_DAYS,
  ANCHOR_PROTOCOLS,
  anchorLogFields,
  buildAnchorHistory,
  formatAnchorDelta,
  parseAnchorDraft
} from "./anchor-tests";

const at = "2026-07-14T12:00:00.000Z";

function envelopeWith(log: Record<string, unknown>) {
  return {
    schemaVersion: 3 as const,
    activeUserId: "u1",
    users: {
      u1: {
        identity: { id: "u1", displayName: "u1", createdAt: at, updatedAt: at, auth: null },
        facts: [],
        sessionLogs: [log],
        videoAnalyses: [],
        guidedSessions: emptyGuidedSessionState()
      }
    },
    migration: { migratedFrom: null, migratedAt: null }
  };
}

describe("anchor test protocol", () => {
  it("keeps a 28-day cadence and two fixed protocols", () => {
    expect(ANCHOR_INTERVAL_DAYS).toBe(28);
    expect(ANCHOR_PROTOCOLS["hang-20mm"].instructions).toMatch(/20 mm/);
    expect(ANCHOR_PROTOCOLS["hang-20mm"].instructions).toMatch(/peso corporal/);
    expect(ANCHOR_PROTOCOLS["hang-20mm"].sessionId).toBe("anchor:hang-20mm");
    expect(ANCHOR_PROTOCOLS["weighted-pullups"].instructions).toMatch(/dominada estricta/i);
    expect(ANCHOR_PROTOCOLS["weighted-pullups"].instructions).toMatch(/mismo agarre/i);
    expect(ANCHOR_PROTOCOLS["weighted-pullups"].sessionId).toBe("anchor:weighted-pullups");
  });

  it("rejects a result that would not repeat", () => {
    expect(parseAnchorDraft({ protocol: "board", result: "30", setup: "20 mm" }).ok).toBe(false);
    expect(parseAnchorDraft({ protocol: "hang-20mm", result: "", setup: "20 mm" })).toMatchObject({ ok: false, message: "Anotá el resultado." });
    expect(parseAnchorDraft({ protocol: "hang-20mm", result: "12.5", setup: "20 mm" })).toMatchObject({ ok: false, message: "Los segundos van sin decimales." });
    expect(parseAnchorDraft({ protocol: "hang-20mm", result: "0", setup: "20 mm" })).toMatchObject({ ok: false });
    expect(parseAnchorDraft({ protocol: "hang-20mm", result: "301", setup: "20 mm" })).toMatchObject({ ok: false });
    expect(parseAnchorDraft({ protocol: "weighted-pullups", result: "-1", setup: "Prono" })).toMatchObject({ ok: false });
    expect(parseAnchorDraft({ protocol: "weighted-pullups", result: "201", setup: "Prono" })).toMatchObject({ ok: false });
    expect(parseAnchorDraft({ protocol: "hang-20mm", result: "30", setup: "   " })).toMatchObject({ ok: false, message: "Anotá el canto o la barra para repetir el mismo setup." });
  });

  it("stores a hang and a weighted pull-up on the existing session log fields", () => {
    const hang = parseAnchorDraft({ protocol: "hang-20mm", result: "32", setup: "  Beastmaker   20 mm  " });
    expect(hang.ok).toBe(true);
    if (!hang.ok) return;
    const hangFields = anchorLogFields(hang.draft);
    expect(hangFields).toMatchObject({
      sessionId: "anchor:hang-20mm",
      notes: "Beastmaker 20 mm",
      metrics: { moves: 32, pullWeight: 0, attempts: 0, rpe: 0, bestLink: 0, footCuts: 0, pain: 0 }
    });

    const pull = parseAnchorDraft({ protocol: "weighted-pullups", result: "12.5", setup: "Barra de casa" });
    expect(pull.ok).toBe(true);
    if (!pull.ok) return;
    expect(anchorLogFields(pull.draft)).toMatchObject({
      sessionId: "anchor:weighted-pullups",
      notes: "Barra de casa",
      metrics: { pullWeight: 12.5, attempts: 1, moves: 0, rpe: 0, bestLink: 0 }
    });

    const log = {
      id: "anchor-1",
      sessionId: hangFields.sessionId,
      createdAt: "2026-10-06T12:00:00.000Z",
      notes: hangFields.notes,
      ...hangFields.metrics
    };
    expect(validateUserDataEnvelope(envelopeWith(log))).not.toBeNull();
  });

  it("shows whether the same setup improved across four weeks", () => {
    const history = buildAnchorHistory([
      { id: "h1", sessionId: "anchor:hang-20mm", createdAt: "2026-10-06T12:00:00.000Z", notes: "Beastmaker 20 mm", moves: 28, pullWeight: 0 },
      { id: "h2", sessionId: "anchor:hang-20mm", createdAt: "2026-11-03T12:00:00.000Z", notes: "Beastmaker 20 mm", moves: 32, pullWeight: 0 },
      { id: "p1", sessionId: "anchor:weighted-pullups", createdAt: "2026-10-06T12:00:00.000Z", notes: "Barra de casa", moves: 0, pullWeight: 10 },
      { id: "p2", sessionId: "anchor:weighted-pullups", createdAt: "2026-11-03T12:00:00.000Z", notes: "Otra barra", moves: 0, pullWeight: 12.5 },
      { id: "session", sessionId: "plan-1", createdAt: "2026-11-03T12:00:00.000Z", notes: "bloque", moves: 40, pullWeight: 20 }
    ], "2026-11-03");

    expect(history.points.map((point) => point.id)).toEqual(["h2", "p2", "h1", "p1"]);
    const latestHang = history.points.find((point) => point.id === "h2");
    expect(latestHang).toMatchObject({ result: 32, setup: "Beastmaker 20 mm", delta: 4, comparable: true });
    expect(formatAnchorDelta("hang-20mm", latestHang!)).toBe("+4 s");
    expect(history.schedules["hang-20mm"]).toMatchObject({
      status: "scheduled",
      dueOn: "2026-12-01",
      daysUntil: 28,
      suggestedSetup: "Beastmaker 20 mm"
    });
    expect(history.schedules["hang-20mm"].copy).toBe("Próximo ancla el 1 dic. La última suspensión 20 mm fue el 3 nov.");

    const changedBar = history.points.find((point) => point.id === "p2");
    expect(changedBar).toMatchObject({ result: 12.5, delta: null, comparable: false });
    expect(formatAnchorDelta("weighted-pullups", changedBar!)).toBe("agarre distinto");
    expect(formatAnchorDelta("weighted-pullups", history.points.find((point) => point.id === "p1")!)).toBe("primera marca");
  });

  it("is due on the 28th day and not the day before", () => {
    const due = buildAnchorHistory([
      { id: "h1", sessionId: "anchor:hang-20mm", createdAt: "2026-10-06T12:00:00.000Z", notes: "20 mm", moves: 28, pullWeight: 0 }
    ], "2026-11-03");
    expect(due.schedules["hang-20mm"]).toMatchObject({ status: "due", dueOn: "2026-11-03", daysUntil: 0 });
    expect(due.schedules["hang-20mm"].copy).toBe("Toca el ancla. La última suspensión 20 mm fue el 6 oct.");

    const early = buildAnchorHistory([
      { id: "h1", sessionId: "anchor:hang-20mm", createdAt: "2026-10-07T08:00:00.000Z", notes: "20 mm", moves: 20, pullWeight: 0 }
    ], "2026-11-03");
    expect(early.schedules["hang-20mm"]).toMatchObject({ status: "scheduled", dueOn: "2026-11-04", daysUntil: 1 });
    expect(early.schedules["hang-20mm"].copy).toBe("Próximo ancla el 4 nov. La última suspensión 20 mm fue el 7 oct.");
    expect(early.schedules["weighted-pullups"].status).toBe("none");
    expect(early.schedules["weighted-pullups"].copy).toMatch(/Sin ancla/);
  });

  it("reads an anchor back from the session_logs columns hydrate already returns", () => {
    const log = sessionLogFromCloudRow({
      id: "row-1",
      idempotency_key: "anchor-cloud",
      session_binding: "legacy",
      legacy_session_key: "anchor:weighted-pullups",
      created_at: "2026-10-06T12:00:00.000Z",
      body: "Barra de casa",
      attempts: 1,
      moves: 0,
      pull_weight: 20,
      best_link: 0,
      foot_cuts: 0
    });
    const history = buildAnchorHistory([log], "2026-11-03");
    expect(history.points[0]).toMatchObject({ id: "anchor-cloud", protocol: "weighted-pullups", result: 20, setup: "Barra de casa" });
    expect(formatAnchorDelta("weighted-pullups", { delta: 2.5, comparable: true })).toBe("+2,5 kg");
  });

  it("keeps anchor rows out of the four weekly KPIs", () => {
    const training = { createdAt: "2026-11-03T12:00:00.000Z", bestLink: 8, footCuts: 3, rpe: 7, pain: 1 };
    const anchor = { createdAt: "2026-11-03T12:00:00.000Z", sessionId: "anchor:hang-20mm", bestLink: 99, footCuts: 40, rpe: 10, pain: 9 };
    const withAnchor = buildProgress([training, anchor], "2026-11-03");
    const without = buildProgress([training], "2026-11-03");
    expect(withAnchor.cards).toEqual(without.cards);
  });
});
