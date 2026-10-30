import type {
  ActivePlan,
  CloudHydration,
  CloudRepositoryError,
  FactWrite,
  JsonValue,
  OpenSessionRun,
  PlanGenerationInput,
  PlanGenerationJob,
  QuestionnaireSubmissionInput,
  SessionBinding,
  SessionLogInput,
  SessionRunInput
} from "./cloud-types";
import { classifySessionLogError } from "./session-log-errors";

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
  rpc(
    name: "ensure_athlete_profile" | "hydrate_athlete_state" | "update_avatar_path",
    values?: Record<string, JsonValue>
  ): PromiseLike<CloudResult<unknown>>;
  functions?: {
    invoke(name: "generate-plan", options: { body: PlanGenerationInput }): PromiseLike<CloudResult<PlanGenerationJob>>;
  };
  from(table: "questionnaire_submissions" | "session_runs" | "session_logs" | "athlete_facts" | "athlete_guided_states"): {
    insert(values: Record<string, JsonValue>): PromiseLike<CloudResult<unknown>>;
    upsert(
      values: Record<string, JsonValue>,
      options: { onConflict: "athlete_id,idempotency_key" | "id" | "athlete_id"; ignoreDuplicates: boolean }
    ): PromiseLike<CloudResult<unknown>>;
  };
  from(table: "training_plans" | "training_plan_read_model"): {
    select(columns: string): CloudSelectQuery;
  };
}

export type CloudRepository = {
  ensureProfile(): Promise<void>;
  hydrate(): Promise<CloudHydration>;
  saveAvatarPath(path: string | null): Promise<void>;
  submitQuestionnaire(input: QuestionnaireSubmissionInput): Promise<string>;
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

function finiteNumber(value: JsonValue | undefined): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function firstNumber(metrics: SessionLogInput["metrics"], keys: string[]): number | undefined {
  for (const key of keys) {
    const value = finiteNumber(metrics[key]);
    if (value !== undefined) return value;
  }
  return undefined;
}

function sessionBindingColumns(
  input: SessionLogInput,
  legacyKey: string | undefined,
  alternate: string | undefined
): Record<string, JsonValue> {
  const binding: SessionBinding | undefined = input.sessionBinding;
  if (binding === "standalone") return { session_binding: "standalone" };
  if (binding === "plan" && input.planSessionId) {
    return {
      plan_session_id: input.planSessionId,
      session_binding: "plan",
      ...(alternate === undefined ? {} : { alternate_session_key: alternate })
    };
  }
  if (binding === "legacy" && legacyKey) return { legacy_session_key: legacyKey, session_binding: "legacy" };
  if (binding === undefined && input.planSessionId !== undefined) {
    return {
      plan_session_id: input.planSessionId,
      session_binding: "plan",
      ...(alternate === undefined ? {} : { alternate_session_key: alternate })
    };
  }
  if (binding === undefined && legacyKey !== undefined) return { legacy_session_key: legacyKey, session_binding: "legacy" };
  return {};
}

function readOpenSessionRun(value: unknown): OpenSessionRun | null {
  if (!value || typeof value !== "object") return null;
  const run = value as Partial<OpenSessionRun>;
  if (typeof run.id !== "string") return null;
  if (run.session_binding !== "plan" && run.session_binding !== "legacy" && run.session_binding !== "standalone") return null;
  return {
    id: run.id,
    plan_session_id: typeof run.plan_session_id === "string" ? run.plan_session_id : null,
    legacy_session_key: typeof run.legacy_session_key === "string" ? run.legacy_session_key : null,
    session_binding: run.session_binding,
    status: typeof run.status === "string" ? run.status : "in_progress"
  };
}

function sessionLogRecord(athlete: string, input: SessionLogInput): Record<string, JsonValue> {
  const metrics = { ...input.metrics };
  const attempts = firstNumber(metrics, ["attempts"]);
  const moves = firstNumber(metrics, ["moves"]);
  const bestLink = firstNumber(metrics, ["best_link", "bestLink"]);
  const footCuts = firstNumber(metrics, ["foot_cuts", "footCuts"]);
  const pullWeight = firstNumber(metrics, ["pull_weight", "pullWeight"]);
  const sleep = firstNumber(metrics, ["sleep"]);
  const conflicts: Record<string, JsonValue> = {};
  if (finiteNumber(metrics.best_link) !== undefined && finiteNumber(metrics.bestLink) !== undefined && metrics.best_link !== metrics.bestLink) {
    conflicts.bestLink = metrics.bestLink as number;
  }
  if (finiteNumber(metrics.foot_cuts) !== undefined && finiteNumber(metrics.footCuts) !== undefined && metrics.foot_cuts !== metrics.footCuts) {
    conflicts.footCuts = metrics.footCuts as number;
  }
  if (finiteNumber(metrics.pull_weight) !== undefined && finiteNumber(metrics.pullWeight) !== undefined && metrics.pull_weight !== metrics.pullWeight) {
    conflicts.pullWeight = metrics.pullWeight as number;
  }
  const rpe = finiteNumber(metrics.rpe);
  const pump = finiteNumber(metrics.pump);
  const pain = finiteNumber(metrics.pain);
  const energy = finiteNumber(metrics.energy);
  const notes = typeof metrics.notes === "string" ? metrics.notes : undefined;
  const metricSession = typeof metrics.sessionId === "string"
    ? metrics.sessionId
    : typeof metrics.session_id === "string" ? metrics.session_id : undefined;
  const legacyKey = input.sessionId ?? metricSession;
  const alternate = input.planSessionId && legacyKey && legacyKey !== input.planSessionId ? legacyKey : undefined;
  const binding = sessionBindingColumns(input, legacyKey, alternate);
  for (const key of ["attempts", "moves", "best_link", "bestLink", "foot_cuts", "footCuts", "pull_weight", "pullWeight", "sleep", "rpe", "pump", "pain", "energy", "notes", "sessionId", "session_id"]) {
    delete metrics[key];
  }
  const extras = Object.fromEntries(Object.entries(metrics).filter((entry): entry is [string, JsonValue] => entry[1] !== undefined));
  return {
    athlete_id: athlete,
    ...(input.runId === undefined ? {} : { run_id: input.runId }),
    ...binding,
    ...(input.idempotencyKey === undefined ? {} : { idempotency_key: input.idempotencyKey }),
    ...(notes === undefined ? {} : { body: notes }),
    ...(rpe === undefined ? {} : { rpe }),
    ...(pump === undefined ? {} : { pump }),
    ...(pain === undefined ? {} : { pain }),
    ...(energy === undefined ? {} : { energy }),
    ...(attempts === undefined ? {} : { attempts }),
    ...(moves === undefined ? {} : { moves }),
    ...(bestLink === undefined ? {} : { best_link: bestLink }),
    ...(footCuts === undefined ? {} : { foot_cuts: footCuts }),
    ...(pullWeight === undefined ? {} : { pull_weight: pullWeight }),
    ...(sleep === undefined ? {} : { sleep }),
    ...(Object.keys(extras).length === 0 ? {} : { metrics: extras }),
    ...(Object.keys(conflicts).length === 0 ? {} : { metric_conflicts: conflicts })
  };
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
        openSessionRun: readOpenSessionRun(snapshot.openSessionRun),
        currentProfile: Array.isArray(snapshot.currentProfile) ? snapshot.currentProfile : [],
        profile: {
          avatarPath: typeof rawProfile?.avatar_path === "string"
            ? rawProfile.avatar_path
            : snapshot.profile?.avatarPath ?? null
        }
      };
    },
    async saveAvatarPath(path) {
      await athleteId(client);
      await requireSuccess(client.rpc("update_avatar_path", { p_avatar_path: path }));
    },
    async submitQuestionnaire({ id: questionnaireId, version, answers, idempotencyKey }) {
      const id = await athleteId(client);
      await requireSuccess(client.from("questionnaire_submissions").upsert({
        id: questionnaireId,
        athlete_id: id,
        answers,
        idempotency_key: idempotencyKey,
        source: { version }
      }, {
        onConflict: "athlete_id,idempotency_key",
        ignoreDuplicates: true
      }));
      return questionnaireId;
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
      const { data, error } = await client.from("training_plan_read_model").select("*").eq("status", "active").maybeSingle();
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
    async appendSessionLog(input) {
      let id: string;
      try {
        id = await athleteId(client);
      } catch (error) {
        throw classifySessionLogError(error);
      }
      const values = sessionLogRecord(id, input);
      const result = await (input.idempotencyKey === undefined
        ? client.from("session_logs").insert(values)
        : client.from("session_logs").upsert(values, { onConflict: "athlete_id,idempotency_key", ignoreDuplicates: true }));
      if (!result.error) return;
      if (typeof result.error === "object" && result.error && (result.error as { code?: unknown }).code === "23505") return;
      throw classifySessionLogError(result.error);
    }
  };
}
