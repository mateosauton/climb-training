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

function hasExactKeys(value: Record<string, unknown>, keys: string[]) {
  return Object.keys(value).length === keys.length
    && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function isGuidedRun(value: unknown): value is GuidedRun {
  if (!value || typeof value !== "object") return false;
  const run = value as Record<string, unknown>;
  return hasExactKeys(run, ["id", "schemaVersion", "definitionVersion", "sessionId", "status", "currentBlockIndex", "completedBlockIds", "skippedBlockIds", "startedAt", "completedAt", "activeSegmentStartedAt", "accumulatedActiveSeconds", "updatedAt"])
    && run.schemaVersion === 1
    && typeof run.id === "string"
    && Number.isInteger(run.definitionVersion)
    && typeof run.sessionId === "string"
    && ["summary", "active", "paused", "completed"].includes(String(run.status))
    && Number.isInteger(run.currentBlockIndex)
    && Number(run.currentBlockIndex) >= 0
    && isStringArray(run.completedBlockIds)
    && new Set(run.completedBlockIds).size === run.completedBlockIds.length
    && isStringArray(run.skippedBlockIds)
    && new Set(run.skippedBlockIds).size === run.skippedBlockIds.length
    && run.completedBlockIds.every((id) => !(run.skippedBlockIds as string[]).includes(id))
    && isNullableString(run.startedAt)
    && isNullableString(run.completedAt)
    && isNullableString(run.activeSegmentStartedAt)
    && typeof run.accumulatedActiveSeconds === "number"
    && Number.isFinite(run.accumulatedActiveSeconds)
    && run.accumulatedActiveSeconds >= 0
    && typeof run.updatedAt === "string";
}

export function isGuidedSessionState(value: unknown): value is GuidedSessionState {
  if (!value || typeof value !== "object") return false;
  const state = value as Record<string, unknown>;
  return hasExactKeys(state, ["schemaVersion", "activeRun", "history"])
    && state.schemaVersion === 1
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
