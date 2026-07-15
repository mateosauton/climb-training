import { assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { parseGeneratedPlan, type CatalogExercise } from "./schema.ts";

const catalog: CatalogExercise[] = [{
  id: "11111111-1111-4111-8111-111111111111",
  contentVersion: 1,
  movementTags: ["mobility"],
  contraindications: []
}, {
  id: "22222222-2222-4222-8222-222222222222",
  contentVersion: 1,
  movementTags: ["finger_strength"],
  contraindications: []
}];

function plan() {
  return {
    schemaVersion: 1,
    rationale: "Build capacity safely.",
    contraindications: [],
    sessions: [{
      position: 1, scheduledOffsetDays: 0, phase: "base", objective: "Mobility", intensity: "easy", durationMinutes: 30, recoveryGuidance: "Recover fully.",
      blocks: [{
        position: 1, phase: "main", title: "Mobility", instructions: "Move slowly.", durationMinutes: 20, completionRules: {},
        exercises: [{
          position: 1, exerciseId: catalog[0].id, exerciseContentVersion: 1, sets: 3, load: {}, cues: [], substitutions: [], generatorContext: {}
        }]
      }]
    }]
  };
}

const safety = {
  rulesetVersion: "rules-1",
  constraints: { maxSessionsPerWeek: 1, excludedMovementTags: [], requiredRecoveryHours: 48 },
  allowedCatalogExerciseIds: [catalog[0].id]
};

Deno.test("rejects a catalog exercise excluded by the safety result", () => {
  const output = plan();
  output.sessions[0].blocks[0].exercises[0].exerciseId = "22222222-2222-4222-8222-222222222222";

  assertThrows(() => parseGeneratedPlan(output, catalog, safety), Error, "disallowed_exercise_id");
});

Deno.test("rejects more sessions than the safety result permits", () => {
  const output = plan();
  output.sessions.push({ ...output.sessions[0], position: 2, scheduledOffsetDays: 3 });

  assertThrows(() => parseGeneratedPlan(output, catalog, safety), Error, "max_sessions_exceeded");
});

Deno.test("rejects sessions that do not meet the required recovery interval", () => {
  const output = plan();
  output.sessions.push({ ...output.sessions[0], position: 2, scheduledOffsetDays: 1 });

  assertThrows(() => parseGeneratedPlan(output, catalog, { ...safety, constraints: { ...safety.constraints, maxSessionsPerWeek: 2, requiredRecoveryHours: 48 } }), Error, "insufficient_recovery_hours");
});
