export const GENERATION_INPUT_SCHEMA_VERSION = 1;
export const GENERATED_PLAN_SCHEMA_VERSION = 1;

export type GenerationRequest = { questionnaireId: string; idempotencyKey: string };
export type CatalogExercise = { id: string; contentVersion: number; movementTags: string[]; contraindications: string[] };
export type ValidatedGenerationInput = {
  questionnaire: { id: string; version: number; answers: Record<string, unknown> };
  catalog: CatalogExercise[];
  safety: {
    rulesetVersion: string;
    constraints: { maxSessionsPerWeek: number; excludedMovementTags: string[]; requiredRecoveryHours: number };
    allowedCatalogExerciseIds: string[];
  };
};
export type GeneratedPlan = {
  schemaVersion: number;
  rationale: string;
  contraindications: string[];
  sessions: Array<{
    position: number; scheduledOffsetDays: number; phase: string; objective: string; intensity: string;
    durationMinutes: number; recoveryGuidance: string;
    blocks: Array<{
      position: number; phase: string; title: string; instructions: string; durationMinutes: number;
      completionRules: Record<string, unknown>;
      exercises: Array<{
        position: number; exerciseId: string; exerciseContentVersion: number; sets?: number; reps?: number;
        durationSeconds?: number; load: Record<string, unknown>; restSeconds?: number; cues: string[];
        substitutions: unknown[]; generatorContext: Record<string, unknown>;
      }>;
    }>;
  }>;
};

type RecordValue = Record<string, unknown>;
function record(value: unknown): value is RecordValue { return !!value && typeof value === "object" && !Array.isArray(value); }
function exact(value: RecordValue, keys: string[]): void { if (Object.keys(value).some((key) => !keys.includes(key))) throw new Error("unknown_key"); }
function string(value: unknown, name: string, max = 1000): string { if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`invalid_${name}`); return value; }
function number(value: unknown, name: string, min: number, max: number, required = true): number | undefined { if (value === undefined && !required) return undefined; if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) throw new Error(`invalid_${name}`); return value; }
function stringArray(value: unknown, name: string, max = 30): string[] { if (!Array.isArray(value) || value.length > max || value.some((item) => typeof item !== "string" || !item.trim())) throw new Error(`invalid_${name}`); return value as string[]; }
function jsonRecord(value: unknown, name: string): RecordValue { if (!record(value)) throw new Error(`invalid_${name}`); return value; }
function uuid(value: unknown, name: string): string { const result = string(value, name, 100); if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(result)) throw new Error(`invalid_${name}`); return result; }

export function parseGenerationRequest(value: unknown): GenerationRequest {
  if (!record(value)) throw new Error("invalid_request");
  exact(value, ["questionnaireId", "idempotencyKey"]);
  return { questionnaireId: uuid(value.questionnaireId, "questionnaire_id"), idempotencyKey: string(value.idempotencyKey, "idempotency_key", 128) };
}

export function parseGeneratedPlan(
  value: unknown,
  catalog: CatalogExercise[],
  safety: Pick<ValidatedGenerationInput["safety"], "constraints" | "allowedCatalogExerciseIds">
): GeneratedPlan {
  if (!record(value)) throw new Error("invalid_plan");
  exact(value, ["schemaVersion", "rationale", "contraindications", "sessions"]);
  if (number(value.schemaVersion, "schema_version", GENERATED_PLAN_SCHEMA_VERSION, GENERATED_PLAN_SCHEMA_VERSION) !== GENERATED_PLAN_SCHEMA_VERSION) throw new Error("invalid_schema_version");
  const catalogVersions = new Map(catalog.map((exercise) => [`${exercise.id}:${exercise.contentVersion}`, exercise]));
  if (!Array.isArray(value.sessions) || value.sessions.length === 0 || value.sessions.length > 42) throw new Error("invalid_sessions");
  const sessions = value.sessions.map((session, sessionIndex) => {
    if (!record(session)) throw new Error("invalid_session"); exact(session, ["position", "scheduledOffsetDays", "phase", "objective", "intensity", "durationMinutes", "recoveryGuidance", "blocks"]);
    const recoveryGuidance = string(session.recoveryGuidance, "recovery_guidance");
    if (!recoveryGuidance) throw new Error("missing_recovery_guidance");
    if (!Array.isArray(session.blocks) || !session.blocks.length) throw new Error("invalid_blocks");
    return { position: number(session.position, "session_position", sessionIndex + 1, sessionIndex + 1)!, scheduledOffsetDays: number(session.scheduledOffsetDays, "scheduled_offset_days", 0, 42)!, phase: string(session.phase, "phase"), objective: string(session.objective, "objective"), intensity: string(session.intensity, "intensity", 50), durationMinutes: number(session.durationMinutes, "duration_minutes", 1, 240)!, recoveryGuidance, blocks: session.blocks.map((block, blockIndex) => {
      if (!record(block)) throw new Error("invalid_block"); exact(block, ["position", "phase", "title", "instructions", "durationMinutes", "completionRules", "exercises"]);
      if (!Array.isArray(block.exercises) || !block.exercises.length) throw new Error("invalid_exercises");
      return { position: number(block.position, "block_position", blockIndex + 1, blockIndex + 1)!, phase: string(block.phase, "block_phase"), title: string(block.title, "block_title"), instructions: string(block.instructions, "instructions"), durationMinutes: number(block.durationMinutes, "block_duration_minutes", 1, 180)!, completionRules: jsonRecord(block.completionRules, "completion_rules"), exercises: block.exercises.map((exercise, exerciseIndex) => {
        if (!record(exercise)) throw new Error("invalid_exercise"); exact(exercise, ["position", "exerciseId", "exerciseContentVersion", "sets", "reps", "durationSeconds", "load", "restSeconds", "cues", "substitutions", "generatorContext"]);
        const exerciseId = uuid(exercise.exerciseId, "exercise_id"); const exerciseContentVersion = number(exercise.exerciseContentVersion, "exercise_content_version", 1, 999)!;
        if (!catalogVersions.has(`${exerciseId}:${exerciseContentVersion}`)) throw new Error("unsupported_exercise_id");
        if (!safety.allowedCatalogExerciseIds.includes(exerciseId)) throw new Error("disallowed_exercise_id");
        const sets = number(exercise.sets, "sets", 1, 20, false), reps = number(exercise.reps, "reps", 1, 100, false), durationSeconds = number(exercise.durationSeconds, "duration_seconds", 1, 3600, false);
        if (sets === undefined && reps === undefined && durationSeconds === undefined) throw new Error("missing_prescription");
        if (!Array.isArray(exercise.substitutions)) throw new Error("invalid_substitutions");
        return { position: number(exercise.position, "exercise_position", exerciseIndex + 1, exerciseIndex + 1)!, exerciseId, exerciseContentVersion, ...(sets === undefined ? {} : { sets }), ...(reps === undefined ? {} : { reps }), ...(durationSeconds === undefined ? {} : { durationSeconds }), load: jsonRecord(exercise.load, "load"), ...(exercise.restSeconds === undefined ? {} : { restSeconds: number(exercise.restSeconds, "rest_seconds", 0, 3600)! }), cues: stringArray(exercise.cues, "cues"), substitutions: exercise.substitutions, generatorContext: jsonRecord(exercise.generatorContext, "generator_context") };
      }) };
    }) };
  });
  const scheduledOffsets = sessions.map((session) => session.scheduledOffsetDays).sort((left, right) => left - right);
  if (scheduledOffsets.some((offset) => scheduledOffsets.filter((candidate) => candidate >= offset && candidate < offset + 7).length > safety.constraints.maxSessionsPerWeek)) {
    throw new Error("max_sessions_exceeded");
  }
  if (scheduledOffsets.some((offset, index) => index > 0 && (offset - scheduledOffsets[index - 1]) * 24 < safety.constraints.requiredRecoveryHours)) {
    throw new Error("insufficient_recovery_hours");
  }
  return { schemaVersion: GENERATED_PLAN_SCHEMA_VERSION, rationale: string(value.rationale, "rationale", 4000), contraindications: stringArray(value.contraindications, "contraindications"), sessions };
}

export function publicationHierarchy(plan: GeneratedPlan): Record<string, unknown> {
  return { sessions: plan.sessions.map((session) => ({ position: session.position, scheduled_offset_days: session.scheduledOffsetDays, phase: session.phase, objective: session.objective, intensity: session.intensity, expected_duration_minutes: session.durationMinutes, recovery_guidance: session.recoveryGuidance, blocks: session.blocks.map((block) => ({ position: block.position, phase: block.phase, title: block.title, instructions: block.instructions, duration_minutes: block.durationMinutes, completion_rules: block.completionRules, exercises: block.exercises.map((exercise) => ({ position: exercise.position, exercise_id: exercise.exerciseId, exercise_content_version: exercise.exerciseContentVersion, sets: exercise.sets ?? null, reps: exercise.reps ?? null, duration_seconds: exercise.durationSeconds ?? null, load: exercise.load, rest_seconds: exercise.restSeconds ?? null, cues: exercise.cues, substitutions: exercise.substitutions, generator_context: exercise.generatorContext })) })) })) };
}
