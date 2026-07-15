import { describe, expect, it } from "vitest";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import { defaultState } from "../../lib/training";
import type { SessionLog, VideoAnalysis } from "../../lib/training";
import type { UserFact, UserRecord } from "./user-data-types";
import { appendChangedFacts, currentFactsByKey, projectTrackerState } from "./user-facts";

const now = "2026-07-14T18:00:00.000Z";
const source = { type: "profile-form" as const, version: 1 };

function record(id = "user-a", facts: UserFact[] = []): UserRecord {
  return {
    identity: { id, displayName: "Mateo", createdAt: now, updatedAt: now },
    facts,
    sessionLogs: [],
    videoAnalyses: [],
    guidedSessions: emptyGuidedSessionState()
  };
}

function fact(overrides: Partial<UserFact> = {}): UserFact {
  return {
    id: "fact-1",
    userId: "user-a",
    category: "identity",
    key: "name",
    value: "Mateo",
    unit: null,
    recordedAt: "2026-07-14T17:00:00.000Z",
    source: { type: "migration", field: "name", version: 1 },
    supersedes: null,
    ...overrides
  };
}

describe("appendChangedFacts", () => {
  it("does not append or mutate records when supplied values are unchanged", () => {
    const original = record("user-a", [fact()]);

    const next = appendChangedFacts(original, { name: "Mateo" }, source, now, () => "unused");

    expect(next).toBe(original);
    expect(original.facts).toHaveLength(1);
  });

  it("appends changed values with provenance and a supersession link", () => {
    const originalFact = fact();
    const original = record("user-a", [originalFact]);

    const next = appendChangedFacts(original, { name: "Ana" }, source, now, () => "fact-2");

    expect(next).not.toBe(original);
    expect(next.facts).toHaveLength(2);
    expect(next.facts[1]).toEqual({
      id: "fact-2",
      userId: "user-a",
      category: "identity",
      key: "name",
      value: "Ana",
      unit: null,
      recordedAt: now,
      source: { type: "profile-form", field: "name", version: 1 },
      supersedes: "fact-1"
    });
    expect(original.facts).toEqual([originalFact]);
  });

  it("records null when a previously supplied value is cleared", () => {
    const next = appendChangedFacts(record("user-a", [fact()]), { name: "" }, source, now, () => "fact-2");

    expect(next.facts[next.facts.length - 1]).toMatchObject({ value: null, supersedes: "fact-1" });
  });

  it("does not create empty facts where no supplied value existed", () => {
    const original = record();

    expect(appendChangedFacts(original, { age: "" }, source, now, () => "unused")).toBe(original);
  });

  it("preserves meaningful false, zero, and empty-array values", () => {
    let id = 0;
    const next = appendChangedFacts(
      record(),
      { questionnaireCompleted: false, questionnaireVersion: 0, focus: [] },
      { type: "questionnaire", version: 2 },
      now,
      () => `fact-${++id}`
    );

    expect(next.facts.map(({ key, value }) => ({ key, value }))).toEqual([
      { key: "questionnaireCompleted", value: false },
      { key: "questionnaireVersion", value: 0 },
      { key: "focus", value: [] }
    ]);
  });

  it("only changes the user record passed to it", () => {
    const first = record("user-a", [fact()]);
    const second = record("user-b", [fact({ id: "fact-b", userId: "user-b", value: "Bea" })]);

    const changed = appendChangedFacts(second, { name: "Belen" }, source, now, () => "fact-b2");

    expect(first.facts).toEqual([fact()]);
    expect(changed.identity.id).toBe("user-b");
    expect(changed.facts[changed.facts.length - 1]).toMatchObject({ userId: "user-b", value: "Belen", supersedes: "fact-b" });
  });
});

describe("currentFactsByKey", () => {
  it("selects the unsuperseded fact in each stream even when input order differs", () => {
    const older = fact();
    const newer = fact({ id: "fact-2", value: "Ana", supersedes: "fact-1", recordedAt: now });

    const current = currentFactsByKey([newer, older]);

    expect(current.get("name")).toBe(newer);
  });
});

describe("projectTrackerState", () => {
  it("projects latest facts and user-owned events into the exact tracker shape", () => {
    const log: SessionLog = {
      id: "log-1", sessionId: "w1d1", createdAt: now, notes: "Bien", rpe: 8, pump: 5,
      pain: 0, attempts: 4, moves: 20, bestLink: 12, footCuts: 1, pullWeight: 10, sleep: 8, energy: 8
    };
    const video: VideoAnalysis = {
      id: "video-1", sessionId: "w1d1", createdAt: now, fileName: "send.mp4", duration: 12,
      size: 100, notes: "", footCuts: 1, swing: 2, hips: 3, shoulder: 4, breath: 5, reading: 6
    };
    const user = record("user-a", [
      fact({ id: "name-old", value: "Mateo" }),
      fact({ id: "name-new", value: "Ana", supersedes: "name-old", recordedAt: now }),
      fact({ id: "grade", category: "climbing", key: "currentGrade", value: "V8" }),
      fact({ id: "focus", category: "goal", key: "focus", value: ["pies activos", "cadera"] }),
      fact({ id: "complete", category: "preference", key: "questionnaireCompleted", value: true, unit: "boolean" }),
      fact({ id: "version", category: "preference", key: "questionnaireVersion", value: 2 })
    ]);
    user.sessionLogs = [log];
    user.videoAnalyses = [video];

    expect(projectTrackerState(user)).toEqual({
      goals: { ...defaultState.goals, currentGrade: "V8", focus: "pies activos, cadera" },
      profile: { ...defaultState.profile, name: "Ana", questionnaireCompleted: true, questionnaireVersion: 2 },
      logs: [log],
      videos: [video]
    });
  });

  it("projects cleared string facts as empty strings without mutating defaults", () => {
    const user = record("user-a", [fact({ value: null })]);

    expect(projectTrackerState(user).profile.name).toBe("");
    expect(defaultState.profile.name).toBe("Mateo");
  });
});
