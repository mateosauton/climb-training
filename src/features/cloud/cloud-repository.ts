import type {
  ActivePlan,
  CloudRepositoryError,
  JsonValue,
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
  from(table: "questionnaire_submissions" | "session_runs" | "session_logs"): {
    insert(values: Record<string, JsonValue>): PromiseLike<CloudResult<unknown>>;
  };
  from(table: "training_plans"): {
    select(columns: string): CloudSelectQuery;
  };
}

export type CloudRepository = {
  ensureProfile(): Promise<void>;
  submitQuestionnaire(input: QuestionnaireSubmissionInput): Promise<void>;
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
      await requireSuccess(client.from("questionnaire_submissions").insert({
        athlete_id: id,
        answers,
        source: { version, idempotency_key: idempotencyKey }
      }));
    },
    async listActivePlan() {
      const { data, error } = await client.from("training_plans").select("*").eq("status", "active").maybeSingle();
      if (error) throw failure("unavailable");
      return data;
    },
    async startSessionRun({ planSessionId }) {
      const id = await athleteId(client);
      const timestamp = now();
      await requireSuccess(client.from("session_runs").insert({
        athlete_id: id,
        plan_session_id: planSessionId,
        status: "started",
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
