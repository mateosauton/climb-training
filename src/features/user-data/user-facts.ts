import { defaultState } from "../../lib/training";
import type { TrackerState } from "../../lib/training";
import type { UserFact, UserFactSource, UserFactValue, UserRecord } from "./user-data-types";
import { USER_FIELD_REGISTRY } from "./user-field-registry";

type UserFieldKey = keyof TrackerState["goals"] | keyof TrackerState["profile"];
type UserFieldValues = Partial<Record<UserFieldKey, UserFactValue>>;
type FactSourceInput = Omit<UserFactSource, "field">;

function equalValues(left: UserFactValue, right: UserFactValue): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left)
      && Array.isArray(right)
      && left.length === right.length
      && left.every((item, index) => Object.is(item, right[index]));
  }
  return Object.is(left, right);
}

function normalizedValue(value: UserFactValue): UserFactValue {
  return value === "" ? null : value;
}

export function currentFactsByKey(facts: UserFact[]): Map<string, UserFact> {
  const supersededIds = new Set(
    facts.flatMap((candidate) => candidate.supersedes ? [candidate.supersedes] : [])
  );
  const current = new Map<string, UserFact>();

  for (const candidate of facts) {
    if (supersededIds.has(candidate.id)) continue;
    const existing = current.get(candidate.key);
    if (!existing || candidate.recordedAt >= existing.recordedAt) {
      current.set(candidate.key, candidate);
    }
  }

  return current;
}

export function appendChangedFacts(
  record: UserRecord,
  values: UserFieldValues,
  source: FactSourceInput,
  recordedAt: string,
  makeId: () => string
): UserRecord {
  const current = currentFactsByKey(record.facts);
  const appended: UserFact[] = [];

  for (const [untypedKey, suppliedValue] of Object.entries(values)) {
    if (!Object.prototype.hasOwnProperty.call(USER_FIELD_REGISTRY, untypedKey)) continue;
    const key = untypedKey as UserFieldKey;
    const definition = USER_FIELD_REGISTRY[key];
    const value = normalizedValue(suppliedValue as UserFactValue);
    const previous = current.get(key);

    if ((!previous && value === null) || (previous && equalValues(previous.value, value))) continue;

    const next: UserFact = {
      id: makeId(),
      userId: record.identity.id,
      category: definition.category,
      key: definition.key,
      value,
      unit: definition.unit,
      recordedAt,
      source: { ...source, field: definition.key },
      supersedes: previous?.id ?? null
    };
    appended.push(next);
    current.set(key, next);
  }

  if (appended.length === 0) return record;
  return {
    ...record,
    identity: { ...record.identity, updatedAt: recordedAt },
    facts: [...record.facts, ...appended]
  };
}

function compatibilityValue(value: UserFactValue, fallback: string | number | boolean): string | number | boolean {
  if (value === null) {
    if (typeof fallback === "boolean") return false;
    if (typeof fallback === "number") return 0;
    return "";
  }
  if (Array.isArray(value)) return value.join(", ");
  if (typeof fallback === "boolean") return Boolean(value);
  if (typeof fallback === "number") return Number(value);
  return String(value);
}

export function projectTrackerState(record: UserRecord): TrackerState {
  const projected: TrackerState = {
    goals: { ...defaultState.goals },
    profile: { ...defaultState.profile },
    logs: record.sessionLogs,
    videos: record.videoAnalyses
  };

  for (const [key, fact] of currentFactsByKey(record.facts)) {
    if (!Object.prototype.hasOwnProperty.call(USER_FIELD_REGISTRY, key)) continue;
    const definition = USER_FIELD_REGISTRY[key as UserFieldKey];
    const destination = projected[definition.destination] as Record<string, string | number | boolean>;
    destination[key] = compatibilityValue(fact.value, destination[key]);
  }

  return projected;
}
