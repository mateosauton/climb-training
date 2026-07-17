import { describe, expect, it } from "vitest";

import { defaultState } from "../../lib/training";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import { migrateLegacyUserData } from "./user-data-migration";
import { validateLocalImportEnvelope } from "../../../supabase/functions/_shared/local-import-schema";

const now = "2026-07-15T12:00:00.000Z";

function envelope() {
  let index = 0;
  return migrateLegacyUserData({
    tracker: defaultState,
    guided: emptyGuidedSessionState(),
    now,
    makeId: () => `local-${++index}`
  });
}

describe("local import schema", () => {
  it("accepts optional cloud video metadata", () => {
    const value = envelope();
    value.users[value.activeUserId].videoAnalyses.push({
      id: "video-1", sessionId: "w1d1", createdAt: now, fileName: "clip.mp4", duration: 10, size: 100,
      notes: "", footCuts: 0, swing: 0, hips: 0, shoulder: 0, breath: 0, reading: 0, advice: [],
      cloud: { id: "video-1", path: "athlete/video-1/original.mp4", uploadStatus: "uploaded" }
    });

    expect(validateLocalImportEnvelope(value, "athlete-1")).toBe(true);
  });

  it.each([
    ["wrong fact category", (value: any) => { value.users[value.activeUserId].facts[0].category = "health"; }],
    ["wrong fact value", (value: any) => { value.users[value.activeUserId].facts[0].value = { invalid: true }; }],
    ["wrong fact source", (value: any) => { value.users[value.activeUserId].facts[0].source.type = "raw"; }],
    ["duplicate fact ID", (value: any) => { value.users[value.activeUserId].facts.push({ ...value.users[value.activeUserId].facts[0] }); }],
    ["broken supersedes", (value: any) => { value.users[value.activeUserId].facts[0].supersedes = "missing"; }]
  ])("rejects raw payload with %s before import", (_name, mutate) => {
    const value = envelope();
    mutate(value);

    expect(validateLocalImportEnvelope(value, "athlete-1")).toBe(false);
  });
});
