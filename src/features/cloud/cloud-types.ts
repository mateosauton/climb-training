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
  idempotencyKey?: string;
  metrics: SessionLogMetrics & Record<string, JsonValue | undefined>;
};

export type CloudHydration = {
  facts: Record<string, JsonValue>[];
  sessionLogs: Record<string, JsonValue>[];
  guided: JsonValue;
  activePlan: ActivePlan | null;
  profile?: CloudProfile;
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

export type ActivePlan = {
  id: string;
  version_number: number;
  rationale: string;
  published_at: string;
};

export type CloudRepositoryError = {
  code: "unauthenticated" | "unavailable";
};
