import { describe, expect, it } from "vitest";
import type { GuidedSessionDefinition, GuidedSessionState } from "./guided-session-types";
import { createGuidedRun, elapsedActiveSeconds, guidedSessionReducer, reconcileGuidedRun } from "./guided-session-reducer";

const definition: GuidedSessionDefinition = {
  sessionId: "w1d1",
  version: 1,
  objective: "Objetivo",
  safetyNote: "Seguridad",
  blocks: ["warmup", "work", "cooldown"].map((id) => ({
    id,
    phase: id === "work" ? "work" : id === "warmup" ? "prepare" : "cooldown",
    title: id,
    instruction: id,
    steps: [id],
    cues: [id],
    equipment: [],
    media: [],
    narrationText: id
  }))
};

const emptyState: GuidedSessionState = { schemaVersion: 1, activeRun: null, history: [] };

describe("guided session reducer", () => {
  it("creates a summary and starts it with injected time", () => {
    const created = guidedSessionReducer(emptyState, { type: "CREATE_RUN", sessionId: "w1d1", definition, now: "2026-07-14T10:00:00.000Z", id: "run-1" });
    expect(created.activeRun).toMatchObject({ id: "run-1", status: "summary", startedAt: null });

    const started = guidedSessionReducer(created, { type: "START", definition, now: "2026-07-14T10:01:00.000Z" });
    expect(started.activeRun).toMatchObject({ status: "active", startedAt: "2026-07-14T10:01:00.000Z", activeSegmentStartedAt: "2026-07-14T10:01:00.000Z" });
  });

  it("keeps complete and skipped blocks disjoint while navigation is independent", () => {
    let state = { ...emptyState, activeRun: createGuidedRun(definition, "2026-07-14T10:00:00.000Z", "run") };
    state = guidedSessionReducer(state, { type: "START", definition, now: "2026-07-14T10:00:00.000Z" });
    state = guidedSessionReducer(state, { type: "COMPLETE_BLOCK", blockId: "warmup", definition, now: "2026-07-14T10:01:00.000Z" });
    state = guidedSessionReducer(state, { type: "SKIP_BLOCK", blockId: "warmup", definition, now: "2026-07-14T10:02:00.000Z" });
    state = guidedSessionReducer(state, { type: "GO_TO_BLOCK", index: 99, definition, now: "2026-07-14T10:03:00.000Z" });

    expect(state.activeRun?.completedBlockIds).toEqual([]);
    expect(state.activeRun?.skippedBlockIds).toEqual(["warmup"]);
    expect(state.activeRun?.currentBlockIndex).toBe(2);
    expect(state.activeRun?.completedBlockIds).not.toContain("cooldown");
  });

  it("rejects early completion and completes when every block is resolved", () => {
    let state: GuidedSessionState = { ...emptyState, activeRun: { ...createGuidedRun(definition, "2026-07-14T10:00:00.000Z", "run"), status: "active" as const, startedAt: "2026-07-14T10:00:00.000Z", activeSegmentStartedAt: "2026-07-14T10:00:00.000Z" } };
    expect(guidedSessionReducer(state, { type: "COMPLETE_RUN", definition, now: "2026-07-14T10:01:00.000Z" })).toEqual(state);

    for (const [index, block] of definition.blocks.entries()) {
      state = guidedSessionReducer(state, { type: index === 1 ? "SKIP_BLOCK" : "COMPLETE_BLOCK", blockId: block.id, definition, now: `2026-07-14T10:0${index + 1}:00.000Z` });
    }

    expect(state.activeRun).toMatchObject({ status: "completed", completedAt: "2026-07-14T10:03:00.000Z" });
  });

  it("accumulates only active segments across pause and resume", () => {
    let state: GuidedSessionState = { ...emptyState, activeRun: { ...createGuidedRun(definition, "2026-07-14T10:00:00.000Z", "run"), status: "active" as const, startedAt: "2026-07-14T10:00:00.000Z", activeSegmentStartedAt: "2026-07-14T10:00:00.000Z" } };
    state = guidedSessionReducer(state, { type: "PAUSE", now: "2026-07-14T10:02:00.000Z" });
    expect(state.activeRun?.accumulatedActiveSeconds).toBe(120);
    expect(elapsedActiveSeconds(state.activeRun!, "2026-07-14T11:00:00.000Z")).toBe(120);

    state = guidedSessionReducer(state, { type: "RESUME", definition, now: "2026-07-14T11:00:00.000Z" });
    expect(elapsedActiveSeconds(state.activeRun!, "2026-07-14T11:00:30.000Z")).toBe(150);
  });

  it("reconciles stable ids, version changes, and restored active runs", () => {
    const updated = { ...definition, version: 2, blocks: [definition.blocks[1], definition.blocks[2]] };
    const run = {
      ...createGuidedRun(definition, "2026-07-14T10:00:00.000Z", "run"),
      status: "active" as const,
      completedBlockIds: ["warmup", "work", "removed"],
      skippedBlockIds: ["cooldown"],
      currentBlockIndex: 10,
      activeSegmentStartedAt: "2026-07-14T10:00:00.000Z"
    };

    const restored = reconcileGuidedRun(run, updated, "2026-07-14T12:00:00.000Z", true);
    expect(restored).toMatchObject({ status: "paused", definitionVersion: 2, currentBlockIndex: 0, completedBlockIds: ["work"], skippedBlockIds: ["cooldown"], activeSegmentStartedAt: null });
    expect(restored.accumulatedActiveSeconds).toBe(0);
  });

  it("restarts and discards explicitly", () => {
    const initial = { ...emptyState, activeRun: createGuidedRun(definition, "2026-07-14T10:00:00.000Z", "first") };
    const restarted = guidedSessionReducer(initial, { type: "RESTART", sessionId: "w1d1", definition, now: "2026-07-14T11:00:00.000Z", id: "second" });
    expect(restarted.activeRun?.id).toBe("second");
    expect(restarted.history).toHaveLength(1);
    expect(guidedSessionReducer(restarted, { type: "DISCARD", now: "2026-07-14T12:00:00.000Z" }).activeRun).toBeNull();
  });
});
