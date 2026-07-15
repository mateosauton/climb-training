export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type QuestionnaireSubmissionInput = {
  version: number;
  answers: Record<string, JsonValue>;
  idempotencyKey: string;
};

export type SessionRunInput = {
  planSessionId: string;
};

export type SessionLogInput = {
  runId: string;
  metrics: Record<string, JsonValue>;
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
