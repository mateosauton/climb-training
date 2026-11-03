/**
 * A 4-week anchor is a session_logs row, not a new table.
 * legacy_session_key is `anchor:hang-20mm` or `anchor:weighted-pullups`.
 * Hang seconds use `moves` (integer 0–500). Added pull-up kilos use `pull_weight`.
 * The edge or bar is `body` / notes. The next due date is created_at + 28 days.
 * These rows stay out of the weekly KPIs, streak, and training load.
 */
import type { SessionLogInput } from "../cloud/cloud-types";
import type { SessionLogOutboxRecord } from "../cloud/session-log-outbox";
import { addUtcDays, daysBetween } from "../plan/active-plan";

export const ANCHOR_INTERVAL_DAYS = 28;
const SETUP_MAX = 80;

export const ANCHOR_PROTOCOLS = {
  "hang-20mm": {
    id: "hang-20mm",
    sessionId: "anchor:hang-20mm",
    label: "Suspensión 20 mm",
    resultUnit: "s",
    resultLabel: "Segundos",
    setupLabel: "Canto",
    defaultSetup: "20 mm",
    instructions: "Semiarqueo a dos manos, brazos extendidos, peso corporal, hasta que se abra el agarre. Siempre el mismo canto de 20 mm.",
    min: 1,
    max: 300,
    integer: true
  },
  "weighted-pullups": {
    id: "weighted-pullups",
    sessionId: "anchor:weighted-pullups",
    label: "Dominadas lastradas",
    resultUnit: "kg",
    resultLabel: "Lastre",
    setupLabel: "Barra y agarre",
    defaultSetup: "Prono, ancho de hombros",
    instructions: "Una dominada estricta, agarre prono al ancho de hombros, desde suspensión completa. Anotá el máximo lastre. Misma barra y mismo agarre.",
    min: 0,
    max: 200,
    integer: false
  }
} as const;

export type AnchorProtocolId = keyof typeof ANCHOR_PROTOCOLS;
export type AnchorProtocol = (typeof ANCHOR_PROTOCOLS)[AnchorProtocolId];

const SESSION_IDS = new Map<string, AnchorProtocolId>(
  Object.values(ANCHOR_PROTOCOLS).map((protocol) => [protocol.sessionId, protocol.id])
);

export interface AnchorDraft {
  protocol: AnchorProtocolId;
  result: number;
  setup: string;
}

export interface AnchorDraftSuccess {
  ok: true;
  draft: AnchorDraft;
}

export interface AnchorDraftFailure {
  ok: false;
  message: string;
}

export interface AnchorLogFields {
  sessionId: string;
  notes: string;
  metrics: {
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
  };
}

export interface AnchorPoint {
  id: string;
  protocol: AnchorProtocolId;
  recordedOn: string;
  result: number;
  setup: string;
  delta: number | null;
  comparable: boolean;
}

export interface AnchorProtocolSchedule {
  protocol: AnchorProtocolId;
  status: "none" | "scheduled" | "due";
  last: AnchorPoint | null;
  dueOn: string | null;
  daysUntil: number | null;
  suggestedSetup: string;
  copy: string;
}

export interface AnchorHistory {
  points: AnchorPoint[];
  schedules: Record<AnchorProtocolId, AnchorProtocolSchedule>;
}

interface AnchorLog {
  id: string;
  sessionId: string;
  createdAt: string;
  notes: string;
  moves: number;
  pullWeight: number;
}

interface TimedPoint extends AnchorPoint {
  createdAt: string;
  index: number;
}

export function isAnchorSessionId(sessionId: string): boolean {
  return SESSION_IDS.has(sessionId);
}

export function trainingLogs<T extends { sessionId?: string }>(logs: readonly T[]): T[] {
  return logs.filter((log) => !log.sessionId || !isAnchorSessionId(log.sessionId));
}

export function parseAnchorDraft(input: { protocol: string; result: string; setup: string }): AnchorDraftSuccess | AnchorDraftFailure {
  if (!(input.protocol in ANCHOR_PROTOCOLS)) {
    return { ok: false, message: "Elegí suspensión 20 mm o dominadas lastradas." };
  }
  const protocol = input.protocol as AnchorProtocolId;
  const spec = ANCHOR_PROTOCOLS[protocol];
  const raw = input.result.trim();
  if (!raw) return { ok: false, message: "Anotá el resultado." };
  const result = Number(raw);
  if (!Number.isFinite(result)) return { ok: false, message: "Anotá el resultado." };
  if (spec.integer && !Number.isInteger(result)) return { ok: false, message: "Los segundos van sin decimales." };
  if (result < spec.min || result > spec.max) {
    return {
      ok: false,
      message: protocol === "hang-20mm"
        ? "La suspensión va de 1 a 300 segundos."
        : "El lastre va de 0 a 200 kg."
    };
  }
  const setup = normalizeSetup(input.setup);
  if (!setup) return { ok: false, message: "Anotá el canto o la barra para repetir el mismo setup." };
  if (setup.length > SETUP_MAX) return { ok: false, message: "El setup tiene que entrar en 80 caracteres." };
  return { ok: true, draft: { protocol, result, setup } };
}

export function anchorLogFields(draft: AnchorDraft): AnchorLogFields {
  const spec = ANCHOR_PROTOCOLS[draft.protocol];
  return {
    sessionId: spec.sessionId,
    notes: draft.setup,
    metrics: {
      rpe: 0,
      pump: 0,
      pain: 0,
      attempts: draft.protocol === "weighted-pullups" ? 1 : 0,
      moves: draft.protocol === "hang-20mm" ? draft.result : 0,
      bestLink: 0,
      footCuts: 0,
      pullWeight: draft.protocol === "weighted-pullups" ? draft.result : 0,
      sleep: 0,
      energy: 0
    }
  };
}

export function buildAnchorHistory(logs: readonly AnchorLog[], today: string): AnchorHistory {
  const timed = logs.flatMap((log, index) => {
    const point = readPoint(log, index);
    return point ? [point] : [];
  });
  const chronological = [...timed].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.index - right.index);
  const previous = new Map<AnchorProtocolId, TimedPoint>();
  const stamped = chronological.map((point) => {
    const prior = previous.get(point.protocol);
    previous.set(point.protocol, point);
    if (!prior) return { ...point, delta: null, comparable: true };
    if (prior.setup !== point.setup) return { ...point, delta: null, comparable: false };
    return { ...point, delta: point.result - prior.result, comparable: true };
  });
  const points = [...stamped]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt) || left.index - right.index)
    .map(stripTiming);
  const schedules = {
    "hang-20mm": scheduleFor("hang-20mm", stamped, today),
    "weighted-pullups": scheduleFor("weighted-pullups", stamped, today)
  };
  return { points, schedules };
}

export function formatAnchorResult(protocol: AnchorProtocolId, result: number): string {
  return `${formatMagnitude(protocol, result)} ${ANCHOR_PROTOCOLS[protocol].resultUnit}`;
}

export function formatAnchorDelta(protocol: AnchorProtocolId, point: Pick<AnchorPoint, "delta" | "comparable">): string {
  if (!point.comparable) return protocol === "hang-20mm" ? "canto distinto" : "agarre distinto";
  if (point.delta === null) return "primera marca";
  const tolerance = protocol === "hang-20mm" ? 0.5 : 0.05;
  if (Math.abs(point.delta) < tolerance) return "igual";
  const sign = point.delta > 0 ? "+" : "−";
  return `${sign}${formatMagnitude(protocol, Math.abs(point.delta))} ${ANCHOR_PROTOCOLS[protocol].resultUnit}`;
}

/** Cloud write for an anchor. Subjective session columns stay empty so a 0 RPE never hits the 1–10 check. */
export function anchorCloudInput(record: Pick<SessionLogOutboxRecord, "idempotencyKey" | "localSessionId" | "legacySessionKey" | "notes" | "moves" | "pullWeight" | "attempts">): SessionLogInput | null {
  const sessionId = isAnchorSessionId(record.localSessionId)
    ? record.localSessionId
    : record.legacySessionKey && isAnchorSessionId(record.legacySessionKey)
      ? record.legacySessionKey
      : null;
  if (!sessionId) return null;
  const protocol = SESSION_IDS.get(sessionId);
  if (!protocol) return null;
  return {
    idempotencyKey: record.idempotencyKey,
    sessionBinding: "legacy",
    sessionId,
    metrics: {
      ...(record.notes ? { notes: record.notes } : {}),
      ...(protocol === "hang-20mm" ? { moves: record.moves } : {}),
      ...(protocol === "weighted-pullups" ? { pullWeight: record.pullWeight, attempts: record.attempts || 1 } : {})
    }
  };
}

function scheduleFor(protocol: AnchorProtocolId, points: readonly TimedPoint[], today: string): AnchorProtocolSchedule {
  const own = points.filter((point) => point.protocol === protocol);
  const last = own.length ? stripTiming(own[own.length - 1]) : null;
  const spec = ANCHOR_PROTOCOLS[protocol];
  if (!last) {
    return {
      protocol,
      status: "none",
      last: null,
      dueOn: null,
      daysUntil: null,
      suggestedSetup: spec.defaultSetup,
      copy: "Sin ancla. Elegí un protocolo y repetilo cada 4 semanas, siempre en el mismo setup."
    };
  }
  const dueOn = addUtcDays(last.recordedOn, ANCHOR_INTERVAL_DAYS);
  const daysUntil = daysBetween(today, dueOn);
  const status = daysUntil <= 0 ? "due" : "scheduled";
  const label = spec.label.toLowerCase();
  const when = formatDay(last.recordedOn);
  const copy = status === "due"
    ? `Toca el ancla. La última ${label} fue el ${when}.`
    : `Próximo ancla el ${formatDay(dueOn)}. La última ${label} fue el ${when}.`;
  return { protocol, status, last, dueOn, daysUntil, suggestedSetup: last.setup, copy };
}

function readPoint(log: AnchorLog, index: number): TimedPoint | null {
  const protocol = SESSION_IDS.get(log.sessionId);
  if (!protocol) return null;
  const spec = ANCHOR_PROTOCOLS[protocol];
  const result = protocol === "hang-20mm" ? log.moves : log.pullWeight;
  if (!Number.isFinite(result) || result < spec.min || result > spec.max) return null;
  if (spec.integer && !Number.isInteger(result)) return null;
  const setup = normalizeSetup(log.notes);
  if (!setup) return null;
  const recordedOn = log.createdAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordedOn)) return null;
  return {
    id: log.id,
    protocol,
    recordedOn,
    result,
    setup,
    delta: null,
    comparable: true,
    createdAt: log.createdAt,
    index
  };
}

function stripTiming(point: TimedPoint): AnchorPoint {
  return {
    id: point.id,
    protocol: point.protocol,
    recordedOn: point.recordedOn,
    result: point.result,
    setup: point.setup,
    delta: point.delta,
    comparable: point.comparable
  };
}

function normalizeSetup(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function formatMagnitude(protocol: AnchorProtocolId, value: number): string {
  if (ANCHOR_PROTOCOLS[protocol].integer) return String(Math.round(value));
  return new Intl.NumberFormat("es-AR", { maximumFractionDigits: 1 }).format(value);
}

function formatDay(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}
