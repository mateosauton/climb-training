import { describe, expect, it } from "vitest";
import { plan } from "@/lib/training";
import { guidedSessionDefinitions } from "./guided-session-data";

const validPhases = new Set(["prepare", "work", "rest", "cooldown", "review"]);

describe("guided session content", () => {
  it("authors exactly one non-empty guide for every plan session", () => {
    expect(Object.keys(guidedSessionDefinitions).sort()).toEqual(plan.map(({ id }) => id).sort());

    for (const session of plan) {
      const definition = guidedSessionDefinitions[session.id];
      expect(definition.sessionId).toBe(session.id);
      expect(definition.version).toBe(1);
      expect(definition.objective.trim()).not.toBe("");
      expect(definition.safetyNote.trim()).not.toBe("");
      expect(definition.blocks.length).toBeGreaterThan(0);
    }
  });

  it("uses unique stable block and media ids with complete instructions", () => {
    const allMediaIds = new Set<string>();

    for (const definition of Object.values(guidedSessionDefinitions)) {
      const blockIds = definition.blocks.map(({ id }) => id);
      expect(new Set(blockIds).size).toBe(blockIds.length);

      for (const block of definition.blocks) {
        expect(validPhases.has(block.phase)).toBe(true);
        expect(block.instruction.trim()).not.toBe("");
        expect(block.steps.length).toBeGreaterThan(0);
        expect(block.cues.length).toBeGreaterThan(0);
        expect(block.narrationText.trim()).not.toBe("");
        expect(Array.isArray(block.equipment)).toBe(true);

        if (block.phase === "work") {
          expect(block.dose?.trim()).not.toBe("");
          expect(block.avoid?.trim()).not.toBe("");
        }

        for (const media of block.media) {
          expect(allMediaIds.has(media.id)).toBe(false);
          allMediaIds.add(media.id);
          expect(media.url.startsWith("https://")).toBe(true);
          if (media.kind === "youtube") {
            expect(media.youtubeId).toMatch(/^[A-Za-z0-9_-]{11}$/);
          }
        }
      }
    }
  });
});
