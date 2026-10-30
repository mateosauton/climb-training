import type { SessionLog } from "../../lib/training";
import type { SessionLogInput } from "./cloud-types";
import type { SessionLogTarget } from "./session-log-binding";
import {
  classifySessionLogError,
  isSessionLogFailure,
  recordSessionLogFailure,
  sessionLogCloudWithoutLocalMessage,
  sessionLogFailureMessage,
  type SessionLogFailure,
  type SessionLogFailureCode
} from "./session-log-errors";
import {
  enqueueSessionLog,
  listPendingSessionLogs,
  markSessionLogSynced,
  noteSessionLogSyncError,
  type SessionLogOutboxRecord
} from "./session-log-outbox";

export interface SessionLogMetricInput {
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
}

export interface EnvelopeWrite<T> {
  ok: boolean;
  error?: string;
  envelope: T;
}

export type SessionLogSaveOutcome<T> =
  | {
    status: "saved";
    log: SessionLog;
    envelope: T;
    localVerified: boolean;
    warning: string | null;
  }
  | {
    status: "pending";
    log: SessionLog;
    envelope: T;
    code: Exclude<SessionLogFailureCode, "local_storage">;
    cause: string;
    message: string;
    localVerified: boolean;
  }
  | {
    status: "blocked";
    code: "local_storage";
    cause: string;
    message: string;
  };

export interface SessionLogRetryOutcome {
  status: "idle" | "synced" | "pending";
  code?: SessionLogFailureCode;
  cause?: string;
  message?: string;
}

function failureFrom(error: unknown): SessionLogFailure {
  if (isSessionLogFailure(error)) return error;
  return classifySessionLogError(error);
}

export function sessionLogFromOutbox(record: SessionLogOutboxRecord): SessionLog {
  return {
    id: record.idempotencyKey,
    sessionId: record.localSessionId || "w1d1",
    createdAt: record.createdAt,
    notes: record.notes,
    rpe: record.rpe,
    pump: record.pump,
    pain: record.pain,
    attempts: record.attempts,
    moves: record.moves,
    bestLink: record.bestLink,
    footCuts: record.footCuts,
    pullWeight: record.pullWeight,
    sleep: record.sleep,
    energy: record.energy
  };
}

export function sessionLogCloudInput(record: SessionLogOutboxRecord): SessionLogInput {
  return {
    idempotencyKey: record.idempotencyKey,
    sessionBinding: record.sessionBinding,
    ...(record.runId ? { runId: record.runId } : {}),
    ...(record.planSessionId ? { planSessionId: record.planSessionId } : {}),
    ...(record.legacySessionKey ? { sessionId: record.legacySessionKey } : {}),
    metrics: {
      rpe: record.rpe,
      pump: record.pump,
      pain: record.pain,
      energy: record.energy,
      attempts: record.attempts,
      moves: record.moves,
      bestLink: record.bestLink,
      footCuts: record.footCuts,
      pullWeight: record.pullWeight,
      sleep: record.sleep,
      ...(record.notes ? { notes: record.notes } : {})
    }
  };
}

export function mergePendingSessionLogs<T extends { sessionLogs: SessionLog[] }>(
  user: T,
  records: SessionLogOutboxRecord[]
): T {
  const ids = new Set(user.sessionLogs.map((log) => log.id));
  const extras = records
    .filter((record) => !ids.has(record.idempotencyKey))
    .map(sessionLogFromOutbox);
  if (!extras.length) return user;
  return { ...user, sessionLogs: [...user.sessionLogs, ...extras] };
}

function draftRecord(input: {
  idempotencyKey: string;
  createdAt: string;
  notes: string;
  metrics: SessionLogMetricInput;
  binding: SessionLogTarget;
}): SessionLogOutboxRecord {
  return {
    idempotencyKey: input.idempotencyKey,
    createdAt: input.createdAt,
    sessionBinding: input.binding.sessionBinding,
    planSessionId: input.binding.planSessionId,
    runId: input.binding.runId,
    legacySessionKey: input.binding.legacySessionKey,
    localSessionId: input.binding.localSessionId,
    notes: input.notes,
    ...input.metrics,
    lastErrorCode: null,
    lastCause: null
  };
}

export async function saveSessionLog<T>(input: {
  storage: Storage;
  idempotencyKey: string;
  createdAt: string;
  notes: string;
  metrics: SessionLogMetricInput;
  binding: SessionLogTarget;
  persistEnvelope: (log: SessionLog) => EnvelopeWrite<T> | Promise<EnvelopeWrite<T>>;
  appendSessionLog?: ((input: SessionLogInput) => Promise<void>) | null;
}): Promise<SessionLogSaveOutcome<T>> {
  const queued = enqueueSessionLog(input.storage, draftRecord(input));
  if (queued.ok === false) {
    recordSessionLogFailure("local_storage", queued.error);
    return { status: "blocked", code: "local_storage", cause: queued.error, message: sessionLogFailureMessage("local_storage") };
  }

  const record = queued.record;
  const log = sessionLogFromOutbox(record);
  let envelopeWrite: EnvelopeWrite<T> | null = null;
  try {
    envelopeWrite = await input.persistEnvelope(log);
  } catch {
    recordSessionLogFailure("local_storage", "write");
  }
  if (!envelopeWrite) {
    if (!input.appendSessionLog) {
      return { status: "blocked", code: "local_storage", cause: "write", message: sessionLogFailureMessage("local_storage") };
    }
    try {
      await input.appendSessionLog(sessionLogCloudInput(record));
    } catch (error) {
      if (!isDuplicateConflict(error)) {
        const failure = failureFrom(error);
        recordSessionLogFailure(failure.code, failure.cause);
        noteSessionLogSyncError(input.storage, record.idempotencyKey, failure.code, failure.cause);
        return {
          status: "blocked",
          code: "local_storage",
          cause: failure.cause,
          message: sessionLogFailureMessage(failure.code)
        };
      }
    }
    markSessionLogSynced(input.storage, record.idempotencyKey);
    return { status: "blocked", code: "local_storage", cause: "write", message: sessionLogCloudWithoutLocalMessage };
  }

  if (!input.appendSessionLog) {
    if (!envelopeWrite.ok) {
      return {
        status: "saved",
        log,
        envelope: envelopeWrite.envelope,
        localVerified: false,
        warning: `No pudimos guardar los datos locales: ${envelopeWrite.error ?? "write"}`
      };
    }
    markSessionLogSynced(input.storage, record.idempotencyKey);
    return { status: "saved", log, envelope: envelopeWrite.envelope, localVerified: true, warning: null };
  }

  try {
    await input.appendSessionLog(sessionLogCloudInput(record));
  } catch (error) {
    if (isDuplicateConflict(error)) {
      return finishCloudSave(input.storage, record, log, envelopeWrite);
    }
    const failure = failureFrom(error);
    recordSessionLogFailure(failure.code, failure.cause);
    noteSessionLogSyncError(input.storage, record.idempotencyKey, failure.code, failure.cause);
    return {
      status: "pending",
      log,
      envelope: envelopeWrite.envelope,
      code: failure.code === "local_storage" ? "network" : failure.code,
      cause: failure.cause,
      message: sessionLogFailureMessage(failure.code === "local_storage" ? "network" : failure.code),
      localVerified: envelopeWrite.ok
    };
  }

  return finishCloudSave(input.storage, record, log, envelopeWrite);
}

function isDuplicateConflict(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && (error as { code?: unknown }).code === "23505");
}

function finishCloudSave<T>(
  storage: Storage,
  record: SessionLogOutboxRecord,
  log: SessionLog,
  envelopeWrite: EnvelopeWrite<T>
): SessionLogSaveOutcome<T> {
  const cleared = markSessionLogSynced(storage, record.idempotencyKey);
  if (cleared.ok === false) {
    recordSessionLogFailure("local_storage", cleared.error);
    noteSessionLogSyncError(storage, record.idempotencyKey, "network", cleared.error);
    return {
      status: "pending",
      log,
      envelope: envelopeWrite.envelope,
      code: "network",
      cause: cleared.error,
      message: "El log ya está en la nube. Reintentá para cerrar la sincronización local.",
      localVerified: envelopeWrite.ok
    };
  }
  return {
    status: "saved",
    log,
    envelope: envelopeWrite.envelope,
    localVerified: envelopeWrite.ok,
    warning: envelopeWrite.ok ? null : sessionLogCloudWithoutLocalMessage
  };
}

export async function retryPendingSessionLogs(input: {
  storage: Storage;
  appendSessionLog: (input: SessionLogInput) => Promise<void>;
}): Promise<SessionLogRetryOutcome> {
  const pending = listPendingSessionLogs(input.storage);
  if (!pending.length) return { status: "idle" };
  for (const record of pending) {
    try {
      await input.appendSessionLog(sessionLogCloudInput(record));
    } catch (error) {
      if (!isDuplicateConflict(error)) {
        const failure = failureFrom(error);
        recordSessionLogFailure(failure.code, failure.cause);
        noteSessionLogSyncError(input.storage, record.idempotencyKey, failure.code, failure.cause);
        return {
          status: "pending",
          code: failure.code,
          cause: failure.cause,
          message: sessionLogFailureMessage(failure.code)
        };
      }
    }
    const cleared = markSessionLogSynced(input.storage, record.idempotencyKey);
    if (cleared.ok === false) {
      recordSessionLogFailure("local_storage", cleared.error);
      return {
        status: "pending",
        code: "local_storage",
        cause: cleared.error,
        message: "El log ya está en la nube. Reintentá para cerrar la sincronización local."
      };
    }
  }
  return { status: "synced" };
}
