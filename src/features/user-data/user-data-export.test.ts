import { describe, expect, it } from "vitest";
import { defaultState } from "../../lib/training";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import { buildUserDataExport, userDataExportFilename } from "./user-data-export";
import { migrateLegacyUserData } from "./user-data-migration";

const exportedAt = "2026-07-14T20:30:00.000Z";

describe("user data export", () => {
  it("produces deterministic two-space JSON with all history and app metadata", () => {
    let index = 0;
    const envelope = migrateLegacyUserData({ tracker: defaultState, guided: emptyGuidedSessionState(), now: exportedAt, makeId: () => `user:${++index}` });
    envelope.users[envelope.activeUserId].videoAnalyses.push({ id: "video", sessionId: "w1d1", createdAt: exportedAt, fileName: "move.mp4", duration: 10, size: 100, notes: "", footCuts: 0, swing: 0, hips: 0, shoulder: 0, breath: 0, reading: 0, advice: [{ title: "Cadera", body: "Acercala al muro." }] });
    const first = buildUserDataExport(envelope, exportedAt);
    expect(buildUserDataExport(envelope, exportedAt)).toBe(first);
    expect(first).toContain('\n  "schemaVersion": 2,');
    expect(JSON.parse(first)).toEqual({ ...envelope, app: { name: "Escalada 4W Tracker", exportedAt, planVersion: "2026-07-09/2026-08-05" } });
    expect(JSON.parse(first).users[envelope.activeUserId].videoAnalyses[0].advice).toEqual([{ title: "Cadera", body: "Acercala al muro." }]);
  });

  it("excludes shared plans, binary values, and object URLs", () => {
    let index = 0;
    const envelope: any = migrateLegacyUserData({ tracker: defaultState, guided: emptyGuidedSessionState(), now: exportedAt, makeId: () => `id-${++index}` });
    envelope.plan = [{ secret: true }];
    envelope.users[envelope.activeUserId].videoAnalyses[0] = { id: "bad", blob: new Blob(), objectUrl: "blob:private" };
    const exported = buildUserDataExport(envelope, exportedAt);
    expect(exported).not.toContain('"plan"');
    expect(exported).not.toContain("blob:private");
    expect(exported).not.toContain('"blob"');
  });

  it("uses the active user and ISO date in the filename", () => {
    let index = 0;
    const envelope = migrateLegacyUserData({ tracker: defaultState, guided: emptyGuidedSessionState(), now: exportedAt, makeId: () => `user:${++index}` });
    expect(userDataExportFilename(envelope, exportedAt)).toBe("escalada-4w-user-user-1-2026-07-14.json");
  });
});
