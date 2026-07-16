import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { evaluateSafetyRules, RULESET_VERSION } from "./rules.ts";

const catalog = [
  { id: "finger-hang", contentVersion: 1, movementTags: ["finger_strength"] },
  { id: "easy-mobility", contentVersion: 1, movementTags: ["mobility"] }
];

const questionnaire = {
  version: 1,
  answers: { currentPain: 7, weeklyAvailability: 4, sleepBaseline: 8, stressBaseline: 3 }
};

Deno.test("current pain above the threshold removes high finger-load work", () => {
  const result = evaluateSafetyRules(questionnaire, catalog);

  assertEquals(result.status, "approved");
  assertEquals(result.constraints.excludedMovementTags, ["finger_strength"]);
  assertEquals(result.allowedCatalogExerciseIds, ["easy-mobility"]);
});

Deno.test("low availability limits the weekly session count", () => {
  const result = evaluateSafetyRules({ ...questionnaire, answers: { ...questionnaire.answers, weeklyAvailability: 1 } }, catalog);

  assertEquals(result.constraints.maxSessionsPerWeek, 1);
});

Deno.test("an unsupported exercise id is rejected", () => {
  assertThrows(() => evaluateSafetyRules(questionnaire, catalog, ["not-in-catalog"]), Error, "unsupported_exercise_id");
});

Deno.test("a fixed questionnaire snapshot returns the same rule result and ruleset version", () => {
  const first = evaluateSafetyRules(questionnaire, catalog);
  const second = evaluateSafetyRules(questionnaire, catalog);

  assertEquals(first, second);
  assertEquals(first.rulesetVersion, RULESET_VERSION);
});
