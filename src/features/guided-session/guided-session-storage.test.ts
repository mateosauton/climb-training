import { describe, expect, it, vi } from "vitest";
import type { GuidedSessionDefinition, GuidedSessionState } from "./guided-session-types";
import { createGuidedRun } from "./guided-session-reducer";
import { GUIDED_STORAGE_KEY, emptyGuidedSessionState, loadGuidedSessionState, saveGuidedSessionState } from "./guided-session-storage";

const definition: GuidedSessionDefinition = {
  sessionId: "w1d1",
  version: 1,
  objective: "Objetivo",
  safetyNote: "Seguridad",
  blocks: [{ id: "work", phase: "work", title: "Trabajo", instruction: "Hace", steps: ["Hace"], cues: ["Control"], equipment: [], media: [], narrationText: "Hace" }]
};
const definitions = { w1d1: definition };

describe("guided session storage", () => {
  it("returns an empty isolated state when storage is missing", () => {
    expect(loadGuidedSessionState(localStorage, definitions, "2026-07-14T10:00:00.000Z")).toEqual({ state: emptyGuidedSessionState(), warning: null });
  });

  it("loads valid data and restores an active run as paused without closed time", () => {
    const activeRun = { ...createGuidedRun(definition, "2026-07-14T09:00:00.000Z", "run"), status: "active" as const, startedAt: "2026-07-14T09:00:00.000Z", activeSegmentStartedAt: "2026-07-14T09:00:00.000Z", accumulatedActiveSeconds: 75 };
    const state: GuidedSessionState = { schemaVersion: 1, activeRun, history: [] };
    localStorage.setItem(GUIDED_STORAGE_KEY, JSON.stringify(state));

    const loaded = loadGuidedSessionState(localStorage, definitions, "2026-07-14T15:00:00.000Z");
    expect(loaded.warning).toBeNull();
    expect(loaded.state.activeRun).toMatchObject({ status: "paused", accumulatedActiveSeconds: 75, activeSegmentStartedAt: null });
  });

  it.each(["not-json", JSON.stringify({ schemaVersion: 1, activeRun: { nope: true }, history: [] })])("isolates malformed or invalid payloads", (payload) => {
    localStorage.setItem(GUIDED_STORAGE_KEY, payload);
    const loaded = loadGuidedSessionState(localStorage, definitions, "2026-07-14T10:00:00.000Z");
    expect(loaded.state).toEqual(emptyGuidedSessionState());
    expect(loaded.warning).toMatch(/recuperar/i);
  });

  it("saves synchronously under the separate guided key", () => {
    const state = emptyGuidedSessionState();
    expect(saveGuidedSessionState(localStorage, state)).toEqual({ ok: true });
    expect(localStorage.getItem(GUIDED_STORAGE_KEY)).toBe(JSON.stringify(state));
    expect(localStorage.getItem("climb4w.state.v1")).toBeNull();
  });

  it("returns a typed failure when a write fails", () => {
    const storage = { getItem: vi.fn(), setItem: vi.fn(() => { throw new Error("quota"); }), removeItem: vi.fn(), clear: vi.fn(), key: vi.fn(), length: 0 } satisfies Storage;
    expect(saveGuidedSessionState(storage, emptyGuidedSessionState())).toEqual({ ok: false, error: "quota" });
  });
});
