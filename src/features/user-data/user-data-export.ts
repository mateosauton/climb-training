import type { SessionLog } from "../../lib/training";
import type { GuidedRun, GuidedSessionState } from "../guided-session/guided-session-types";
import type { UserDataEnvelope, UserRecord } from "./user-data-types";

const SESSION_LOG_CSV_HEADERS = [
  "date",
  "session_id",
  "rpe",
  "pain",
  "best_link",
  "foot_cuts",
  "attempts",
  "moves",
  "pump",
  "energy",
  "sleep",
  "notes"
] as const;

const APP_NAME = "Maillon";
const PLAN_VERSION = "2026-07-09/2026-08-05";

function guidedRun(run: GuidedRun): GuidedRun {
  return {
    id: run.id, schemaVersion: 1, definitionVersion: run.definitionVersion, sessionId: run.sessionId, status: run.status,
    currentBlockIndex: run.currentBlockIndex, completedBlockIds: [...run.completedBlockIds], skippedBlockIds: [...run.skippedBlockIds],
    startedAt: run.startedAt, completedAt: run.completedAt, activeSegmentStartedAt: run.activeSegmentStartedAt,
    accumulatedActiveSeconds: run.accumulatedActiveSeconds, updatedAt: run.updatedAt
  };
}

function guidedState(state: GuidedSessionState): GuidedSessionState {
  return { schemaVersion: 1, activeRun: state.activeRun ? guidedRun(state.activeRun) : null, history: state.history.map(guidedRun) };
}

function cleanUser(user: UserRecord): UserRecord {
  return {
    identity: {
      id: user.identity.id,
      displayName: user.identity.displayName,
      createdAt: user.identity.createdAt,
      updatedAt: user.identity.updatedAt,
      auth: user.identity.auth ? { ...user.identity.auth } : null
    },
    facts: user.facts.map((fact) => ({
      id: fact.id, userId: fact.userId, category: fact.category, key: fact.key, value: Array.isArray(fact.value) ? [...fact.value] : fact.value,
      unit: fact.unit, recordedAt: fact.recordedAt, source: { type: fact.source.type, field: fact.source.field, version: fact.source.version }, supersedes: fact.supersedes
    })),
    sessionLogs: user.sessionLogs.map((log) => ({
      id: log.id, sessionId: log.sessionId, createdAt: log.createdAt, notes: log.notes, rpe: log.rpe, pump: log.pump, pain: log.pain,
      attempts: log.attempts, moves: log.moves, bestLink: log.bestLink, footCuts: log.footCuts, pullWeight: log.pullWeight, sleep: log.sleep, energy: log.energy
    })),
    videoAnalyses: user.videoAnalyses.map((video) => ({
      id: video.id, sessionId: video.sessionId, createdAt: video.createdAt, fileName: video.fileName, duration: video.duration, size: video.size,
      notes: video.notes, footCuts: video.footCuts, swing: video.swing, hips: video.hips, shoulder: video.shoulder, breath: video.breath, reading: video.reading,
      advice: Array.isArray(video.advice) ? video.advice.map(({ title, body }) => ({ title, body })) : [],
      ...(video.cloud ? { cloud: { ...video.cloud } } : {})
    })),
    guidedSessions: guidedState(user.guidedSessions)
  };
}

/** The recoverable, binary-free payload accepted by the cloud import boundary. */
export function buildLocalImportEnvelope(envelope: UserDataEnvelope): UserDataEnvelope {
  return {
    schemaVersion: 3,
    activeUserId: envelope.activeUserId,
    users: Object.fromEntries(Object.keys(envelope.users).sort().map((id) => [id, cleanUser(envelope.users[id])])),
    migration: { migratedFrom: envelope.migration.migratedFrom, migratedAt: envelope.migration.migratedAt }
  };
}

export function buildUserDataExport(envelope: UserDataEnvelope, exportedAt: string): string {
  const local = buildLocalImportEnvelope(envelope);
  return JSON.stringify({
    ...local,
    app: { name: APP_NAME, exportedAt, planVersion: PLAN_VERSION }
  }, null, 2);
}

export function userDataExportFilename(envelope: UserDataEnvelope, exportedAt: string): string {
  const user = envelope.activeUserId.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "user";
  const date = /^\d{4}-\d{2}-\d{2}/.exec(exportedAt)?.[0] ?? "export";
  return `maillon-user-${user}-${date}.json`;
}

function csvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function metricField(value: number | null | undefined): number | "" {
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

/** Session history for the active athlete. Same rows the JSON backup already contains. */
export function buildSessionLogsCsv(logs: readonly SessionLog[]): string {
  const rows = [...logs].sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  const lines = [
    SESSION_LOG_CSV_HEADERS.join(","),
    ...rows.map((log) => [
      typeof log.createdAt === "string" ? log.createdAt.slice(0, 10) : "",
      log.sessionId,
      metricField(log.rpe),
      metricField(log.pain),
      metricField(log.bestLink),
      metricField(log.footCuts),
      metricField(log.attempts),
      metricField(log.moves),
      metricField(log.pump),
      metricField(log.energy),
      metricField(log.sleep),
      log.notes
    ].map((value) => csvField(value)).join(","))
  ];
  return `${lines.join("\n")}\n`;
}

export function sessionLogsCsvFilename(envelope: UserDataEnvelope, exportedAt: string): string {
  return userDataExportFilename(envelope, exportedAt).replace(/\.json$/, ".csv");
}
