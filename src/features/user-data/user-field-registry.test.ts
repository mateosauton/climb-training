import { describe, expect, it } from "vitest";
import { defaultState } from "../../lib/training";
import { USER_FIELD_REGISTRY } from "./user-field-registry";

const categories = [
  "identity",
  "goal",
  "climbing",
  "capacity",
  "health",
  "recovery",
  "availability",
  "equipment",
  "preference",
  "coaching"
];

describe("user field registry", () => {
  it("registers every goal and profile field exactly once", () => {
    const expectedKeys = [
      ...Object.keys(defaultState.goals),
      ...Object.keys(defaultState.profile)
    ].sort();

    expect(Object.keys(USER_FIELD_REGISTRY).sort()).toEqual(expectedKeys);
    expect(new Set(Object.keys(USER_FIELD_REGISTRY)).size).toBe(expectedKeys.length);
  });

  it("gives every field a stable key, category, destination, and explicit unit", () => {
    for (const [key, definition] of Object.entries(USER_FIELD_REGISTRY)) {
      expect(definition.key).toBe(key);
      expect(categories).toContain(definition.category);
      expect(["goals", "profile"]).toContain(definition.destination);
      expect(definition.unit === null || typeof definition.unit === "string").toBe(true);
    }
  });

  it("maps goal and questionnaire metadata fields to their existing destinations", () => {
    expect(USER_FIELD_REGISTRY.project.destination).toBe("goals");
    expect(USER_FIELD_REGISTRY.focus.destination).toBe("goals");
    expect(USER_FIELD_REGISTRY.questionnaireCompleted.destination).toBe("profile");
    expect(USER_FIELD_REGISTRY.questionnaireCompletedAt.destination).toBe("profile");
    expect(USER_FIELD_REGISTRY.questionnaireVersion.destination).toBe("profile");
  });
});
