import type { SessionBinding } from "./cloud-types";
import type { SessionLogFailureCode } from "./session-log-errors";

export const SESSION_LOG_OUTBOX_KEY = "climb4w.session-log-outbox.v1";

export interface SessionLogOutboxRecord {
  idempotencyKey: string;
  createdAt: string;
  sessionBinding: SessionBinding;
  planSessionId: string | null;
  runId: string | null;
  legacySessionKey: string | null;
  localSessionId: string;
  notes: string;
  rpe: number;
  pump: number;
  pain: number;
  attempts: number;
  moves: number;
  bestLink: number;
  footCuts: number;
  pullWeight: number;
  sleep: number;
  energy: number;
  lastErrorCode: SessionLogFailureCode | null;
  lastCause: string | null;
}

export type OutboxWriteResult =
  | { ok: true; record: SessionLogOutboxRecord }
  | { ok: false; error: "read" | "write" | "verify" };

function isRecord(value: unknown): value is SessionLogOutboxRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as SessionLogOutboxRecord;
  return typeof record.idempotencyKey === "string"
    && record.idempotencyKey.length > 0
    && (record.sessionBinding === "plan" || record.sessionBinding === "legacy" || record.sessionBinding === "standalone")
    && typeof record.createdAt === "string";
}

function readAll(storage: Storage): SessionLogOutboxRecord[] {
  try {
    const raw = storage.getItem(SESSION_LOG_OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isRecord);
  } catch {
    return [];
  }
}

function writeAll(storage: Storage, records: SessionLogOutboxRecord[], focusKey: string): OutboxWriteResult {
  const serialized = JSON.stringify(records);
  try {
    storage.setItem(SESSION_LOG_OUTBOX_KEY, serialized);
    if (storage.getItem(SESSION_LOG_OUTBOX_KEY) !== serialized) return { ok: false, error: "verify" };
  } catch {
    return { ok: false, error: "write" };
  }
  const stored = readAll(storage).find((record) => record.idempotencyKey === focusKey);
  if (!stored) return { ok: false, error: "verify" };
  return { ok: true, record: stored };
}

export function listPendingSessionLogs(storage: Storage): SessionLogOutboxRecord[] {
  return readAll(storage);
}

export function enqueueSessionLog(storage: Storage, record: SessionLogOutboxRecord): OutboxWriteResult {
  let existing: SessionLogOutboxRecord[];
  try {
    existing = readAll(storage);
  } catch {
    return { ok: false, error: "read" };
  }
  const previous = existing.find((item) => item.idempotencyKey === record.idempotencyKey);
  if (previous) return { ok: true, record: previous };
  return writeAll(storage, [...existing, record], record.idempotencyKey);
}

export function noteSessionLogSyncError(
  storage: Storage,
  idempotencyKey: string,
  code: SessionLogFailureCode,
  cause: string
): OutboxWriteResult {
  const existing = readAll(storage);
  const next = existing.map((record) => record.idempotencyKey === idempotencyKey
    ? { ...record, lastErrorCode: code, lastCause: cause }
    : record);
  if (!next.some((record) => record.idempotencyKey === idempotencyKey)) return { ok: false, error: "read" };
  return writeAll(storage, next, idempotencyKey);
}

export function markSessionLogSynced(storage: Storage, idempotencyKey: string): { ok: true } | { ok: false; error: "write" | "verify" } {
  const existing = readAll(storage);
  if (!existing.some((record) => record.idempotencyKey === idempotencyKey)) return { ok: true };
  const remaining = existing.filter((record) => record.idempotencyKey !== idempotencyKey);
  if (!remaining.length) {
    try {
      storage.removeItem(SESSION_LOG_OUTBOX_KEY);
      if (storage.getItem(SESSION_LOG_OUTBOX_KEY) !== null) return { ok: false, error: "verify" };
    } catch {
      return { ok: false, error: "write" };
    }
    return { ok: true };
  }
  const serialized = JSON.stringify(remaining);
  try {
    storage.setItem(SESSION_LOG_OUTBOX_KEY, serialized);
    if (storage.getItem(SESSION_LOG_OUTBOX_KEY) !== serialized) return { ok: false, error: "verify" };
  } catch {
    return { ok: false, error: "write" };
  }
  if (readAll(storage).some((record) => record.idempotencyKey === idempotencyKey)) return { ok: false, error: "verify" };
  return { ok: true };
}
