import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGuidedRun } from "../guided-session/guided-session-reducer";
import { GUIDED_STORAGE_KEY, emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import type { GuidedSessionDefinition, GuidedSessionState } from "../guided-session/guided-session-types";
import { createUserGuidedStorage } from "./user-guided-storage";

const definition: GuidedSessionDefinition = { sessionId: "w1d1", version: 1, objective: "", safetyNote: "", blocks: [] };

describe("active-user guided storage bridge", () => {
  beforeEach(() => localStorage.clear());

  it("reads and replaces only the active user's guided state", () => {
    let active = emptyGuidedSessionState();
    const replace = vi.fn((next: GuidedSessionState) => { active = next; });
    const bridge = createUserGuidedStorage({ storage: localStorage, getGuidedSessions: () => active, replaceGuidedSessions: replace });
    const next = { schemaVersion: 1, activeRun: createGuidedRun(definition, "2026-07-14T12:00:00.000Z", "run"), history: [] } satisfies GuidedSessionState;
    expect(JSON.parse(bridge.getItem(GUIDED_STORAGE_KEY)!)).toEqual(active);
    bridge.setItem(GUIDED_STORAGE_KEY, JSON.stringify(next));
    expect(replace).toHaveBeenCalledWith(next);
    expect(JSON.parse(bridge.getItem(GUIDED_STORAGE_KEY)!)).toEqual(next);
    expect(localStorage.getItem("climb4w.users.v2")).toBeNull();
  });

  it("rejects invalid guided JSON without updating the user", () => {
    const replace = vi.fn();
    const bridge = createUserGuidedStorage({ storage: localStorage, getGuidedSessions: emptyGuidedSessionState, replaceGuidedSessions: replace });
    expect(() => bridge.setItem(GUIDED_STORAGE_KEY, "{}" )).toThrow(/guided/i);
    expect(replace).not.toHaveBeenCalled();
  });

  it("resets guided state on remove and delegates unknown keys", () => {
    const replace = vi.fn();
    const bridge = createUserGuidedStorage({ storage: localStorage, getGuidedSessions: emptyGuidedSessionState, replaceGuidedSessions: replace });
    bridge.setItem("other", "value");
    expect(bridge.getItem("other")).toBe("value");
    bridge.removeItem(GUIDED_STORAGE_KEY);
    expect(replace).toHaveBeenCalledWith(emptyGuidedSessionState());
  });
});
