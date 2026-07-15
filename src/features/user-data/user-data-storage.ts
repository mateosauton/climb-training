import { defaultState, type TrackerState } from "../../lib/training";
import { loadGuidedSessionState } from "../guided-session/guided-session-storage";
import type { GuidedSessionDefinition } from "../guided-session/guided-session-types";
import { migrateLegacyUserData } from "./user-data-migration";
import type { UserDataEnvelope, UserDataLoadResult } from "./user-data-types";
import { validateUserDataEnvelope } from "./user-data-validation";

export const USER_DATA_STORAGE_KEY = "climb4w.users.v3";
export const LEGACY_USER_DATA_STORAGE_KEY = "climb4w.users.v2";
export const LEGACY_TRACKER_STORAGE_KEY = "climb4w.state.v1";
export const CLOUD_IMPORT_STATUS_STORAGE_KEY = "climb4w.cloud-import.v1";

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

/** Persists and verifies recovery state before an irreversible remote operation. */
export function persistRecoveryBeforeCloudEffect(storage: Storage, envelope: UserDataEnvelope): UserDataSaveResult {
  return saveUserData(storage, envelope);
}

function freshEnvelope(options: LoadOptions, now: string): UserDataEnvelope {
  const envelope = migrateLegacyUserData({ tracker: structuredClone(defaultState), guided: { schemaVersion: 1, activeRun: null, history: [] }, now, makeId: options.makeId });
  return { ...envelope, migration: { migratedFrom: null, migratedAt: null } };
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function migrateV2(value: unknown, now: string): UserDataEnvelope | null {
  if (!record(value) || !exact(value, ["schemaVersion", "activeUserId", "users", "migration"])) return null;
  if (value.schemaVersion !== 2 || typeof value.activeUserId !== "string" || !record(value.users) || !record(value.migration)) return null;
  if (!exact(value.migration, ["migratedFrom", "migratedAt"])) return null;
  if (value.migration.migratedFrom !== null && value.migration.migratedFrom !== LEGACY_TRACKER_STORAGE_KEY) return null;
  if (value.migration.migratedAt !== null && typeof value.migration.migratedAt !== "string") return null;

  const users: Record<string, unknown> = {};
  for (const [userId, candidate] of Object.entries(value.users)) {
    if (!record(candidate) || !exact(candidate, ["identity", "facts", "sessionLogs", "videoAnalyses", "guidedSessions"])) return null;
    if (!record(candidate.identity) || !exact(candidate.identity, ["id", "displayName", "createdAt", "updatedAt"])) return null;
    users[userId] = { ...candidate, identity: { ...candidate.identity, auth: null } };
  }

  return validateUserDataEnvelope({
    schemaVersion: 3,
    activeUserId: value.activeUserId,
    users,
    migration: { migratedFrom: LEGACY_USER_DATA_STORAGE_KEY, migratedAt: now }
  });
}

export function loadUserData(storage: Storage, options: LoadOptions): UserDataLoadResult {
  const now = options.now();
  let v3Raw: string | null;
  try {
    v3Raw = storage.getItem(USER_DATA_STORAGE_KEY);
  } catch {
    return { envelope: freshEnvelope(options, now), warning: "No pudimos acceder a los datos locales v3.", migrated: false, canPersist: true };
  }

  if (v3Raw !== null) {
    try {
      const envelope = validateUserDataEnvelope(JSON.parse(v3Raw));
      if (!envelope) throw new Error("invalid v3");
      return { envelope, warning: null, migrated: false, canPersist: true };
    } catch {
      return {
        envelope: freshEnvelope(options, now),
        warning: "Los datos locales v3 estan danados. Se conservaron sin cambios para poder recuperarlos.",
        migrated: false,
        canPersist: false
      };
    }
  }

  let v2Raw: string | null;
  try {
    v2Raw = storage.getItem(LEGACY_USER_DATA_STORAGE_KEY);
  } catch {
    return { envelope: freshEnvelope(options, now), warning: "No pudimos acceder a los datos locales v2.", migrated: false, canPersist: false };
  }

  if (v2Raw !== null) {
    try {
      const envelope = migrateV2(JSON.parse(v2Raw), now);
      if (!envelope) throw new Error("invalid v2");
      const saved = saveUserData(storage, envelope);
      if (saved.ok === false) return { envelope, warning: `No pudimos guardar los datos locales: ${saved.error}`, migrated: false, canPersist: true };
      return { envelope, warning: null, migrated: true, canPersist: true };
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
