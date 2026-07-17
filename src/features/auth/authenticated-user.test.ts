import { describe, expect, it } from "vitest";

import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import { defaultState } from "../../lib/training";
import { migrateLegacyUserData } from "../user-data/user-data-migration";
import { activateAuthenticatedUser, resetAuthenticatedUser } from "./authenticated-user";

const firstAt = "2026-07-14T12:00:00.000Z";
const nextAt = "2026-07-14T13:00:00.000Z";
const ids = (prefix: string) => { let index = 0; return () => `${prefix}-${++index}`; };

function localEnvelope() {
  const envelope = migrateLegacyUserData({
    tracker: structuredClone(defaultState),
    guided: emptyGuidedSessionState(),
    now: firstAt,
    makeId: ids("local")
  });
  envelope.users[envelope.activeUserId].sessionLogs.push({
    id: "log-1", sessionId: "w1d1", createdAt: firstAt, notes: "private", rpe: 8, pump: 5, pain: 0,
    attempts: 4, moves: 12, bestLink: 8, footCuts: 1, pullWeight: 0, sleep: 8, energy: 8
  });
  return envelope;
}

describe("activateAuthenticatedUser", () => {
  it("claims the current anonymous record once", () => {
    const envelope = localEnvelope();
    const activeId = envelope.activeUserId;
    const result = activateAuthenticatedUser(envelope, { id: "user-1", email: "mateo@example.com" }, { now: nextAt, makeId: ids("new") });

    expect(result.activeUserId).toBe(activeId);
    expect(result.users[activeId].identity.auth).toEqual({ provider: "supabase", subject: "user-1", email: "mateo@example.com" });
    expect(result.users[activeId].sessionLogs[0].notes).toBe("private");
    expect(envelope.users[activeId].identity.auth).toBeNull();
  });

  it("reuses a matching subject and refreshes its email", () => {
    const claimed = activateAuthenticatedUser(localEnvelope(), { id: "user-1", email: null }, { now: firstAt, makeId: ids("claim") });
    const otherId = "other";
    claimed.users[otherId] = { ...structuredClone(claimed.users[claimed.activeUserId]), identity: { ...claimed.users[claimed.activeUserId].identity, id: otherId, auth: null }, facts: [] };
    claimed.activeUserId = otherId;

    const result = activateAuthenticatedUser(claimed, { id: "user-1", email: "new@example.com" }, { now: nextAt, makeId: ids("unused") });
    const matching = Object.values(result.users).find((record) => record.identity.auth?.subject === "user-1")!;
    expect(result.activeUserId).toBe(matching.identity.id);
    expect(matching.identity).toMatchObject({ updatedAt: nextAt, auth: { email: "new@example.com" } });
  });

  it("creates an isolated record for a later Supabase subject", () => {
    const first = activateAuthenticatedUser(localEnvelope(), { id: "user-1", email: "first@example.com" }, { now: firstAt, makeId: ids("claim") });
    const firstId = first.activeUserId;
    const before = structuredClone(first.users[firstId]);

    const result = activateAuthenticatedUser(first, { id: "user-2", email: "second@example.com" }, { now: nextAt, makeId: ids("second") });

    expect(result.activeUserId).not.toBe(firstId);
    expect(result.users[result.activeUserId].identity.auth).toEqual({ provider: "supabase", subject: "user-2", email: "second@example.com" });
    expect(result.users[result.activeUserId].sessionLogs).toEqual([]);
    expect(result.users[firstId]).toEqual(before);
  });

  it("resets only the active Supabase user's local record", () => {
    const first = activateAuthenticatedUser(localEnvelope(), { id: "user-1", email: "first@example.com" }, { now: firstAt, makeId: ids("claim") });
    const second = activateAuthenticatedUser(first, { id: "user-2", email: "second@example.com" }, { now: nextAt, makeId: ids("second") });
    const firstRecord = structuredClone(Object.values(second.users).find((record) => record.identity.auth?.subject === "user-1")!);

    const result = resetAuthenticatedUser(second, { id: "user-2", email: "second@example.com" }, { now: nextAt, makeId: ids("reset") });

    expect(Object.values(result.users).find((record) => record.identity.auth?.subject === "user-1")).toEqual(firstRecord);
    expect(result.users[result.activeUserId].identity.auth).toEqual({ provider: "supabase", subject: "user-2", email: "second@example.com" });
    expect(result.users[result.activeUserId].sessionLogs).toEqual([]);
    expect(result.users[result.activeUserId].identity.id).toBe(second.activeUserId);
  });
});
