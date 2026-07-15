import { describe, expect, it } from "vitest";
import { createGuidedRun } from "../guided-session/guided-session-reducer";
import type { GuidedSessionDefinition, GuidedSessionState } from "../guided-session/guided-session-types";
import { defaultState, type TrackerState } from "../../lib/training";
import { projectTrackerState } from "./user-facts";
import { migrateLegacyUserData } from "./user-data-migration";

const now = "2026-07-14T12:00:00.000Z";
const definition: GuidedSessionDefinition = { sessionId: "w1d1", version: 1, objective: "", safetyNote: "", blocks: [] };

function legacy(): TrackerState {
  return {
    goals: { ...defaultState.goals, focus: "precision" },
    profile: { ...defaultState.profile, age: "0", styleStrengths: "", questionnaireCompleted: false, questionnaireVersion: 0 },
    logs: [{ id: "log-1", sessionId: "w1d1", createdAt: now, notes: "ok", rpe: 8, pump: 5, pain: 0, attempts: 4, moves: 8, bestLink: 6, footCuts: 0, pullWeight: 20, sleep: 8, energy: 8 }],
    videos: [{ id: "video-1", sessionId: "w1d1", createdAt: now, fileName: "move.mp4", duration: 12, size: 100, notes: "", footCuts: 0, swing: 2, hips: 3, shoulder: 4, breath: 5, reading: 6, advice: [{ title: "Pies", body: "Mantenelos activos." }] }]
  };
}

describe("legacy user data migration", () => {
  it("deterministically migrates supplied facts, events, and guided progress", () => {
    const activeRun = createGuidedRun(definition, now, "run-1");
    const guided: GuidedSessionState = { schemaVersion: 1, activeRun, history: [{ ...activeRun, id: "run-old" }] };
    let next = 0;
    const result = migrateLegacyUserData({ tracker: legacy(), guided, now, makeId: () => `id-${++next}` });

    expect(result.activeUserId).toBe("id-1");
    expect(result.users["id-1"].facts.map(({ id }) => id)).toEqual(result.users["id-1"].facts.map((_fact, index) => `id-${index + 2}`));
    expect(result.users["id-1"].facts).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "focus", value: "precision", source: { type: "migration", field: "focus", version: 1 } }),
      expect.objectContaining({ key: "questionnaireCompleted", value: false }),
      expect.objectContaining({ key: "questionnaireVersion", value: 0 })
    ]));
    expect(result.users["id-1"].facts.some(({ key }) => key === "styleStrengths")).toBe(false);
    expect(result.users["id-1"].sessionLogs[0]).toEqual(legacy().logs[0]);
    expect(result.users["id-1"].videoAnalyses[0]).toEqual(legacy().videos[0]);
    expect(result.users["id-1"].videoAnalyses[0].advice).toEqual([{ title: "Pies", body: "Mantenelos activos." }]);
    expect(result.users["id-1"].guidedSessions).toEqual(guided);
    expect(result.migration).toEqual({ migratedFrom: "climb4w.state.v1", migratedAt: now });
  });

  it("projects migrated supplied values and defaults omitted legacy blanks", () => {
    let id = 0;
    const tracker = legacy();
    const result = migrateLegacyUserData({ tracker, guided: { schemaVersion: 1, activeRun: null, history: [] }, now, makeId: () => `id-${++id}` });
    expect(projectTrackerState(result.users[result.activeUserId])).toEqual(tracker);
  });

  it("creates independent copies instead of mutating legacy values", () => {
    let id = 0;
    const tracker = legacy();
    const guided: GuidedSessionState = { schemaVersion: 1, activeRun: null, history: [] };
    const result = migrateLegacyUserData({ tracker, guided, now, makeId: () => `id-${++id}` });
    tracker.logs[0].notes = "changed";
    expect(result.users[result.activeUserId].sessionLogs[0].notes).toBe("ok");
  });

  it("normalizes legacy video analyses without advice to an empty list", () => {
    let id = 0;
    const tracker = legacy();
    delete (tracker.videos[0] as Partial<(typeof tracker.videos)[number]>).advice;
    const result = migrateLegacyUserData({ tracker, guided: { schemaVersion: 1, activeRun: null, history: [] }, now, makeId: () => `id-${++id}` });
    expect(result.users[result.activeUserId].videoAnalyses[0].advice).toEqual([]);
  });
});
