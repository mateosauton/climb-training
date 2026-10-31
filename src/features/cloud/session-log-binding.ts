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
