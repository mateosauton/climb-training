import { describe, expect, it } from "vitest";
import { plan, type SessionLog } from "../../lib/training";
import { metricsFromLogForm, resolveDayLogDefaults } from "./day-log-defaults";

const session = (id: string) => {
  const found = plan.find((item) => item.id === id);
  if (!found) throw new Error(`missing session ${id}`);
  return found;
};

function log(partial: Pick<SessionLog, "sessionId" | "createdAt" | "rpe" | "pain" | "attempts"> & Partial<SessionLog>): SessionLog {
  return {
    id: partial.sessionId + partial.createdAt,
    notes: partial.notes ?? "nota vieja",
    pump: partial.pump ?? 4,
    moves: partial.moves ?? 10,
    bestLink: partial.bestLink ?? 4,
    footCuts: partial.footCuts ?? 1,
    pullWeight: partial.pullWeight ?? 0,
    sleep: partial.sleep ?? 8,
    energy: partial.energy ?? 7,
    ...partial
  };
}

describe("resolveDayLogDefaults", () => {
  it("suggests a light rest day instead of a hard session", () => {
    const resolved = resolveDayLogDefaults({
      session: session("w1d4"),
      sessions: plan,
      logs: []
    });

    expect(resolved.source).toBe("plan-day");
    expect(resolved.values.rpe).toBeLessThanOrEqual(4);
    expect(resolved.values.pain).toBe(0);
    expect(resolved.values.attempts).toBe(0);
    expect(resolved.values.pump).toBe(0);
    expect(resolved.notes).toBe("");
    expect(resolved.sourceLabel).toMatch(/este día/i);
  });

  it("prefills hard attempts from the plan-day dose", () => {
    const resolved = resolveDayLogDefaults({
      session: session("w2d1"),
      sessions: plan,
      logs: []
    });

    expect(resolved.source).toBe("plan-day");
    expect(resolved.values.rpe).toBe(8);
    expect(resolved.values.pain).toBe(0);
    expect(resolved.values.attempts).toBe(15);
  });

  it("ignores per-problem attempt counts when the day has no session total", () => {
    const resolved = resolveDayLogDefaults({
      session: session("w1d1"),
      sessions: plan,
      logs: []
    });

    expect(resolved.values.rpe).toBe(8);
    expect(resolved.values.pain).toBe(0);
    expect(resolved.values.attempts).toBe(12);
  });

  it("reuses the latest log of the same day type", () => {
    const resolved = resolveDayLogDefaults({
      session: session("w2d2"),
      sessions: plan,
      logs: [
        log({
          sessionId: "w1d3",
          createdAt: "2026-07-11T12:00:00.000Z",
          rpe: 9,
          pain: 1,
          attempts: 16,
          pump: 8,
          moves: 40,
          bestLink: 12,
          footCuts: 2,
          sleep: 6,
          energy: 5,
          notes: "viejo"
        }),
        log({
          sessionId: "w1d1",
          createdAt: "2026-07-12T12:00:00.000Z",
          rpe: 8,
          pain: 0,
          attempts: 12,
          pump: 3,
          notes: "otro tipo"
        })
      ]
    });

    expect(resolved.source).toBe("day-type");
    expect(resolved.values.rpe).toBe(9);
    expect(resolved.values.pain).toBe(1);
    expect(resolved.values.attempts).toBe(16);
    expect(resolved.values.pump).toBe(8);
    expect(resolved.values.sleep).toBe(6);
    expect(resolved.notes).toBe("");
    expect(resolved.sourceLabel).toMatch(/Power endurance/);
  });

  it("prefers the log already saved for this plan day", () => {
    const resolved = resolveDayLogDefaults({
      session: session("w1d3"),
      sessions: plan,
      logs: [
        log({ sessionId: "w1d3", createdAt: "2026-07-11T12:00:00.000Z", rpe: 7, pain: 2, attempts: 11, notes: "hoy" }),
        log({ sessionId: "w2d2", createdAt: "2026-07-17T12:00:00.000Z", rpe: 9, pain: 0, attempts: 20, notes: "después" })
      ]
    });

    expect(resolved.source).toBe("same-session");
    expect(resolved.values.rpe).toBe(7);
    expect(resolved.values.pain).toBe(2);
    expect(resolved.values.attempts).toBe(11);
    expect(resolved.notes).toBe("");
  });
});

describe("metricsFromLogForm", () => {
  it("saves when the optional fields are blank", () => {
    const result = metricsFromLogForm({
      rpe: "8",
      pain: "0",
      attempts: "12",
      pump: "",
      moves: "",
      bestLink: "",
      footCuts: "",
      pullWeight: "",
      sleep: "",
      energy: "",
      notes: ""
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.metrics).toMatchObject({
      rpe: 8,
      pain: 0,
      attempts: 12,
      pump: 0,
      moves: 0,
      bestLink: 0,
      footCuts: 0,
      pullWeight: 0,
      sleep: 7,
      energy: 7
    });
  });

  it("rejects a blank RPE with the existing range message", () => {
    const result = metricsFromLogForm({
      rpe: "",
      pain: "0",
      attempts: "1",
      pump: "",
      moves: "",
      bestLink: "",
      footCuts: "",
      pullWeight: "",
      sleep: "",
      energy: ""
    });

    expect(result).toEqual({
      ok: false,
      field: "rpe",
      message: "RPE: usa un valor entre 1 y 10."
    });
  });

  it("rejects an optional field that is filled outside its range", () => {
    const result = metricsFromLogForm({
      rpe: "8",
      pain: "0",
      attempts: "4",
      pump: "11",
      moves: "",
      bestLink: "",
      footCuts: "",
      pullWeight: "",
      sleep: "",
      energy: ""
    });

    expect(result).toEqual(expect.objectContaining({
      ok: false,
      field: "pump",
      message: expect.stringMatching(/Bombeo/)
    }));
  });
});
