import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSessionLogTarget } from "./session-log-binding";
import {
  classifySessionLogError,
  recordSessionLogFailure,
  resetSessionLogObserver,
  sessionLogFailureMessage,
  setSessionLogObserver,
  type SessionLogObservation
} from "./session-log-errors";
import { listPendingSessionLogs, SESSION_LOG_OUTBOX_KEY } from "./session-log-outbox";
import type { SessionLogInput } from "./cloud-types";
import { retryPendingSessionLogs, saveSessionLog } from "./session-log-save";

const planSessionId = "00000000-0000-4000-8000-000000000a21";
const runId = "00000000-0000-4000-8000-000000000341";
const idempotencyKey = "00000000-0000-4000-8000-000000000c01";

const metrics = {
  rpe: 8,
  pump: 7,
  pain: 0,
  attempts: 12,
  moves: 40,
  bestLink: 3,
  footCuts: 1,
  pullWeight: 0,
  sleep: 7,
  energy: 7
};

function memoryStorage() {
  const values = new Map<string, string>();
  const order: string[] = [];
  const storage = {
    get length() { return values.size; },
    clear() { values.clear(); },
    getItem(key: string) {
      order.push(`get:${key}`);
      return values.has(key) ? values.get(key)! : null;
    },
    key() { return null; },
    removeItem(key: string) {
      order.push(`remove:${key}`);
      values.delete(key);
    },
    setItem(key: string, value: string) {
      order.push(`set:${key}`);
      values.set(key, value);
    },
    order
  };
  return storage;
}

function envelopeWriter(fail = false) {
  return (log: { id: string }) => ({ ok: !fail, error: fail ? "quota" : undefined, envelope: { savedId: log.id } });
}

describe("session log saves", () => {
  afterEach(() => resetSessionLogObserver());

  it("resolves a real plan session and its open run, and marks every other shape explicitly", () => {
    expect(resolveSessionLogTarget({
      selectedSessionId: planSessionId,
      planSessions: [{ id: planSessionId }],
      openRun: { id: runId, planSessionId, legacySessionKey: null, sessionBinding: "plan" }
    })).toEqual({
      sessionBinding: "plan",
      planSessionId,
      runId,
      legacySessionKey: null,
      localSessionId: planSessionId
    });

    expect(resolveSessionLogTarget({
      selectedSessionId: "w2d4",
      planSessions: [{ id: planSessionId }],
      openRun: { id: runId, planSessionId, legacySessionKey: null, sessionBinding: "plan" }
    })).toMatchObject({ sessionBinding: "legacy", legacySessionKey: "w2d4", planSessionId: null, runId: null });

    expect(resolveSessionLogTarget({
      selectedSessionId: "00000000-0000-4000-8000-0000000000ff",
      planSessions: [{ id: planSessionId }]
    })).toMatchObject({ sessionBinding: "legacy", planSessionId: null });

    expect(resolveSessionLogTarget({ selectedSessionId: "  ", planSessions: [] })).toMatchObject({
      sessionBinding: "standalone",
      planSessionId: null,
      legacySessionKey: null
    });
  });

  it("writes a durable outbox record before any remote request", async () => {
    const storage = memoryStorage();
    const timeline: string[] = [];
    const write = storage.setItem.bind(storage);
    storage.setItem = (key, value) => {
      if (key === SESSION_LOG_OUTBOX_KEY) timeline.push("outbox");
      write(key, value);
    };
    await saveSessionLog({
      storage,
      idempotencyKey,
      createdAt: "2026-10-30T12:00:00.000Z",
      notes: "beta",
      metrics,
      binding: resolveSessionLogTarget({ selectedSessionId: "w2d4", planSessions: [] }),
      persistEnvelope: (log) => {
        timeline.push("envelope");
        return envelopeWriter()(log);
      },
      appendSessionLog: async () => { timeline.push("remote"); }
    });

    expect(timeline).toEqual(["outbox", "envelope", "remote"]);
    expect(listPendingSessionLogs(storage)).toEqual([]);
  });

  it("keeps a cloud success when the local envelope cannot be verified", async () => {
    const storage = memoryStorage();
    const appendSessionLog = vi.fn(async () => undefined);
    const outcome = await saveSessionLog({
      storage,
      idempotencyKey,
      createdAt: "2026-10-30T12:00:00.000Z",
      notes: "beta",
      metrics,
      binding: resolveSessionLogTarget({ selectedSessionId: "w2d4" }),
      persistEnvelope: envelopeWriter(true),
      appendSessionLog
    });

    expect(appendSessionLog).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({
      status: "saved",
      localVerified: false,
      warning: "El log se guardó en la nube, pero no pudimos verificar la copia en este dispositivo.",
      log: { id: idempotencyKey, sessionId: "w2d4", notes: "beta" }
    });
    expect(listPendingSessionLogs(storage)).toEqual([]);
  });

  it("leaves a pending outbox record when the cloud write fails and retries the same key", async () => {
    const storage = memoryStorage();
    const events: SessionLogObservation[] = [];
    setSessionLogObserver((event) => events.push(event));
    const appendSessionLog = vi.fn()
      .mockRejectedValueOnce({ code: "42703", message: "column plan_session_id of relation session_logs does not exist" })
      .mockResolvedValueOnce(undefined);

    const failed = await saveSessionLog({
      storage,
      idempotencyKey,
      createdAt: "2026-10-30T12:00:00.000Z",
      notes: "beta",
      metrics,
      binding: resolveSessionLogTarget({ selectedSessionId: "w2d4" }),
      persistEnvelope: envelopeWriter(),
      appendSessionLog
    });

    expect(failed).toMatchObject({ status: "pending", code: "schema", cause: "42703" });
    expect(failed.status === "pending" && failed.message).toMatch(/estructura/);
    expect(JSON.stringify(failed)).not.toContain("plan_session_id");
    expect(listPendingSessionLogs(storage)).toHaveLength(1);
    expect(events).toEqual([{ name: "session_log_save_failed", code: "schema", cause: "42703" }]);

    const retried = await retryPendingSessionLogs({ storage, appendSessionLog });
    expect(retried).toEqual({ status: "synced" });
    expect(appendSessionLog).toHaveBeenCalledTimes(2);
    const retryCalls = appendSessionLog.mock.calls as Array<[{ idempotencyKey: string }]>;
    expect(retryCalls[0]?.[0].idempotencyKey).toBe(idempotencyKey);
    expect(retryCalls[1]?.[0].idempotencyKey).toBe(idempotencyKey);
    expect(listPendingSessionLogs(storage)).toEqual([]);
  });

  it("does not send a remote request when the outbox cannot be stored", async () => {
    const storage = memoryStorage();
    storage.setItem = () => { throw new Error("quota exceeded: session_logs"); };
    const appendSessionLog = vi.fn(async () => undefined);
    const events: SessionLogObservation[] = [];
    setSessionLogObserver((event) => events.push(event));

    const outcome = await saveSessionLog({
      storage,
      idempotencyKey,
      createdAt: "2026-10-30T12:00:00.000Z",
      notes: "beta",
      metrics,
      binding: resolveSessionLogTarget({ selectedSessionId: "w2d4" }),
      persistEnvelope: envelopeWriter(),
      appendSessionLog
    });

    expect(appendSessionLog).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: "blocked", code: "local_storage", cause: "write" });
    expect(JSON.stringify(outcome)).not.toContain("quota");
    expect(events).toEqual([{ name: "session_log_save_failed", code: "local_storage", cause: "write" }]);
  });

  it("sends one payload for two submits that share an idempotency key", async () => {
    const storage = memoryStorage();
    const appendSessionLog = vi.fn(async (_input: SessionLogInput) => { throw { code: "network", cause: "http_503" }; });
    const binding = resolveSessionLogTarget({
      selectedSessionId: planSessionId,
      planSessions: [{ id: planSessionId }],
      openRun: { id: runId, planSessionId, legacySessionKey: null, sessionBinding: "plan" }
    });
    const input = {
      storage,
      idempotencyKey,
      createdAt: "2026-10-30T12:00:00.000Z",
      notes: "beta",
      metrics,
      binding,
      persistEnvelope: envelopeWriter(),
      appendSessionLog
    };

    await saveSessionLog(input);
    await saveSessionLog({ ...input, notes: "changed", metrics: { ...metrics, attempts: 99 } });

    const sent = appendSessionLog.mock.calls;
    expect(appendSessionLog).toHaveBeenCalledTimes(2);
    expect(sent[0]?.[0]).toEqual(sent[1]?.[0]);
    expect(sent[0]?.[0]).toMatchObject({
      idempotencyKey,
      sessionBinding: "plan",
      planSessionId,
      runId
    });
    expect(sent[0]?.[0].sessionId).toBeUndefined();
    expect(sent[0]?.[0].metrics.sessionId).toBeUndefined();
    expect(sent[0]?.[0].metrics.attempts).toBe(12);
    expect(listPendingSessionLogs(storage)).toHaveLength(1);
  });

  it("maps validation, authentication, schema, and network failures to safe messages", () => {
    expect(classifySessionLogError({ code: "23514", message: "check constraint session_logs_attempts_check" })).toEqual({ code: "validation", cause: "23514" });
    expect(classifySessionLogError({ code: "PGRST301", message: "JWT expired" })).toEqual({ code: "unauthenticated", cause: "PGRST301" });
    expect(classifySessionLogError({ code: "42501", message: "new row violates row-level security policy" })).toEqual({ code: "unauthenticated", cause: "42501" });
    expect(classifySessionLogError({ code: "42P10", message: "no unique or exclusion constraint matching the ON CONFLICT specification" })).toEqual({ code: "schema", cause: "42P10" });
    expect(classifySessionLogError({ name: "TypeError", message: "Failed to fetch" })).toEqual({ code: "network", cause: "network" });
    expect(classifySessionLogError(new Error("column plan_session_id does not exist"))).toEqual({ code: "network", cause: "unknown" });

    const events: SessionLogObservation[] = [];
    setSessionLogObserver((event) => events.push(event));
    recordSessionLogFailure("schema", "42703");
    recordSessionLogFailure("network", "column plan_session_id does not exist");

    for (const code of ["validation", "unauthenticated", "schema", "network", "local_storage"] as const) {
      expect(sessionLogFailureMessage(code)).not.toMatch(/42703|23514|plan_session_id|SQL|JWT/);
    }
    expect(events).toEqual([
      { name: "session_log_save_failed", code: "schema", cause: "42703" },
      { name: "session_log_save_failed", code: "network", cause: "unknown" }
    ]);
  });
});
