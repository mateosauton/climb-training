export const RULESET_VERSION = "rules-1";
export const PAIN_FINGER_LOAD_THRESHOLD = 5;

export type RuleQuestionnaire = { version: number; answers: Record<string, unknown> };
export type CatalogExercise = { id: string; contentVersion: number; movementTags: string[] };
export type SafetyResult = {
  status: "approved" | "rejected";
  rulesetVersion: string;
  constraints: { maxSessionsPerWeek: number; excludedMovementTags: string[]; requiredRecoveryHours: number };
  allowedCatalogExerciseIds: string[];
  reasons: string[];
};

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : fallback;
}

export function evaluateSafetyRules(
  questionnaire: RuleQuestionnaire,
  catalog: CatalogExercise[],
  requestedExerciseIds: string[] = []
): SafetyResult {
  const availableIds = new Set(catalog.map((exercise) => exercise.id));
  if (requestedExerciseIds.some((id) => !availableIds.has(id))) throw new Error("unsupported_exercise_id");

  const pain = boundedNumber(questionnaire.answers.currentPain, 0, 0, 10);
  const availability = Math.floor(boundedNumber(questionnaire.answers.weeklyAvailability, 3, 1, 7));
  const excludedMovementTags = pain > PAIN_FINGER_LOAD_THRESHOLD ? ["finger_strength"] : [];
  const allowedCatalogExerciseIds = catalog
    .filter((exercise) => !exercise.movementTags.some((tag) => excludedMovementTags.includes(tag)))
    .map((exercise) => exercise.id)
    .sort();

  return {
    status: allowedCatalogExerciseIds.length ? "approved" : "rejected",
    rulesetVersion: RULESET_VERSION,
    constraints: {
      maxSessionsPerWeek: availability,
      excludedMovementTags,
      requiredRecoveryHours: excludedMovementTags.length ? 72 : 48
    },
    allowedCatalogExerciseIds,
    reasons: excludedMovementTags.length ? ["current_pain_requires_finger_load_exclusion"] : []
  };
}
