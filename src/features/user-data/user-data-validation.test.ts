import { describe, expect, it } from "vitest";
import { defaultState } from "../../lib/training";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import type { UserDataEnvelope, UserFact, UserRecord } from "./user-data-types";
import { USER_FIELD_REGISTRY } from "./user-field-registry";
import { validateUserDataEnvelope } from "./user-data-validation";

const at = "2026-07-14T12:00:00.000Z";

function fact(userId: string, id: string, key = "name", supersedes: string | null = null): UserFact {
  const definition = USER_FIELD_REGISTRY[key as keyof typeof USER_FIELD_REGISTRY];
  return { id, userId, key, category: definition.category, unit: definition.unit, value: "Mateo", recordedAt: at, source: { type: "migration", field: key, version: 1 }, supersedes };
}

function user(id: string): UserRecord {
  return { identity: { id, displayName: id, createdAt: at, updatedAt: at }, facts: [fact(id, `${id}-fact`)], sessionLogs: [], videoAnalyses: [], guidedSessions: emptyGuidedSessionState() };
}

function envelope(): UserDataEnvelope {
  return { schemaVersion: 2, activeUserId: "u1", users: { u1: user("u1"), u2: user("u2") }, migration: { migratedFrom: "climb4w.state.v1", migratedAt: at } };
}

describe("user data envelope validation", () => {
  it("accepts a fully valid two-user envelope", () => expect(validateUserDataEnvelope(envelope())).toEqual(envelope()));

  it.each([
    ["wrong schema", (value: any) => { value.schemaVersion = 1; }],
    ["absent active user", (value: any) => { value.activeUserId = "missing"; }],
    ["unknown category", (value: any) => { value.users.u1.facts[0].category = "unknown"; }],
    ["unknown key", (value: any) => { value.users.u1.facts[0].key = "unknown"; }],
    ["invalid value", (value: any) => { value.users.u1.facts[0].value = ["ok", 2]; }],
    ["cross-user fact", (value: any) => { value.users.u1.facts[0].userId = "u2"; }],
    ["invalid guided state", (value: any) => { value.users.u1.guidedSessions = { schemaVersion: 1, activeRun: { id: "bad" }, history: [] }; }]
  ])("rejects %s", (_name, mutate) => {
    const value: any = structuredClone(envelope());
    mutate(value);
    expect(validateUserDataEnvelope(value)).toBeNull();
  });

  it("rejects duplicate fact IDs", () => {
    const value = envelope();
    value.users.u1.facts.push({ ...value.users.u1.facts[0] });
    expect(validateUserDataEnvelope(value)).toBeNull();
  });

  it("rejects broken and cross-stream supersedes links", () => {
    const broken = envelope();
    broken.users.u1.facts[0].supersedes = "missing";
    expect(validateUserDataEnvelope(broken)).toBeNull();

    const crossStream = envelope();
    crossStream.users.u1.facts.push(fact("u1", "older-project", "project"));
    crossStream.users.u1.facts[0].supersedes = "older-project";
    expect(validateUserDataEnvelope(crossStream)).toBeNull();
  });

  it("rejects supersession cycles", () => {
    const value = envelope();
    value.users.u1.facts = [fact("u1", "a", "name", "b"), fact("u1", "b", "name", "a")];
    expect(validateUserDataEnvelope(value)).toBeNull();
  });

  it("rejects duplicate event IDs", () => {
    const value = envelope();
    value.users.u1.sessionLogs = [
      { id: "event", sessionId: "w1d1", createdAt: at, notes: "", rpe: 1, pump: 0, pain: 0, attempts: 0, moves: 0, bestLink: 0, footCuts: 0, pullWeight: 0, sleep: 0, energy: 0 },
      { id: "event", sessionId: "w1d2", createdAt: at, notes: "", rpe: 1, pump: 0, pain: 0, attempts: 0, moves: 0, bestLink: 0, footCuts: 0, pullWeight: 0, sleep: 0, energy: 0 }
    ];
    expect(validateUserDataEnvelope(value)).toBeNull();
  });

  it("rejects event IDs reused across collections", () => {
    const value = envelope();
    value.users.u1.sessionLogs = [{ id: "event", sessionId: "w1d1", createdAt: at, notes: "", rpe: 1, pump: 0, pain: 0, attempts: 0, moves: 0, bestLink: 0, footCuts: 0, pullWeight: 0, sleep: 0, energy: 0 }];
    value.users.u1.videoAnalyses = [{ id: "event", sessionId: "w1d1", createdAt: at, fileName: "x.mp4", duration: 1, size: 1, notes: "", footCuts: 0, swing: 0, hips: 0, shoulder: 0, breath: 0, reading: 0 }];
    expect(validateUserDataEnvelope(value)).toBeNull();
  });

  it("rejects fact values that disagree with the registered field type", () => {
    const value = envelope();
    value.users.u1.facts[0] = { ...fact("u1", "done", "questionnaireCompleted"), value: "yes" };
    expect(defaultState.profile.questionnaireCompleted).toBe(false);
    expect(validateUserDataEnvelope(value)).toBeNull();
  });

  it("strictly rejects extra and non-finite guided-run fields", () => {
    const run = {
      id: "run", schemaVersion: 1, definitionVersion: 1, sessionId: "w1d1", status: "paused", currentBlockIndex: 0,
      completedBlockIds: [], skippedBlockIds: [], startedAt: at, completedAt: null, activeSegmentStartedAt: null,
      accumulatedActiveSeconds: 1, updatedAt: at
    };
    const extra: any = structuredClone(envelope());
    extra.users.u1.guidedSessions.activeRun = { ...run, privateBlobUrl: "blob:secret" };
    expect(validateUserDataEnvelope(extra)).toBeNull();
    const invalidNumber: any = structuredClone(envelope());
    invalidNumber.users.u1.guidedSessions.activeRun = { ...run, currentBlockIndex: Number.NaN };
    expect(validateUserDataEnvelope(invalidNumber)).toBeNull();
  });
});
