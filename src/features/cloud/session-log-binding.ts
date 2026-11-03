import type { SessionLog } from "../../lib/training";
import type { SessionBinding } from "./cloud-types";

export interface OpenSessionRunRef {
  id: string;
  planSessionId: string | null;
  legacySessionKey: string | null;
  sessionBinding: SessionBinding;
}

export interface SessionLogTarget {
  sessionBinding: SessionBinding;
  planSessionId: string | null;
  runId: string | null;
  legacySessionKey: string | null;
  localSessionId: string;
}

interface PlanSessionRef {
  id: string;
}

function isBinding(value: unknown): value is SessionBinding {
  return value === "plan" || value === "legacy" || value === "standalone";
}

export function openRunFromHydration(value: unknown): OpenSessionRunRef | null {
  if (!value || typeof value !== "object") return null;
  const run = value as {
    id?: unknown;
    plan_session_id?: unknown;
    legacy_session_key?: unknown;
    session_binding?: unknown;
  };
  if (typeof run.id !== "string" || !isBinding(run.session_binding)) return null;
  return {
    id: run.id,
    planSessionId: typeof run.plan_session_id === "string" ? run.plan_session_id : null,
    legacySessionKey: typeof run.legacy_session_key === "string" ? run.legacy_session_key : null,
    sessionBinding: run.session_binding
  };
}

export function resolveSessionLogTarget(input: {
  selectedSessionId: string | null | undefined;
  planSessions?: PlanSessionRef[] | null;
  openRun?: OpenSessionRunRef | null;
}): SessionLogTarget {
  const selected = typeof input.selectedSessionId === "string" ? input.selectedSessionId.trim() : "";
  const planIds = new Set((input.planSessions ?? []).map((session) => session.id));
  const openRun = input.openRun ?? null;
  const planSessionId = planIds.has(selected)
    ? selected
    : openRun?.sessionBinding === "plan" && openRun.planSessionId === selected
      ? selected
      : null;

  if (planSessionId) {
    const runId = openRun?.sessionBinding === "plan" && openRun.planSessionId === planSessionId ? openRun.id : null;
    return {
      sessionBinding: "plan",
      planSessionId,
      runId,
      legacySessionKey: null,
      localSessionId: planSessionId
    };
  }

  if (selected) {
    const runId = openRun?.sessionBinding === "legacy" && openRun.legacySessionKey === selected ? openRun.id : null;
    return {
      sessionBinding: "legacy",
      planSessionId: null,
      runId,
      legacySessionKey: selected,
      localSessionId: selected
    };
  }

  return {
    sessionBinding: "standalone",
    planSessionId: null,
    runId: openRun?.sessionBinding === "standalone" ? openRun.id : null,
    legacySessionKey: null,
    localSessionId: ""
  };
}

export function cloudLogSessionId(log: {
  session_binding?: unknown;
  plan_session_id?: unknown;
  legacy_session_key?: unknown;
  session_id?: unknown;
  metrics?: { sessionId?: unknown; session_id?: unknown } | null;
}): string {
  if (log.session_binding === "plan" && typeof log.plan_session_id === "string") return log.plan_session_id;
  if (log.session_binding === "legacy" && typeof log.legacy_session_key === "string") return log.legacy_session_key;
  if (log.session_binding === "standalone") return "";
  if (typeof log.plan_session_id === "string") return log.plan_session_id;
  if (typeof log.legacy_session_key === "string") return log.legacy_session_key;
  if (typeof log.metrics?.sessionId === "string") return log.metrics.sessionId;
  if (typeof log.metrics?.session_id === "string") return log.metrics.session_id;
  if (typeof log.session_id === "string") return log.session_id;
  return "w1d1";
}

function cloudRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : null;
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function firstNumber(fallback: number, ...values: unknown[]): number {
  for (const value of values) {
    const parsed = finiteNumber(value);
    if (parsed !== undefined) return parsed;
  }
  return fallback;
}

/** Map one hydrate_athlete_state session_logs row onto the client log the backup exports. */
export function sessionLogFromCloudRow(row: unknown): SessionLog {
  const log = cloudRecord(row) ?? {};
  const metrics = cloudRecord(log.metrics) ?? {};
  const body = typeof log.body === "string" ? log.body : "";
  const metricNotes = typeof metrics.notes === "string" ? metrics.notes : "";
  return {
    id: typeof log.idempotency_key === "string" ? log.idempotency_key : typeof log.id === "string" ? log.id : "",
    sessionId: cloudLogSessionId({
      session_binding: log.session_binding,
      plan_session_id: log.plan_session_id,
      legacy_session_key: log.legacy_session_key,
      session_id: log.session_id,
      metrics: { sessionId: metrics.sessionId, session_id: metrics.session_id }
    }),
    createdAt: typeof log.created_at === "string" && log.created_at
      ? log.created_at
      : typeof log.createdAt === "string" ? log.createdAt : "",
    notes: body || metricNotes,
    rpe: firstNumber(0, log.rpe, metrics.rpe),
    pump: firstNumber(0, log.pump, metrics.pump),
    pain: firstNumber(0, log.pain, metrics.pain),
    energy: firstNumber(0, log.energy, metrics.energy),
    attempts: firstNumber(0, log.attempts, metrics.attempts),
    moves: firstNumber(0, log.moves, metrics.moves),
    bestLink: firstNumber(0, log.best_link, log.bestLink, metrics.best_link, metrics.bestLink),
    footCuts: firstNumber(0, log.foot_cuts, log.footCuts, metrics.foot_cuts, metrics.footCuts),
    pullWeight: firstNumber(0, log.pull_weight, log.pullWeight, metrics.pull_weight, metrics.pullWeight),
    sleep: firstNumber(0, log.sleep, metrics.sleep)
  };
}
