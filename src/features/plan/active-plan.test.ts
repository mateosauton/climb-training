import { describe, expect, it } from "vitest";

import { readPlanSchedule, resolveActivePlan, scheduleOffsets } from "./active-plan";

const exercise = (id: string, sets: number, reps: number) => ({
  id: `${id}-row`,
  position: 1,
  exercise_id: id,
  exercise_content_version: 1,
  sets,
  reps,
  duration_seconds: null,
  cues: ["Hombros bajos"]
});

function plan(id: string, title: string, offsets: number[]) {
  return {
    id,
    version_number: 1,
    rationale: `${title} rationale`,
    published_at: "2026-11-02T15:00:00.000Z",
    status: "active",
    read_model_version: 1,
    sessions: offsets.map((offset, index) => ({
      id: `${id}-session-${index + 1}`,
      position: index + 1,
      scheduled_offset_days: offset,
      phase: index === 0 ? "Fuerza y potencia" : "Base",
      objective: `${title} objetivo ${index + 1}`,
      intensity: "moderate",
      expected_duration_minutes: 45 + index,
      recovery_guidance: "Descansá 48 horas.",
      blocks: [{
        id: `${id}-block-${index + 1}`,
        position: 1,
        phase: "work",
        title: index === 0 ? title : `${title} ${index + 1}`,
        instructions: "Trabajo controlado.",
        duration_minutes: 20,
        exercises: [exercise(`${id}-exercise`, 7, 3)]
      }]
    }))
  };
}

describe("active plan schedule", () => {
  it("anchors sessions on the athlete start date instead of the July 2026 template", () => {
    expect(scheduleOffsets([0, 2, 4], {
      startDate: "2026-11-02",
      weeklyAvailability: 7,
      preferredWeekdays: null
    })).toEqual(["2026-11-02", "2026-11-04", "2026-11-06"]);
  });

  it("keeps a rolling week inside the athlete availability", () => {
    expect(scheduleOffsets([0, 1, 2, 3], {
      startDate: "2026-11-02",
      weeklyAvailability: 2,
      preferredWeekdays: null
    })).toEqual(["2026-11-02", "2026-11-03", "2026-11-09", "2026-11-10"]);
  });

  it("moves sessions onto the chosen weekdays without sharing a day", () => {
    expect(scheduleOffsets([0, 1, 2], {
      startDate: "2026-11-02",
      weeklyAvailability: 7,
      preferredWeekdays: [1, 3, 5]
    })).toEqual(["2026-11-02", "2026-11-04", "2026-11-06"]);
  });

  it("reads the chosen start date before the publication date", () => {
    expect(readPlanSchedule({
      facts: [{ fact_key: "weeklyAvailability", value: "3" }],
      currentProfile: [{ fact_key: "planStartDate", value: "2026-12-01" }, { fact_key: "trainingWeekdays", value: "lunes, miercoles, viernes" }],
      publishedAt: "2026-11-02T15:00:00.000Z"
    })).toEqual({
      startDate: "2026-12-01",
      weeklyAvailability: 3,
      preferredWeekdays: [1, 3, 5]
    });
  });
});

describe("active plan projection", () => {
  it("projects ordered sessions, prescriptions, and guided blocks by plan session UUID", () => {
    const resolved = resolveActivePlan(plan("plan-a", "Fuerza de dedos", [0, 2]), readPlanSchedule({ publishedAt: "2026-11-02T15:00:00.000Z" }));
    expect(resolved.status).toBe("ready");
    if (resolved.status !== "ready") return;
    expect(resolved.plan.sessions.map((session) => session.id)).toEqual(["plan-a-session-1", "plan-a-session-2"]);
    expect(resolved.plan.sessions[0]).toMatchObject({
      date: "2026-11-02",
      title: "Fuerza de dedos",
      subtitle: "7x3",
      durationMinutes: 45,
      week: 1,
      day: 1
    });
    expect(resolved.plan.sessions.map((session) => session.date)).not.toContain("2026-07-09");
    expect(resolved.plan.guidedDefinitions["plan-a-session-1"]?.blocks[0]).toMatchObject({
      title: "Fuerza de dedos",
      dose: "7x3"
    });
    expect(resolved.plan.exercisesBySessionId["plan-a-session-1"]?.[0]?.dose).toBe("7x3");
  });

  it("renders different content for two active plans", () => {
    const fingers = resolveActivePlan(plan("plan-fingers", "Fuerza de dedos", [0]), readPlanSchedule({ publishedAt: "2026-11-02T00:00:00.000Z" }));
    const power = resolveActivePlan(plan("plan-power", "Potencia corta", [3]), readPlanSchedule({
      publishedAt: "2026-11-02T00:00:00.000Z",
      facts: [{ fact_key: "planStartDate", value: "2026-12-08" }]
    }));
    expect(fingers.status).toBe("ready");
    expect(power.status).toBe("ready");
    if (fingers.status !== "ready" || power.status !== "ready") return;
    expect(fingers.plan.sessions[0]?.title).not.toBe(power.plan.sessions[0]?.title);
    expect(fingers.plan.sessions[0]?.date).not.toBe(power.plan.sessions[0]?.date);
    expect(fingers.plan.sessions[0]?.id).not.toBe(power.plan.sessions[0]?.id);
  });

  it("distinguishes a missing plan from an unreadable plan", () => {
    expect(resolveActivePlan(null, null).status).toBe("empty");
    expect(resolveActivePlan({ id: "plan-header" }, readPlanSchedule({ publishedAt: "2026-11-02T00:00:00.000Z" })).status).toBe("invalid");
  });
});
