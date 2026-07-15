import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultState, type TrackerState } from "../../lib/training";
import { guidedSessionDefinitions } from "../guided-session/guided-session-data";
import { emptyGuidedSessionState, GUIDED_STORAGE_KEY } from "../guided-session/guided-session-storage";
import { migrateLegacyUserData } from "./user-data-migration";
import { loadUserData, saveUserData, USER_DATA_STORAGE_KEY } from "./user-data-storage";

const at = "2026-07-14T12:00:00.000Z";
const ids = () => { let index = 0; return () => `id-${++index}`; };
const normalize = (value: unknown): TrackerState => ({ ...structuredClone(defaultState), ...(value as Partial<TrackerState>) });
const options = (makeId = ids()) => ({ now: () => at, makeId, normalizeLegacyTracker: normalize, guidedDefinitions: guidedSessionDefinitions });

describe("user data storage", () => {
  beforeEach(() => localStorage.clear());

  it("loads valid v2 without inspecting or rewriting legacy data", () => {
    const envelope = migrateLegacyUserData({ tracker: defaultState, guided: emptyGuidedSessionState(), now: at, makeId: ids() });
    envelope.users[envelope.activeUserId].videoAnalyses.push({ id: "video", sessionId: "w1d1", createdAt: at, fileName: "move.mp4", duration: 10, size: 100, notes: "", footCuts: 0, swing: 0, hips: 0, shoulder: 0, breath: 0, reading: 0, advice: [{ title: "Control", body: "Respira." }] });
    localStorage.setItem(USER_DATA_STORAGE_KEY, JSON.stringify(envelope));
    localStorage.setItem("climb4w.state.v1", "not-json");
    expect(loadUserData(localStorage, options())).toEqual({ envelope, warning: null, migrated: false, canPersist: true });
  });

  it("migrates legacy state and guided progress once with a stable user ID", () => {
    localStorage.setItem("climb4w.state.v1", JSON.stringify({ ...defaultState, profile: { ...defaultState.profile, age: "31" } }));
    localStorage.setItem(GUIDED_STORAGE_KEY, JSON.stringify(emptyGuidedSessionState()));
    const first = loadUserData(localStorage, options());
    const second = loadUserData(localStorage, options());
    expect(first).toMatchObject({ warning: null, migrated: true, canPersist: true });
    expect(second).toMatchObject({ warning: null, migrated: false, canPersist: true });
    expect(second.envelope.activeUserId).toBe(first.envelope.activeUserId);
    expect(second.envelope).toEqual(first.envelope);
  });

  it("creates and persists one default user when no legacy data exists", () => {
    const loaded = loadUserData(localStorage, options());
    expect(loaded).toMatchObject({ warning: null, migrated: false, canPersist: true, envelope: { migration: { migratedFrom: null, migratedAt: null } } });
    expect(JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY)!)).toEqual(loaded.envelope);
  });

  it("isolates corrupt v2 without overwriting or remigrating it", () => {
    const corrupt = "{corrupt";
    localStorage.setItem(USER_DATA_STORAGE_KEY, corrupt);
    localStorage.setItem("climb4w.state.v1", JSON.stringify(defaultState));
    const loaded = loadUserData(localStorage, options());
    expect(loaded.warning).toMatch(/v2|recuperar/i);
    expect(loaded).toMatchObject({ migrated: false, canPersist: false });
    expect(localStorage.getItem(USER_DATA_STORAGE_KEY)).toBe(corrupt);
  });

  it("returns a failure instead of throwing when a write fails", () => {
    const envelope = migrateLegacyUserData({ tracker: defaultState, guided: emptyGuidedSessionState(), now: at, makeId: ids() });
    const storage = { ...localStorage, getItem: vi.fn(), setItem: vi.fn(() => { throw new Error("quota"); }) } as unknown as Storage;
    expect(saveUserData(storage, envelope)).toEqual({ ok: false, error: "quota" });
  });

  it("detects write-then-read verification failures", () => {
    const envelope = migrateLegacyUserData({ tracker: defaultState, guided: emptyGuidedSessionState(), now: at, makeId: ids() });
    const storage = { ...localStorage, setItem: vi.fn(), getItem: vi.fn(() => "{}") } as unknown as Storage;
    expect(saveUserData(storage, envelope)).toEqual({ ok: false, error: expect.stringMatching(/verificar/i) });
  });
});
