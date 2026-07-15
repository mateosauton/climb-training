import { defaultState, type TrackerState } from "../../lib/training";
import { loadGuidedSessionState } from "../guided-session/guided-session-storage";
import type { GuidedSessionDefinition } from "../guided-session/guided-session-types";
import { migrateLegacyUserData } from "./user-data-migration";
import type { UserDataEnvelope, UserDataLoadResult } from "./user-data-types";
import { validateUserDataEnvelope } from "./user-data-validation";

export const USER_DATA_STORAGE_KEY = "climb4w.users.v2";
export const LEGACY_TRACKER_STORAGE_KEY = "climb4w.state.v1";

type LoadOptions = {
  now: () => string;
  makeId: () => string;
  normalizeLegacyTracker: (value: unknown) => TrackerState;
  guidedDefinitions: Record<string, GuidedSessionDefinition>;
};

export type UserDataSaveResult = { ok: true } | { ok: false; error: string };

function canonical(value: UserDataEnvelope): string {
  return JSON.stringify(value);
}

export function saveUserData(storage: Storage, envelope: UserDataEnvelope): UserDataSaveResult {
  try {
    const serialized = canonical(envelope);
    storage.setItem(USER_DATA_STORAGE_KEY, serialized);
    const verifiedRaw = storage.getItem(USER_DATA_STORAGE_KEY);
    if (verifiedRaw === null) throw new Error("No se pudo verificar el guardado");
    const verified = validateUserDataEnvelope(JSON.parse(verifiedRaw));
    if (!verified || canonical(verified) !== serialized) throw new Error("No se pudo verificar el guardado");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "No se pudo guardar" };
  }
}

function freshEnvelope(options: LoadOptions, now: string): UserDataEnvelope {
  const envelope = migrateLegacyUserData({ tracker: structuredClone(defaultState), guided: { schemaVersion: 1, activeRun: null, history: [] }, now, makeId: options.makeId });
  return { ...envelope, migration: { migratedFrom: null, migratedAt: null } };
}

export function loadUserData(storage: Storage, options: LoadOptions): UserDataLoadResult {
  const now = options.now();
  let v2Raw: string | null;
  try {
    v2Raw = storage.getItem(USER_DATA_STORAGE_KEY);
  } catch {
    return { envelope: freshEnvelope(options, now), warning: "No pudimos acceder a los datos locales v2.", migrated: false, canPersist: true };
  }

  if (v2Raw !== null) {
    try {
      const envelope = validateUserDataEnvelope(JSON.parse(v2Raw));
      if (!envelope) throw new Error("invalid v2");
      return { envelope, warning: null, migrated: false, canPersist: true };
    } catch {
      return {
        envelope: freshEnvelope(options, now),
        warning: "Los datos locales v2 estan danados. Se conservaron sin cambios para poder recuperarlos.",
        migrated: false,
        canPersist: false
      };
    }
  }

  let legacyRaw: string | null = null;
  let tracker = structuredClone(defaultState);
  try {
    legacyRaw = storage.getItem(LEGACY_TRACKER_STORAGE_KEY);
    if (legacyRaw !== null) tracker = options.normalizeLegacyTracker(JSON.parse(legacyRaw));
  } catch {
    tracker = structuredClone(defaultState);
  }

  const guided = loadGuidedSessionState(storage, options.guidedDefinitions, now);
  let envelope = migrateLegacyUserData({ tracker, guided: guided.state, now, makeId: options.makeId });
  if (legacyRaw === null) envelope = { ...envelope, migration: { migratedFrom: null, migratedAt: null } };

  const saved = saveUserData(storage, envelope);
  if (saved.ok === false) {
    return { envelope, warning: `No pudimos guardar los datos locales: ${saved.error}`, migrated: false, canPersist: true };
  }
  return { envelope, warning: guided.warning, migrated: legacyRaw !== null, canPersist: true };
}
