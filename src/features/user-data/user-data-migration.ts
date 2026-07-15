import type { TrackerState } from "../../lib/training";
import type { GuidedSessionState } from "../guided-session/guided-session-types";
import type { UserDataEnvelope, UserFact, UserFactValue } from "./user-data-types";
import { USER_FIELD_REGISTRY } from "./user-field-registry";

function clone<T>(value: T): T {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value)) as T;
}

function supplied(value: unknown): value is UserFactValue {
  return (typeof value === "string" && value.length > 0)
    || typeof value === "number"
    || typeof value === "boolean"
    || (Array.isArray(value) && value.every((item) => typeof item === "string"));
}

export function migrateLegacyUserData(options: {
  tracker: TrackerState;
  guided: GuidedSessionState;
  now: string;
  makeId: () => string;
}): UserDataEnvelope {
  const { tracker, guided, now, makeId } = options;
  const userId = makeId();
  const facts: UserFact[] = [];

  for (const [key, definition] of Object.entries(USER_FIELD_REGISTRY)) {
    const collection = definition.destination === "goals" ? tracker.goals : tracker.profile;
    const value = (collection as Record<string, unknown>)[key];
    if (!supplied(value)) continue;
    facts.push({
      id: makeId(),
      userId,
      category: definition.category,
      key,
      value,
      unit: definition.unit,
      recordedAt: now,
      source: { type: "migration", field: key, version: 1 },
      supersedes: null
    });
  }

  return {
    schemaVersion: 2,
    activeUserId: userId,
    users: {
      [userId]: {
        identity: { id: userId, displayName: tracker.profile.name || "Usuario local", createdAt: now, updatedAt: now },
        facts,
        sessionLogs: clone(tracker.logs),
        videoAnalyses: clone(tracker.videos),
        guidedSessions: clone(guided)
      }
    },
    migration: { migratedFrom: "climb4w.state.v1", migratedAt: now }
  };
}
