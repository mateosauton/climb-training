import { describe, expect, it, vi } from "vitest";

import { createCloudRepository, type CloudQueryClient } from "./cloud-repository";

type Call = {
  table: string;
  operation: "insert" | "select" | "upsert";
  value?: unknown;
  options?: unknown;
  filters: Array<[string, unknown]>;
};

function createFakeClient() {
  const calls: Call[] = [];
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const invoke = vi.fn().mockResolvedValue({ data: { jobId: "job-1", status: "provider_not_configured" }, error: null });
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "athlete-1" } }, error: null });

  const client: CloudQueryClient = {
    auth: { getUser },
    rpc,
    functions: { invoke },
    from(table) {
      const filters: Array<[string, unknown]> = [];
      return {
        insert(value) {
          calls.push({ table, operation: "insert", value, filters });
          return Promise.resolve({ data: null, error: null });
        },
        upsert(value, options) {
          calls.push({ table, operation: "upsert", value, options, filters });
          return Promise.resolve({ data: null, error: null });
        },
        select() {
          calls.push({ table, operation: "select", filters });
          return {
            eq(column, value) {
              filters.push([column, value]);
              return this;
            },
            maybeSingle: () => Promise.resolve({ data: null, error: null })
          };
        }
      };
    }
  };

  return { client, calls, rpc, getUser, invoke };
}

describe("cloud repository", () => {
  it("hydrates cloud facts, activity, guided state, and the active plan on reload", async () => {
    const fake = createFakeClient();
    fake.rpc.mockResolvedValueOnce({ data: {
      facts: [{ id: "fact-1", fact_key: "name", value: "Mateo" }],
      sessionLogs: [{ id: "log-1", metrics: { attempts: 4 } }],
      guided: { schemaVersion: 1, activeRun: null, history: [] },
      activePlan: { id: "plan-1" },
      profile: { avatar_path: "athlete-1/avatar.webp" }
    }, error: null });

    await expect(createCloudRepository(fake.client).hydrate()).resolves.toMatchObject({
      facts: [{ id: "fact-1" }], sessionLogs: [{ id: "log-1" }], activePlan: { id: "plan-1" },
      profile: { avatarPath: "athlete-1/avatar.webp" }
    });
  });

  it("persists the profile photo path for the authenticated athlete", async () => {
    const fake = createFakeClient();

    await createCloudRepository(fake.client).saveAvatarPath("athlete-1/avatar.png");

    expect(fake.rpc).toHaveBeenCalledWith("update_avatar_path", { p_avatar_path: "athlete-1/avatar.png" });
    expect(fake.calls).toEqual([]);
  });

  it("uses caller-stable IDs when retrying facts, logs, and guided state", async () => {
    const fake = createFakeClient();
    const repository = createCloudRepository(fake.client);
    await repository.appendFacts([{ id: "00000000-0000-4000-8000-000000000001", key: "name", value: "Mateo", source: { type: "profile-form", field: "name", version: 1 }, supersedes: null, recordedAt: "2026-07-15T00:00:00.000Z" }]);
    await repository.appendSessionLog({ idempotencyKey: "00000000-0000-4000-8000-000000000002", sessionId: "w1d1", metrics: { attempts: 4, notes: "good" } });
    await repository.saveGuidedState({ schemaVersion: 1, activeRun: null, history: [] }, "00000000-0000-4000-8000-000000000003");

    expect(fake.calls.map(({ table, operation, options }) => ({ table, operation, options }))).toEqual([
      { table: "athlete_facts", operation: "upsert", options: { onConflict: "id", ignoreDuplicates: true } },
      { table: "session_logs", operation: "upsert", options: { onConflict: "athlete_id,idempotency_key", ignoreDuplicates: true } },
      { table: "athlete_guided_states", operation: "upsert", options: { onConflict: "athlete_id", ignoreDuplicates: false } }
    ]);
  });
  it("uses the authenticated identity for all athlete writes", async () => {
    const fake = createFakeClient();
    const repository = createCloudRepository(fake.client, () => "2026-07-15T12:00:00.000Z");

    await repository.ensureProfile();
    await repository.submitQuestionnaire({ version: 2, answers: { goal: "boulder" }, idempotencyKey: "questionnaire-1" });
    await repository.startSessionRun({ planId: "plan-1", planSessionId: "session-1" });
    await repository.appendSessionLog({
      runId: "run-1",
      metrics: { rpe: 7, pump: 5, pain: 1, energy: 8, notes: "felt good" }
    });

    expect(fake.rpc).toHaveBeenCalledWith("ensure_athlete_profile");
    expect(fake.calls).toEqual([
      {
        table: "questionnaire_submissions",
        operation: "upsert",
        value: {
          athlete_id: "athlete-1",
          answers: { goal: "boulder" },
          idempotency_key: "questionnaire-1",
          source: { version: 2 }
        },
        options: { onConflict: "athlete_id,idempotency_key", ignoreDuplicates: true },
        filters: []
      },
      {
        table: "session_runs",
        operation: "insert",
        value: {
          athlete_id: "athlete-1",
          plan_id: "plan-1",
          plan_session_id: "session-1",
          status: "in_progress",
          started_at: "2026-07-15T12:00:00.000Z",
          last_progress_at: "2026-07-15T12:00:00.000Z"
        },
        filters: []
      },
      {
        table: "session_logs",
        operation: "insert",
        value: {
          athlete_id: "athlete-1",
          run_id: "run-1",
          body: "felt good",
          rpe: 7,
          pump: 5,
          pain: 1,
          energy: 8
        },
        filters: []
      }
    ]);
    expect(fake.getUser).toHaveBeenCalledTimes(4);
  });

  it("uses the athlete-scoped unique key to make questionnaire retries safe", async () => {
    const fake = createFakeClient();
    const repository = createCloudRepository(fake.client);
    const input = { version: 2, answers: { goal: "boulder" }, idempotencyKey: "questionnaire-1" };

    await repository.submitQuestionnaire(input);
    await repository.submitQuestionnaire(input);

    expect(fake.calls).toEqual([
      {
        table: "questionnaire_submissions",
        operation: "upsert",
        value: {
          athlete_id: "athlete-1",
          answers: { goal: "boulder" },
          idempotency_key: "questionnaire-1",
          source: { version: 2 }
        },
        options: { onConflict: "athlete_id,idempotency_key", ignoreDuplicates: true },
        filters: []
      },
      {
        table: "questionnaire_submissions",
        operation: "upsert",
        value: {
          athlete_id: "athlete-1",
          answers: { goal: "boulder" },
          idempotency_key: "questionnaire-1",
          source: { version: 2 }
        },
        options: { onConflict: "athlete_id,idempotency_key", ignoreDuplicates: true },
        filters: []
      }
    ]);
  });

  it("loads the active plan through RLS without accepting an athlete ID", async () => {
    const fake = createFakeClient();
    const repository = createCloudRepository(fake.client);

    await repository.listActivePlan();

    expect(fake.calls).toEqual([
      {
        table: "training_plans",
        operation: "select",
        filters: [["status", "active"]]
      }
    ]);
  });

  it("requests generation without sending an athlete identity", async () => {
    const fake = createFakeClient();
    const repository = createCloudRepository(fake.client);

    await expect(repository.generatePlan({ questionnaireId: "questionnaire-1", idempotencyKey: "generation-1" }))
      .resolves.toEqual({ jobId: "job-1", status: "provider_not_configured" });

    expect(fake.invoke).toHaveBeenCalledWith("generate-plan", { body: { questionnaireId: "questionnaire-1", idempotencyKey: "generation-1" } });
  });

  it("returns stable application errors without provider details", async () => {
    const fake = createFakeClient();
    fake.rpc.mockResolvedValue({ data: null, error: { message: "raw SQL details", code: "42501" } });
    const repository = createCloudRepository(fake.client);

    await expect(repository.ensureProfile()).rejects.toEqual({ code: "unavailable" });
  });

  it("rejects unauthenticated writes before calling the database", async () => {
    const fake = createFakeClient();
    fake.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const repository = createCloudRepository(fake.client);

    await expect(repository.ensureProfile()).rejects.toEqual({ code: "unauthenticated" });
    await expect(repository.submitQuestionnaire({ version: 2, answers: {}, idempotencyKey: "questionnaire-1" }))
      .rejects.toEqual({ code: "unauthenticated" });
    await expect(repository.startSessionRun({ planId: "plan-1", planSessionId: "session-1" }))
      .rejects.toEqual({ code: "unauthenticated" });

    expect(fake.rpc).not.toHaveBeenCalled();
    expect(fake.calls).toEqual([]);
  });
});
