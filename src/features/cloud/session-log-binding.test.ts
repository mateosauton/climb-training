import { describe, expect, it } from "vitest";
import { buildSessionLogsCsv } from "../user-data/user-data-export";
import { sessionLogFromCloudRow } from "./session-log-binding";

describe("session log from a fetched cloud row", () => {
  it("reads typed session_logs columns that power the logger and the four KPIs", () => {
    const log = sessionLogFromCloudRow({
      id: "row-1",
      idempotency_key: "idem-1",
      session_binding: "plan",
      plan_session_id: "plan-1",
      created_at: "2026-11-03T18:00:00.000Z",
      body: "nota, con coma",
      rpe: 8,
      pain: 1,
      pump: 4,
      energy: 6,
      attempts: 5,
      moves: 11,
      best_link: 9,
      foot_cuts: 2,
      pull_weight: 0,
      sleep: 7,
      metrics: { bestLink: 1, footCuts: 9, notes: "stale" }
    });

    expect(log).toEqual({
      id: "idem-1",
      sessionId: "plan-1",
      createdAt: "2026-11-03T18:00:00.000Z",
      notes: "nota, con coma",
      rpe: 8,
      pump: 4,
      pain: 1,
      attempts: 5,
      moves: 11,
      bestLink: 9,
      footCuts: 2,
      pullWeight: 0,
      sleep: 7,
      energy: 6
    });
    expect(buildSessionLogsCsv([log])).toBe(
      "date,session_id,rpe,pain,best_link,foot_cuts,attempts,moves,pump,energy,sleep,notes\n" +
      "2026-11-03,plan-1,8,1,9,2,5,11,4,6,7,\"nota, con coma\"\n"
    );
  });

  it("keeps metrics already stored on older fetched rows", () => {
    expect(sessionLogFromCloudRow({
      id: "log-1",
      metrics: { sessionId: "w1d1", attempts: 4, moves: 10, bestLink: 3, footCuts: 0, pullWeight: 0, sleep: 7 },
      rpe: 7,
      pump: 5,
      pain: 1,
      energy: 8,
      body: "cloud",
      created_at: "2026-07-15T00:00:00.000Z"
    })).toMatchObject({
      id: "log-1",
      sessionId: "w1d1",
      bestLink: 3,
      footCuts: 0,
      attempts: 4,
      moves: 10,
      sleep: 7,
      notes: "cloud",
      rpe: 7
    });
  });
});
