export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type QuestionnaireSubmissionInput = {
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
  runId: string;
  metrics: SessionLogMetrics;
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
