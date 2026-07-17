import type { GuidedSessionState } from "../guided-session/guided-session-types";
import type { SessionLog, TrackerState, VideoAnalysis } from "../../lib/training";

export type UserFactCategory =
  | "identity"
  | "goal"
  | "climbing"
  | "capacity"
  | "health"
  | "recovery"
  | "availability"
  | "equipment"
  | "preference"
  | "coaching";

export type UserFactValue = string | number | boolean | string[] | null;

export type UserFactSource = {
  type: "migration" | "profile-form" | "questionnaire" | "import";
  field: string;
  version: number;
};

export type UserFact = {
  id: string;
  userId: string;
  category: UserFactCategory;
  key: string;
  value: UserFactValue;
  unit: string | null;
  recordedAt: string;
  source: UserFactSource;
  supersedes: string | null;
};

export type UserAuthIdentity = {
  provider: "supabase";
  subject: string;
  email: string | null;
};

export type UserIdentity = {
  id: string;
  displayName: string;
  createdAt: string;
  updatedAt: string;
  auth: UserAuthIdentity | null;
};

export type UserRecord = {
  identity: UserIdentity;
  facts: UserFact[];
  sessionLogs: SessionLog[];
  videoAnalyses: VideoAnalysis[];
  guidedSessions: GuidedSessionState;
};

export type UserDataEnvelope = {
  schemaVersion: 3;
  activeUserId: string;
  users: Record<string, UserRecord>;
  migration: {
    migratedFrom: "climb4w.state.v1" | "climb4w.users.v2" | null;
    migratedAt: string | null;
  };
};

export type UserFieldDefinition = {
  category: UserFactCategory;
  unit: string | null;
  destination: "profile" | "goals";
  key: keyof TrackerState["goals"] | keyof TrackerState["profile"];
};

export type UserDataLoadResult = {
  envelope: UserDataEnvelope;
  warning: string | null;
  migrated: boolean;
  /** A pre-existing valid local envelope is available for cloud recovery/import. */
  hasRecoveryEnvelope: boolean;
  canPersist: boolean;
};
