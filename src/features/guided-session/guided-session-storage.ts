import { guidedSessionReducer } from "./guided-session-reducer";
import type { GuidedRun, GuidedSessionDefinition, GuidedSessionState } from "./guided-session-types";

export const GUIDED_STORAGE_KEY = "climb4w.guided.v1";

export function emptyGuidedSessionState(): GuidedSessionState {
  return { schemaVersion: 1, activeRun: null, history: [] };
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isGuidedRun(value: unknown): value is GuidedRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Record<string, unknown>;
  return run.schemaVersion === 1
    && typeof run.id === "string"
    && typeof run.definitionVersion === "number"
    && typeof run.sessionId === "string"
    && ["summary", "active", "paused", "completed"].includes(String(run.status))
    && typeof run.currentBlockIndex === "number"
    && isStringArray(run.completedBlockIds)
    && isStringArray(run.skippedBlockIds)
    && isNullableString(run.startedAt)
    && isNullableString(run.completedAt)
    && isNullableString(run.activeSegmentStartedAt)
    && typeof run.accumulatedActiveSeconds === "number"
    && typeof run.updatedAt === "string";
}

export function isGuidedSessionState(value: unknown): value is GuidedSessionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return state.schemaVersion === 1
    && (state.activeRun === null || isGuidedRun(state.activeRun))
    && Array.isArray(state.history)
    && state.history.every(isGuidedRun);
}

export type GuidedStorageLoad = { state: GuidedSessionState; warning: string | null };
export type GuidedStorageSave = { ok: true } | { ok: false; error: string };

export function loadGuidedSessionState(
  storage: Storage,
  definitions: Record<string, GuidedSessionDefinition>,
  now: string
): GuidedStorageLoad {
  try {
    const raw = storage.getItem(GUIDED_STORAGE_KEY);
    if (!raw) return { state: emptyGuidedSessionState(), warning: null };
    const parsed: unknown = JSON.parse(raw);
    if (!isGuidedSessionState(parsed)) throw new Error("invalid guided state");
    const state = guidedSessionReducer(parsed, { type: "RESTORE", definitions, now });
    return { state, warning: null };
  } catch {
    return {
      state: emptyGuidedSessionState(),
      warning: "No pudimos recuperar la sesion guiada guardada. Podes empezar una nueva."
    };
  }
}

export function saveGuidedSessionState(storage: Storage, state: GuidedSessionState): GuidedStorageSave {
  try {
    storage.setItem(GUIDED_STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar" };
  }
}
