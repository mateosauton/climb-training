import { describe, expect, it } from "vitest";
import { plan, type SessionLog } from "../../lib/training";
import { buildSessionRecommendation } from "./session-recommendation";

const productiveLog: SessionLog = {
  id: "log-1",
  sessionId: "w1d1",
  createdAt: "2026-07-14T12:00:00.000Z",
  notes: "Pies firmes y buen ritmo",
  rpe: 8,
  pump: 7,
  pain: 0,
  attempts: 12,
  moves: 45,
  bestLink: 32,
  footCuts: 1,
  pullWeight: 15,
  sleep: 8,
  energy: 8
};

describe("buildSessionRecommendation", () => {
  it("grades a productive low-pain session highly", () => {
    const result = buildSessionRecommendation(productiveLog, plan[0]);

    expect(result.score).toBeGreaterThanOrEqual(8);
    expect(result.summary).toContain("objetivo");
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it("keeps every session grade between 1 and 10", () => {
    const extreme = { ...productiveLog, rpe: 10, pain: 10, sleep: 0, energy: 0, footCuts: 200 };

    expect(buildSessionRecommendation(extreme, plan[0]).score).toBeGreaterThanOrEqual(1);
    expect(buildSessionRecommendation(extreme, plan[0]).score).toBeLessThanOrEqual(10);
  });

  it("prioritizes pain and recovery when the session is risky", () => {
    const risky = { ...productiveLog, pain: 5, sleep: 3, energy: 3 };
    const result = buildSessionRecommendation(risky, plan[0]);

    expect(result.score).toBeLessThan(6);
    expect(result.recommendations[0].toLowerCase()).toContain("dolor");
    expect(result.recommendations.join(" ").toLowerCase()).toContain("recuper");
  });
});
