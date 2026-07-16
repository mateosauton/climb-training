type RecordValue = Record<string, unknown>;

const fields: Record<string, { category: string; unit: string | null; valueType: "string" | "number" | "boolean" }> = {
  currentGrade: { category: "climbing", unit: null, valueType: "string" }, targetGrade: { category: "goal", unit: null, valueType: "string" }, project: { category: "goal", unit: null, valueType: "string" }, focus: { category: "goal", unit: null, valueType: "string" },
  name: { category: "identity", unit: null, valueType: "string" }, location: { category: "identity", unit: null, valueType: "string" }, age: { category: "identity", unit: "years", valueType: "string" }, sex: { category: "identity", unit: null, valueType: "string" }, height: { category: "identity", unit: "cm", valueType: "string" }, weight: { category: "identity", unit: "kg", valueType: "string" }, wingspan: { category: "identity", unit: "cm", valueType: "string" }, apeIndex: { category: "identity", unit: "cm", valueType: "string" }, dominantHand: { category: "identity", unit: null, valueType: "string" }, handSize: { category: "identity", unit: null, valueType: "string" },
  climbingExperience: { category: "climbing", unit: "years", valueType: "string" }, maxBoulder: { category: "climbing", unit: null, valueType: "string" }, maxSport: { category: "climbing", unit: null, valueType: "string" }, styleStrengths: { category: "climbing", unit: null, valueType: "string" }, styleWeaknesses: { category: "climbing", unit: null, valueType: "string" }, fingerStrength: { category: "capacity", unit: null, valueType: "string" }, fingerEndurance: { category: "capacity", unit: null, valueType: "string" }, pullStrength: { category: "capacity", unit: "reps", valueType: "string" }, shoulderCapacity: { category: "capacity", unit: null, valueType: "string" }, coreTension: { category: "capacity", unit: null, valueType: "string" }, hipAnkleMobility: { category: "capacity", unit: null, valueType: "string" }, weeklyAvailability: { category: "availability", unit: "days", valueType: "string" }, trainingLoad: { category: "availability", unit: null, valueType: "string" }, sleepBaseline: { category: "recovery", unit: "hours", valueType: "string" }, stressBaseline: { category: "recovery", unit: "0-10", valueType: "string" }, boardSetup: { category: "equipment", unit: null, valueType: "string" }, equipment: { category: "equipment", unit: null, valueType: "string" }, strengths: { category: "coaching", unit: null, valueType: "string" }, limiters: { category: "coaching", unit: null, valueType: "string" }, injuryHistory: { category: "health", unit: null, valueType: "string" }, currentPain: { category: "health", unit: "0-10", valueType: "string" }, skinTolerance: { category: "health", unit: null, valueType: "string" }, nutritionRisk: { category: "health", unit: null, valueType: "string" }, recoveryNotes: { category: "recovery", unit: null, valueType: "string" }, coachNotes: { category: "coaching", unit: null, valueType: "string" }, questionnaireCompleted: { category: "preference", unit: "boolean", valueType: "boolean" }, questionnaireCompletedAt: { category: "preference", unit: null, valueType: "string" }, questionnaireVersion: { category: "preference", unit: null, valueType: "number" }
};

function record(value: unknown): value is RecordValue { return value !== null && typeof value === "object" && !Array.isArray(value); }
function exact(value: RecordValue, keys: string[]): boolean { return Object.keys(value).length === keys.length && keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)); }
function finite(value: unknown): value is number { return typeof value === "number" && Number.isFinite(value); }
function strings(value: unknown): value is string[] { return Array.isArray(value) && value.every((item) => typeof item === "string"); }
function iso(value: unknown): value is string { return typeof value === "string" && !Number.isNaN(Date.parse(value)); }
function factValue(value: unknown, expected: "string" | "number" | "boolean"): boolean { return value === null || typeof value === expected || (expected === "string" && strings(value)); }

function validFact(value: unknown, userId: string): boolean {
  if (!record(value) || !exact(value, ["id", "userId", "category", "key", "value", "unit", "recordedAt", "source", "supersedes"]) || value.userId !== userId || typeof value.id !== "string" || typeof value.key !== "string" || !iso(value.recordedAt) || (value.supersedes !== null && typeof value.supersedes !== "string") || !record(value.source) || !exact(value.source, ["type", "field", "version"])) return false;
  const field = fields[value.key];
  return !!field && value.category === field.category && value.unit === field.unit && factValue(value.value, field.valueType) && ["migration", "profile-form", "questionnaire", "import"].includes(String(value.source.type)) && value.source.field === value.key && Number.isInteger(value.source.version) && finite(value.source.version);
}

function validRun(value: unknown): boolean {
  return record(value) && exact(value, ["id", "schemaVersion", "definitionVersion", "sessionId", "status", "currentBlockIndex", "completedBlockIds", "skippedBlockIds", "startedAt", "completedAt", "activeSegmentStartedAt", "accumulatedActiveSeconds", "updatedAt"])
    && typeof value.id === "string" && value.schemaVersion === 1 && Number.isInteger(value.definitionVersion) && typeof value.sessionId === "string" && ["summary", "active", "paused", "completed"].includes(String(value.status)) && Number.isInteger(value.currentBlockIndex) && (value.currentBlockIndex as number) >= 0 && strings(value.completedBlockIds) && strings(value.skippedBlockIds) && [value.startedAt, value.completedAt, value.activeSegmentStartedAt].every((at) => at === null || iso(at)) && finite(value.accumulatedActiveSeconds) && (value.accumulatedActiveSeconds as number) >= 0 && iso(value.updatedAt);
}

function validVideo(value: unknown): boolean {
  const keys = ["id", "sessionId", "createdAt", "fileName", "duration", "size", "notes", "footCuts", "swing", "hips", "shoulder", "breath", "reading", "advice"];
  if (!record(value) || !keys.every((key) => Object.prototype.hasOwnProperty.call(value, key)) || !Object.keys(value).every((key) => keys.includes(key) || key === "cloud")) return false;
  return [value.id, value.sessionId, value.createdAt, value.fileName, value.notes].every((item) => typeof item === "string") && iso(value.createdAt) && [value.duration, value.size, value.footCuts, value.swing, value.hips, value.shoulder, value.breath, value.reading].every(finite) && Array.isArray(value.advice) && value.advice.every((advice) => record(advice) && exact(advice, ["title", "body"]) && typeof advice.title === "string" && typeof advice.body === "string") && (value.cloud === undefined || (record(value.cloud) && exact(value.cloud, ["id", "path", "uploadStatus"]) && typeof value.cloud.id === "string" && typeof value.cloud.path === "string" && ["pending", "uploaded", "analysis_pending"].includes(String(value.cloud.uploadStatus))));
}

function validRelationships(facts: RecordValue[], userId: string): boolean {
  const byId = new Map(facts.map((fact) => [fact.id as string, fact]));
  if (byId.size !== facts.length) return false;
  const superseded = new Set<string>();
  for (const fact of facts) {
    const supersedes = fact.supersedes as string | null;
    if (!supersedes) continue;
    const prior = byId.get(supersedes);
    if (!prior || prior.userId !== userId || prior.key !== fact.key || prior.category !== fact.category || superseded.has(supersedes)) return false;
    superseded.add(supersedes);
    const seen = new Set<string>();
    let cursor: RecordValue | undefined = fact;
    while (cursor?.supersedes) {
      if (seen.has(cursor.id as string)) return false;
      seen.add(cursor.id as string);
      cursor = byId.get(cursor.supersedes as string);
    }
  }
  return true;
}

function validUser(value: unknown, id: string, athleteId?: string): boolean {
  if (!record(value) || !exact(value, ["identity", "facts", "sessionLogs", "videoAnalyses", "guidedSessions"]) || !record(value.identity) || !exact(value.identity, ["id", "displayName", "createdAt", "updatedAt", "auth"])) return false;
  const identity = value.identity;
  if (identity.id !== id || typeof identity.displayName !== "string" || !iso(identity.createdAt) || !iso(identity.updatedAt) || (identity.auth !== null && (!record(identity.auth) || !exact(identity.auth, ["provider", "subject", "email"]) || identity.auth.provider !== "supabase" || typeof identity.auth.subject !== "string" || identity.auth.subject.length === 0 || (athleteId !== undefined && identity.auth.subject !== athleteId) || (identity.auth.email !== null && typeof identity.auth.email !== "string")))) return false;
  if (!Array.isArray(value.facts) || !value.facts.every((fact) => validFact(fact, id)) || !validRelationships(value.facts as RecordValue[], id) || !Array.isArray(value.sessionLogs) || !value.sessionLogs.every((log) => record(log) && exact(log, ["id", "sessionId", "createdAt", "notes", "rpe", "pump", "pain", "attempts", "moves", "bestLink", "footCuts", "pullWeight", "sleep", "energy"]) && typeof log.id === "string" && typeof log.sessionId === "string" && iso(log.createdAt) && typeof log.notes === "string" && [log.rpe, log.pump, log.pain, log.attempts, log.moves, log.bestLink, log.footCuts, log.pullWeight, log.sleep, log.energy].every(finite)) || !Array.isArray(value.videoAnalyses) || !value.videoAnalyses.every(validVideo) || !record(value.guidedSessions) || !exact(value.guidedSessions, ["schemaVersion", "activeRun", "history"]) || value.guidedSessions.schemaVersion !== 1 || (value.guidedSessions.activeRun !== null && !validRun(value.guidedSessions.activeRun)) || !Array.isArray(value.guidedSessions.history) || !value.guidedSessions.history.every(validRun)) return false;
  const events = [...value.sessionLogs, ...value.videoAnalyses, ...(value.guidedSessions.activeRun ? [value.guidedSessions.activeRun] : []), ...value.guidedSessions.history] as RecordValue[];
  return new Set(events.map((event) => event.id)).size === events.length;
}

export function validateLocalImportEnvelope(value: unknown, athleteId?: string): boolean {
  if (!record(value) || !exact(value, ["schemaVersion", "activeUserId", "users", "migration"]) || value.schemaVersion !== 3 || typeof value.activeUserId !== "string" || !record(value.users) || !record(value.migration) || !exact(value.migration, ["migratedFrom", "migratedAt"]) || !Object.prototype.hasOwnProperty.call(value.users, value.activeUserId) || ![null, "climb4w.state.v1", "climb4w.users.v2"].includes(value.migration.migratedFrom as null) || (value.migration.migratedAt !== null && !iso(value.migration.migratedAt))) return false;
  const subjects = new Set<string>();
  const factIds = new Set<string>();
  for (const [id, user] of Object.entries(value.users)) {
    if (!validUser(user, id, athleteId)) return false;
    const identity = (user as RecordValue).identity as RecordValue;
    if (identity.auth !== null) { const subject = (identity.auth as RecordValue).subject as string; if (subjects.has(subject)) return false; subjects.add(subject); }
    for (const fact of (user as RecordValue).facts as RecordValue[]) { if (factIds.has(fact.id as string)) return false; factIds.add(fact.id as string); }
  }
  return true;
}
