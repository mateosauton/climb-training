import { defaultState, type SessionLog, type VideoAnalysis } from "../../lib/training";
import { isGuidedSessionState } from "../guided-session/guided-session-storage";
import type { GuidedRun } from "../guided-session/guided-session-types";
import type { UserDataEnvelope, UserFact, UserRecord } from "./user-data-types";
import { USER_FIELD_REGISTRY } from "./user-field-registry";

const categories = new Set(["identity", "goal", "climbing", "capacity", "health", "recovery", "availability", "equipment", "preference", "coaching"]);
const sourceTypes = new Set(["migration", "profile-form", "questionnaire", "import"]);

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exact(value: Record<string, unknown>, keys: string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key));
}

function finite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function validFactValue(value: unknown): boolean {
  return value === null || typeof value === "string" || typeof value === "boolean" || finite(value) || strings(value);
}

function isSessionLog(value: unknown): value is SessionLog {
  if (!record(value) || !exact(value, ["id", "sessionId", "createdAt", "notes", "rpe", "pump", "pain", "attempts", "moves", "bestLink", "footCuts", "pullWeight", "sleep", "energy"])) return false;
  return [value.id, value.sessionId, value.createdAt, value.notes].every((item) => typeof item === "string")
    && [value.rpe, value.pump, value.pain, value.attempts, value.moves, value.bestLink, value.footCuts, value.pullWeight, value.sleep, value.energy].every(finite);
}

function isVideoAnalysis(value: unknown): value is VideoAnalysis {
  if (!record(value) || !exact(value, ["id", "sessionId", "createdAt", "fileName", "duration", "size", "notes", "footCuts", "swing", "hips", "shoulder", "breath", "reading", "advice"])) return false;
  return [value.id, value.sessionId, value.createdAt, value.fileName, value.notes].every((item) => typeof item === "string")
    && [value.duration, value.size, value.footCuts, value.swing, value.hips, value.shoulder, value.breath, value.reading].every(finite)
    && Array.isArray(value.advice)
    && value.advice.every((item) => record(item) && exact(item, ["title", "body"]) && typeof item.title === "string" && typeof item.body === "string");
}

function fieldAcceptsValue(key: string, value: unknown): boolean {
  if (value === null) return true;
  const profile = defaultState.profile as Record<string, unknown>;
  const goals = defaultState.goals as Record<string, unknown>;
  const expected = Object.prototype.hasOwnProperty.call(profile, key) ? profile[key] : goals[key];
  return typeof value === typeof expected || (typeof expected === "string" && strings(value));
}

function isFact(value: unknown): value is UserFact {
  if (!record(value) || !exact(value, ["id", "userId", "category", "key", "value", "unit", "recordedAt", "source", "supersedes"])) return false;
  if (typeof value.id !== "string" || typeof value.userId !== "string" || typeof value.key !== "string" || typeof value.recordedAt !== "string") return false;
  if (!categories.has(String(value.category)) || !validFactValue(value.value) || !fieldAcceptsValue(value.key, value.value)) return false;
  if (value.unit !== null && typeof value.unit !== "string") return false;
  if (value.supersedes !== null && typeof value.supersedes !== "string") return false;
  if (!record(value.source) || !exact(value.source, ["type", "field", "version"])) return false;
  return sourceTypes.has(String(value.source.type)) && value.source.field === value.key && Number.isInteger(value.source.version) && finite(value.source.version);
}

function isIdentity(value: unknown, userId: string): boolean {
  if (!record(value) || !exact(value, ["id", "displayName", "createdAt", "updatedAt", "auth"])) return false;
  if (value.id !== userId || typeof value.displayName !== "string" || typeof value.createdAt !== "string" || typeof value.updatedAt !== "string") return false;
  if (value.auth === null) return true;
  return record(value.auth)
    && exact(value.auth, ["provider", "subject", "email"])
    && value.auth.provider === "apple"
    && typeof value.auth.subject === "string"
    && value.auth.subject.length > 0
    && (value.auth.email === null || typeof value.auth.email === "string");
}

function guidedRuns(recordValue: UserRecord): GuidedRun[] {
  return [...(recordValue.guidedSessions.activeRun ? [recordValue.guidedSessions.activeRun] : []), ...recordValue.guidedSessions.history];
}

function noDuplicateIds(values: { id: string }[]): boolean {
  return new Set(values.map(({ id }) => id)).size === values.length;
}

function validRelationships(userId: string, user: UserRecord): boolean {
  const byId = new Map(user.facts.map((fact) => [fact.id, fact]));
  for (const fact of user.facts) {
    if (fact.userId !== userId) return false;
    const definition = USER_FIELD_REGISTRY[fact.key as keyof typeof USER_FIELD_REGISTRY];
    if (!definition || fact.category !== definition.category || fact.unit !== definition.unit) return false;
    if (fact.supersedes !== null) {
      const prior = byId.get(fact.supersedes);
      if (!prior || prior.userId !== userId || prior.key !== fact.key || prior.category !== fact.category) return false;
    }
    const seen = new Set<string>();
    let cursor: UserFact | undefined = fact;
    while (cursor?.supersedes) {
      if (seen.has(cursor.id)) return false;
      seen.add(cursor.id);
      cursor = byId.get(cursor.supersedes);
    }
  }
  const superseded = user.facts.flatMap((fact) => fact.supersedes ? [fact.supersedes] : []);
  if (new Set(superseded).size !== superseded.length) return false;
  return true;
}

function parseUser(value: unknown, userId: string): UserRecord | null {
  if (!record(value) || !exact(value, ["identity", "facts", "sessionLogs", "videoAnalyses", "guidedSessions"])) return null;
  if (!isIdentity(value.identity, userId) || !Array.isArray(value.facts) || !value.facts.every(isFact)) return null;
  if (!Array.isArray(value.sessionLogs) || !value.sessionLogs.every(isSessionLog)) return null;
  if (!Array.isArray(value.videoAnalyses) || !value.videoAnalyses.every(isVideoAnalysis)) return null;
  if (!isGuidedSessionState(value.guidedSessions)) return null;
  const user = value as unknown as UserRecord;
  const events = [...user.sessionLogs, ...user.videoAnalyses, ...guidedRuns(user)];
  if (!validRelationships(userId, user) || !noDuplicateIds(events)) return null;
  return user;
}

export function validateUserDataEnvelope(value: unknown): UserDataEnvelope | null {
  if (!record(value) || !exact(value, ["schemaVersion", "activeUserId", "users", "migration"])) return null;
  if (value.schemaVersion !== 3 || typeof value.activeUserId !== "string" || !record(value.users) || !record(value.migration)) return null;
  if (!exact(value.migration, ["migratedFrom", "migratedAt"])) return null;
  if (value.migration.migratedFrom !== null && value.migration.migratedFrom !== "climb4w.state.v1" && value.migration.migratedFrom !== "climb4w.users.v2") return null;
  if (value.migration.migratedAt !== null && typeof value.migration.migratedAt !== "string") return null;
  if (!Object.prototype.hasOwnProperty.call(value.users, value.activeUserId)) return null;

  const factIds = new Set<string>();
  const authSubjects = new Set<string>();
  for (const [userId, candidate] of Object.entries(value.users)) {
    const user = parseUser(candidate, userId);
    if (!user) return null;
    const subject = user.identity.auth?.subject;
    if (subject) {
      if (authSubjects.has(subject)) return null;
      authSubjects.add(subject);
    }
    for (const fact of user.facts) {
      if (factIds.has(fact.id)) return null;
      factIds.add(fact.id);
    }
  }
  return value as unknown as UserDataEnvelope;
}
