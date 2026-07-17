import { describe, expect, it } from "vitest";

import type { SessionLog } from "@/lib/training";
import {
  calculateCurrentWeekSessions,
  calculateGradeProgress,
  calculateTrainingLoad,
  calculateWeeklyStreak,
  formatAgeLocation
} from "./profile-summary";

function log(createdAt: string, overrides: Partial<SessionLog> = {}): SessionLog {
  return {
    id: createdAt,
    sessionId: "w1d1",
    createdAt,
    notes: "",
    rpe: 7,
    pump: 5,
    pain: 0,
    attempts: 10,
    moves: 40,
    bestLink: 10,
    footCuts: 0,
    pullWeight: 0,
    sleep: 8,
    energy: 8,
    ...overrides
  };
}

describe("profile summary", () => {
  it("formats age and location without empty placeholders", () => {
    expect(formatAgeLocation("28", "Salta")).toBe("28 años · Salta");
    expect(formatAgeLocation("28", "")).toBe("28 años");
    expect(formatAgeLocation("", "Salta")).toBe("Salta");
    expect(formatAgeLocation("", "")).toBe("");
  });

  it("counts sessions in the current Monday-based week", () => {
    const logs = [log("2026-07-13T10:00:00Z"), log("2026-07-17T10:00:00Z"), log("2026-07-12T10:00:00Z")];
    expect(calculateCurrentWeekSessions(logs, new Date("2026-07-17T15:00:00Z"))).toBe(2);
  });

  it("counts consecutive active weeks ending in the current week", () => {
    const logs = [
      log("2026-07-17T10:00:00Z"),
      log("2026-07-08T10:00:00Z"),
      log("2026-06-30T10:00:00Z"),
      log("2026-06-15T10:00:00Z")
    ];
    expect(calculateWeeklyStreak(logs, new Date("2026-07-17T15:00:00Z"))).toBe(3);
    expect(calculateWeeklyStreak([], new Date("2026-07-17T15:00:00Z"))).toBe(0);
  });

  it("classifies current-week training load", () => {
    const now = new Date("2026-07-17T15:00:00Z");
    expect(calculateTrainingLoad([], now)).toBe("Sin datos");
    expect(calculateTrainingLoad([log("2026-07-17T10:00:00Z", { rpe: 3, moves: 10, attempts: 2 })], now)).toBe("Baja");
    expect(calculateTrainingLoad([log("2026-07-17T10:00:00Z")], now)).toBe("Moderada");
    expect(calculateTrainingLoad([
      log("2026-07-16T10:00:00Z", { rpe: 10, moves: 80, attempts: 20 }),
      log("2026-07-17T10:00:00Z", { rpe: 10, moves: 80, attempts: 20 })
    ], now)).toBe("Alta");
  });

  it("normalizes comparable boulder and sport grades", () => {
    expect(calculateGradeProgress("V6", "V8")).toBe(75);
    expect(calculateGradeProgress("6c/7a", "7a+/7b")).toBeGreaterThan(80);
    expect(calculateGradeProgress("V6", "7a")).toBeNull();
    expect(calculateGradeProgress("", "V8")).toBeNull();
  });
});
