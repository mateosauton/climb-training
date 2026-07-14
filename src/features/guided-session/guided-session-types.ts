export type GuidedMedia = {
  id: string;
  kind: "youtube" | "external" | "internal";
  label: string;
  url: string;
  thumbnail?: string;
  youtubeId?: string;
  startSeconds?: number;
  endSeconds?: number;
};

export type GuidedBlockPhase = "prepare" | "work" | "rest" | "cooldown" | "review";

export type GuidedBlock = {
  id: string;
  phase: GuidedBlockPhase;
  title: string;
  instruction: string;
  steps: string[];
  dose?: string;
  estimatedMinutes?: number;
  rationale?: string;
  cues: string[];
  avoid?: string;
  equipment: string[];
  media: GuidedMedia[];
  narrationText: string;
};

export type GuidedSessionDefinition = {
  sessionId: string;
  version: number;
  objective: string;
  safetyNote: string;
  blocks: GuidedBlock[];
};

export type GuidedRunStatus = "summary" | "active" | "paused" | "completed";

export type GuidedRun = {
  id: string;
  schemaVersion: 1;
  definitionVersion: number;
  sessionId: string;
  status: GuidedRunStatus;
  currentBlockIndex: number;
  completedBlockIds: string[];
  skippedBlockIds: string[];
  startedAt: string | null;
  completedAt: string | null;
  activeSegmentStartedAt: string | null;
  accumulatedActiveSeconds: number;
  updatedAt: string;
};

export type GuidedSessionState = {
  schemaVersion: 1;
  activeRun: GuidedRun | null;
  history: GuidedRun[];
};

export type GuidedSessionEvent =
  | { type: "CREATE_RUN"; sessionId: string; definition: GuidedSessionDefinition; now: string; id?: string }
  | { type: "START"; definition: GuidedSessionDefinition; now: string }
  | { type: "COMPLETE_BLOCK"; blockId: string; definition: GuidedSessionDefinition; now: string }
  | { type: "SKIP_BLOCK"; blockId: string; definition: GuidedSessionDefinition; now: string }
  | { type: "GO_TO_BLOCK"; index: number; definition: GuidedSessionDefinition; now: string }
  | { type: "PAUSE"; now: string }
  | { type: "RESUME"; definition: GuidedSessionDefinition; now: string }
  | { type: "COMPLETE_RUN"; definition: GuidedSessionDefinition; now: string }
  | { type: "DISCARD"; now: string }
  | { type: "RESTART"; sessionId: string; definition: GuidedSessionDefinition; now: string; id?: string }
  | { type: "RESTORE"; definitions: Record<string, GuidedSessionDefinition>; now: string };
