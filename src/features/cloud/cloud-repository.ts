import type {
  ActivePlan,
  CloudRepositoryError,
  JsonValue,
  PlanGenerationInput,
  PlanGenerationJob,
  QuestionnaireSubmissionInput,
  SessionLogInput,
  SessionRunInput
} from "./cloud-types";

type CloudResult<T> = {
  data: T;
  error: unknown | null;
};

type CloudSelectQuery = {
  eq(column: string, value: JsonValue): CloudSelectQuery;
  maybeSingle(): PromiseLike<CloudResult<ActivePlan | null>>;
};

export interface CloudQueryClient {
  auth: {
    getUser(): PromiseLike<CloudResult<{ user: { id: string } | null }>>;
  };
  rpc(name: "ensure_athlete_profile"): PromiseLike<CloudResult<unknown>>;
  functions?: {
    invoke(name: "generate-plan", options: { body: PlanGenerationInput }): PromiseLike<CloudResult<PlanGenerationJob>>;
  };
  from(table: "questionnaire_submissions" | "session_runs" | "session_logs"): {
    insert(values: Record<string, JsonValue>): PromiseLike<CloudResult<unknown>>;
    upsert(
      values: Record<string, JsonValue>,
      options: { onConflict: "athlete_id,idempotency_key"; ignoreDuplicates: true }
    ): PromiseLike<CloudResult<unknown>>;
  };
  from(table: "training_plans"): {
    select(columns: string): CloudSelectQuery;
  };
}

export type CloudRepository = {
  ensureProfile(): Promise<void>;
  submitQuestionnaire(input: QuestionnaireSubmissionInput): Promise<void>;
  generatePlan?(input: PlanGenerationInput): Promise<PlanGenerationJob>;
  listActivePlan(): Promise<ActivePlan | null>;
  startSessionRun(input: SessionRunInput): Promise<void>;
  appendSessionLog(input: SessionLogInput): Promise<void>;
};

function failure(code: CloudRepositoryError["code"]): CloudRepositoryError {
  return { code };
}

async function athleteId(client: CloudQueryClient): Promise<string> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw failure("unauthenticated");
  return data.user.id;
}

async function requireSuccess(result: PromiseLike<CloudResult<unknown>>): Promise<void> {
  const { error } = await result;
  if (error) throw failure("unavailable");
}

export function createCloudRepository(client: CloudQueryClient, now = () => new Date().toISOString()): CloudRepository {
  return {
    async ensureProfile() {
      await athleteId(client);
      await requireSuccess(client.rpc("ensure_athlete_profile"));
    },
    async submitQuestionnaire({ version, answers, idempotencyKey }) {
      const id = await athleteId(client);
      await requireSuccess(client.from("questionnaire_submissions").upsert({
        athlete_id: id,
        answers,
        idempotency_key: idempotencyKey,
        source: { version }
      }, {
        onConflict: "athlete_id,idempotency_key",
        ignoreDuplicates: true
      }));
    },
    async generatePlan(input) {
      await athleteId(client);
      if (!client.functions) throw failure("unavailable");
      const { data, error } = await client.functions.invoke("generate-plan", { body: input });
      if (error || !data) throw failure("unavailable");
      return data;
    },
    async listActivePlan() {
      const { data, error } = await client.from("training_plans").select("*").eq("status", "active").maybeSingle();
      if (error) throw failure("unavailable");
      return data;
    },
    async startSessionRun({ planId, planSessionId }) {
      const id = await athleteId(client);
      const timestamp = now();
      await requireSuccess(client.from("session_runs").insert({
        athlete_id: id,
        plan_id: planId,
        plan_session_id: planSessionId,
        status: "in_progress",
        started_at: timestamp,
        last_progress_at: timestamp
      }));
    },
    async appendSessionLog({ runId, metrics }) {
      const id = await athleteId(client);
      const { rpe, pump, pain, energy, notes } = metrics;
      await requireSuccess(client.from("session_logs").insert({
        athlete_id: id,
        run_id: runId,
        ...(notes === undefined ? {} : { body: notes }),
        ...(rpe === undefined ? {} : { rpe }),
        ...(pump === undefined ? {} : { pump }),
        ...(pain === undefined ? {} : { pain }),
        ...(energy === undefined ? {} : { energy })
      }));
    }
  };
}
