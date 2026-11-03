import { describe, expect, it } from "vitest";

import { emptyGuidedSessionState } from "../features/guided-session/guided-session-storage";
import { migrateLegacyUserData } from "../features/user-data/user-data-migration";
import { projectTrackerState } from "../features/user-data/user-facts";
import { cloudBaselineState } from "./cloud-baseline";
import { defaultState } from "./training";

describe("cloudBaselineState", () => {
  it("blanks the cloud profile seed and leaves the demo seed untouched", () => {
    const baseline = cloudBaselineState();

    expect(baseline.profile.name).toBe("");
    expect(baseline.profile.injuryHistory).toBe("");
    expect(baseline.profile.recoveryNotes).toBe("");
    expect(baseline.profile.location).toBe(defaultState.profile.location);
    expect(baseline.goals).toEqual(defaultState.goals);
    expect(defaultState.profile.name).toBe("Mateo");
    expect(defaultState.profile.injuryHistory).toMatch(/dedos/i);
    expect(defaultState.profile.recoveryNotes).toMatch(/sueno/i);
  });

  it("projects a fresh cloud record without Mateo name or injury notes", () => {
    let next = 0;
    const envelope = migrateLegacyUserData({
      tracker: cloudBaselineState(),
      guided: emptyGuidedSessionState(),
      now: "2026-11-03T00:00:00.000Z",
      makeId: () => `cloud-${++next}`
    });
    const record = envelope.users[envelope.activeUserId];

    expect(record.facts.some((fact) => fact.key === "name" || fact.key === "injuryHistory" || fact.key === "recoveryNotes")).toBe(false);
    expect(projectTrackerState(record, cloudBaselineState()).profile).toMatchObject({
      name: "",
      injuryHistory: "",
      recoveryNotes: ""
    });
    expect(projectTrackerState(record).profile.name).toBe("Mateo");
  });
});
