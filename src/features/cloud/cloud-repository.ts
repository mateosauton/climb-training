import type {
  ActivePlan,
  CloudHydration,
  CloudRepositoryError,
  FactWrite,
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
  rpc(name: "ensure_athlete_profile" | "hydrate_athlete_state"): PromiseLike<CloudResult<unknown>>;
  functions?: {
    invoke(name: "generate-plan", options: { body: PlanGenerationInput }): PromiseLike<CloudResult<PlanGenerationJob>>;
  };
  from(table: "questionnaire_submissions" | "session_runs" | "session_logs" | "athlete_facts" | "athlete_guided_states" | "athlete_profiles"): {
    insert(values: Record<string, JsonValue>): PromiseLike<CloudResult<unknown>>;
    upsert(
      values: Record<string, JsonValue>,
      options: { onConflict: "athlete_id,idempotency_key" | "id" | "athlete_id"; ignoreDuplicates: boolean }
    ): PromiseLike<CloudResult<unknown>>;
    update(values: Record<string, JsonValue>): {
      eq(column: string, value: JsonValue): PromiseLike<CloudResult<unknown>>;
    };
  };
  from(table: "training_plans"): {
    select(columns: string): CloudSelectQuery;
  };
}

export type CloudRepository = {
  ensureProfile(): Promise<void>;
  hydrate(): Promise<CloudHydration>;
  saveAvatarPath?(path: string): Promise<void>;
  submitQuestionnaire(input: QuestionnaireSubmissionInput): Promise<void>;
  appendFacts(facts: FactWrite[]): Promise<void>;
  saveGuidedState(state: JsonValue, idempotencyKey: string): Promise<void>;
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
    async hydrate() {
      await athleteId(client);
      const { data, error } = await client.rpc("hydrate_athlete_state");
      if (error || !data || typeof data !== "object") throw failure("unavailable");
      const snapshot = data as CloudHydration;
      const rawProfile = snapshot.profile as (typeof snapshot.profile & { avatar_path?: unknown }) | undefined;
      return {
        facts: Array.isArray(snapshot.facts) ? snapshot.facts : [],
        sessionLogs: Array.isArray(snapshot.sessionLogs) ? snapshot.sessionLogs : [],
        guided: snapshot.guided ?? { schemaVersion: 1, activeRun: null, history: [] },
        activePlan: snapshot.activePlan ?? null,
        profile: {
          avatarPath: typeof rawProfile?.avatar_path === "string"
            ? rawProfile.avatar_path
            : snapshot.profile?.avatarPath ?? null
        }
      };
    },
    async saveAvatarPath(path) {
      const id = await athleteId(client);
      await requireSuccess(client.from("athlete_profiles").update({ avatar_path: path }).eq("id", id));
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
    async appendFacts(facts) {
      if (!facts.length) return;
      const id = await athleteId(client);
      await requireSuccess(client.from("athlete_facts").upsert(facts.map((fact) => ({
        id: fact.id,
        athlete_id: id,
        fact_key: fact.key,
        value: fact.value,
        source: fact.source,
        supersedes_id: fact.supersedes,
        created_at: fact.recordedAt
      })) as unknown as Record<string, JsonValue>, { onConflict: "id", ignoreDuplicates: true }));
    },
    async saveGuidedState(state, idempotencyKey) {
      const id = await athleteId(client);
      await requireSuccess(client.from("athlete_guided_states").upsert({
        athlete_id: id, state, idempotency_key: idempotencyKey
      }, { onConflict: "athlete_id", ignoreDuplicates: false }));
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
    async appendSessionLog({ runId, sessionId, idempotencyKey, metrics }) {
      const id = await athleteId(client);
      const { rpe, pump, pain, energy, notes } = metrics;
      const values = {
        athlete_id: id,
        ...(runId === undefined ? {} : { run_id: runId }),
        ...(sessionId === undefined ? {} : { metrics: { ...metrics, sessionId } }),
        ...(idempotencyKey === undefined ? {} : { idempotency_key: idempotencyKey }),
        ...(notes === undefined ? {} : { body: notes }),
        ...(rpe === undefined ? {} : { rpe }),
        ...(pump === undefined ? {} : { pump }),
        ...(pain === undefined ? {} : { pain }),
        ...(energy === undefined ? {} : { energy })
      };
      await requireSuccess(idempotencyKey === undefined
        ? client.from("session_logs").insert(values)
        : client.from("session_logs").upsert(values, { onConflict: "athlete_id,idempotency_key", ignoreDuplicates: true }));
    }
  };
}
