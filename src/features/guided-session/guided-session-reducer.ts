import type { GuidedRun, GuidedSessionDefinition, GuidedSessionEvent, GuidedSessionState } from "./guided-session-types";

function runId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `guided-${Date.now()}`;
}

function secondsBetween(start: string | null, end: string) {
  if (!start) return 0;
  const milliseconds = new Date(end).getTime() - new Date(start).getTime();
  return Number.isFinite(milliseconds) && milliseconds > 0 ? Math.floor(milliseconds / 1000) : 0;
}

export function elapsedActiveSeconds(run: GuidedRun, now: string) {
  return run.accumulatedActiveSeconds + (run.status === "active" ? secondsBetween(run.activeSegmentStartedAt, now) : 0);
}

export function createGuidedRun(definition: GuidedSessionDefinition, now: string, id: string = runId()): GuidedRun {
  return {
    id,
    schemaVersion: 1,
    definitionVersion: definition.version,
    sessionId: definition.sessionId,
    status: "summary",
    currentBlockIndex: 0,
    completedBlockIds: [],
    skippedBlockIds: [],
    startedAt: null,
    completedAt: null,
    activeSegmentStartedAt: null,
    accumulatedActiveSeconds: 0,
    updatedAt: now
  };
}

function clampIndex(index: number, definition: GuidedSessionDefinition) {
  return Math.max(0, Math.min(Math.trunc(index), Math.max(0, definition.blocks.length - 1)));
}

function firstUnresolvedIndex(run: GuidedRun, definition: GuidedSessionDefinition) {
  const resolved = new Set([...run.completedBlockIds, ...run.skippedBlockIds]);
  const index = definition.blocks.findIndex(({ id }) => !resolved.has(id));
  return index === -1 ? 0 : index;
}

function resolveBlock(run: GuidedRun, definition: GuidedSessionDefinition, blockId: string, resolution: "completed" | "skipped", now: string): GuidedRun {
  if (!definition.blocks.some(({ id }) => id === blockId)) return run;
  const completedBlockIds = run.completedBlockIds.filter((id) => id !== blockId);
  const skippedBlockIds = run.skippedBlockIds.filter((id) => id !== blockId);
  (resolution === "completed" ? completedBlockIds : skippedBlockIds).push(blockId);

  const next = { ...run, completedBlockIds, skippedBlockIds, updatedAt: now };
  const resolved = new Set([...completedBlockIds, ...skippedBlockIds]);
  const allResolved = definition.blocks.every(({ id }) => resolved.has(id));
  if (allResolved) {
    return {
      ...next,
      status: "completed",
      completedAt: now,
      accumulatedActiveSeconds: elapsedActiveSeconds(next, now),
      activeSegmentStartedAt: null
    };
  }

  const current = definition.blocks[run.currentBlockIndex]?.id;
  if (current === blockId) {
    const forward = definition.blocks.findIndex(({ id }, index) => index > run.currentBlockIndex && !resolved.has(id));
    next.currentBlockIndex = forward === -1 ? firstUnresolvedIndex(next, definition) : forward;
  }
  return next;
}

export function reconcileGuidedRun(run: GuidedRun, definition: GuidedSessionDefinition, now: string, restoring = false): GuidedRun {
  const validIds = new Set(definition.blocks.map(({ id }) => id));
  const completedBlockIds = run.completedBlockIds.filter((id) => validIds.has(id));
  const skippedBlockIds = run.skippedBlockIds.filter((id) => validIds.has(id) && !completedBlockIds.includes(id));
  let reconciled: GuidedRun = {
    ...run,
    definitionVersion: definition.version,
    completedBlockIds,
    skippedBlockIds,
    currentBlockIndex: clampIndex(run.currentBlockIndex, definition),
    updatedAt: now
  };

  if (run.definitionVersion !== definition.version) {
    reconciled.currentBlockIndex = firstUnresolvedIndex(reconciled, definition);
  }
  if (restoring && run.status === "active") {
    reconciled = { ...reconciled, status: "paused", activeSegmentStartedAt: null };
  }
  return reconciled;
}

export function guidedSessionReducer(state: GuidedSessionState, event: GuidedSessionEvent): GuidedSessionState {
  const run = state.activeRun;

  switch (event.type) {
    case "CREATE_RUN": {
      const history = run ? [...state.history, run] : state.history;
      return { ...state, history, activeRun: createGuidedRun(event.definition, event.now, event.id) };
    }
    case "RESTART": {
      const history = run ? [...state.history, run] : state.history;
      return { ...state, history, activeRun: createGuidedRun(event.definition, event.now, event.id) };
    }
    case "START":
      if (!run || run.status !== "summary") return state;
      return { ...state, activeRun: { ...run, status: "active", startedAt: event.now, activeSegmentStartedAt: event.now, updatedAt: event.now } };
    case "COMPLETE_BLOCK":
      if (!run || run.status !== "active") return state;
      return { ...state, activeRun: resolveBlock(run, event.definition, event.blockId, "completed", event.now) };
    case "SKIP_BLOCK":
      if (!run || run.status !== "active") return state;
      return { ...state, activeRun: resolveBlock(run, event.definition, event.blockId, "skipped", event.now) };
    case "GO_TO_BLOCK":
      if (!run) return state;
      return { ...state, activeRun: { ...run, currentBlockIndex: clampIndex(event.index, event.definition), updatedAt: event.now } };
    case "PAUSE":
      if (!run || run.status !== "active") return state;
      return {
        ...state,
        activeRun: {
          ...run,
          status: "paused",
          accumulatedActiveSeconds: elapsedActiveSeconds(run, event.now),
          activeSegmentStartedAt: null,
          updatedAt: event.now
        }
      };
    case "RESUME":
      if (!run || run.status !== "paused") return state;
      return {
        ...state,
        activeRun: {
          ...reconcileGuidedRun(run, event.definition, event.now),
          status: "active",
          currentBlockIndex: firstUnresolvedIndex(run, event.definition),
          activeSegmentStartedAt: event.now,
          updatedAt: event.now
        }
      };
    case "COMPLETE_RUN": {
      if (!run || run.status !== "active") return state;
      const resolved = new Set([...run.completedBlockIds, ...run.skippedBlockIds]);
      if (!event.definition.blocks.every(({ id }) => resolved.has(id))) return state;
      return {
        ...state,
        activeRun: {
          ...run,
          status: "completed",
          completedAt: event.now,
          accumulatedActiveSeconds: elapsedActiveSeconds(run, event.now),
          activeSegmentStartedAt: null,
          updatedAt: event.now
        }
      };
    }
    case "DISCARD":
      return run ? { ...state, activeRun: null } : state;
    case "RESTORE": {
      if (!run) return state;
      const definition = event.definitions[run.sessionId];
      return definition ? { ...state, activeRun: reconcileGuidedRun(run, definition, event.now, true) } : { ...state, activeRun: null };
    }
  }
}
