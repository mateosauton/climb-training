export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type QuestionnaireSubmissionInput = {
  id: string;
  version: number;
  answers: Record<string, JsonValue>;
  idempotencyKey: string;
};

export type PlanGenerationInput = {
  questionnaireId: string;
  idempotencyKey: string;
};

export type PlanGenerationJob = {
  jobId: string;
  status: "published" | "rejected" | "failed" | "provider_not_configured";
};

export type SessionRunInput = {
  planId: string;
  planSessionId: string;
};

export type SessionLogInput = {
  runId?: string;
  sessionId?: string;
  planSessionId?: string;
  idempotencyKey?: string;
  metrics: SessionLogMetrics & Record<string, JsonValue | undefined>;
};

export type CloudHydration = {
  facts: Record<string, JsonValue>[];
  sessionLogs: Record<string, JsonValue>[];
  guided: JsonValue;
  activePlan: ActivePlan | null;
  currentProfile?: CurrentAthleteProfileFact[];
  profile?: CloudProfile;
};

export type CurrentAthleteProfileFact = {
  fact_key: string;
  fact_id: string;
  value: JsonValue;
  source: JsonValue;
  recorded_at: string;
};

export type CloudProfile = {
  avatarPath: string | null;
};

export type FactWrite = {
  id: string;
  key: string;
  value: JsonValue;
  source: JsonValue;
  supersedes: string | null;
  recordedAt: string;
};

export type SessionLogMetrics = {
  rpe?: number;
  pump?: number;
  pain?: number;
  energy?: number;
  notes?: string;
};

export type ActivePlanExercise = {
  id: string;
  position: number;
  exercise_id: string;
  exercise_content_version: number;
  sets: number | null;
  reps: number | null;
  duration_seconds: number | null;
};

export type ActivePlanBlock = {
  id: string;
  position: number;
  phase: string;
  title: string;
  instructions: string;
  duration_minutes: number;
  exercises: ActivePlanExercise[];
};

export type ActivePlanSession = {
  id: string;
  position: number;
  blocks: ActivePlanBlock[];
};

export type ActivePlan = {
  id: string;
  version_number: number;
  rationale: string;
  published_at: string;
  read_model_version?: number;
  status?: string;
  sessions?: ActivePlanSession[];
};

export type CloudRepositoryError = {
  code: "unauthenticated" | "unavailable";
};
