import { describe, expect, it } from "vitest";
import { defaultState } from "../../lib/training";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import { buildSessionLogsCsv, buildUserDataExport, sessionLogsCsvFilename, userDataExportFilename } from "./user-data-export";
import { migrateLegacyUserData } from "./user-data-migration";

const exportedAt = "2026-07-14T20:30:00.000Z";

describe("user data export", () => {
  it("produces deterministic two-space JSON with all history and app metadata", () => {
    let index = 0;
    const envelope = migrateLegacyUserData({ tracker: defaultState, guided: emptyGuidedSessionState(), now: exportedAt, makeId: () => `user:${++index}` });
    envelope.users[envelope.activeUserId].videoAnalyses.push({ id: "video", sessionId: "w1d1", createdAt: exportedAt, fileName: "move.mp4", duration: 10, size: 100, notes: "", footCuts: 0, swing: 0, hips: 0, shoulder: 0, breath: 0, reading: 0, advice: [{ title: "Cadera", body: "Acercala al muro." }] });
    const first = buildUserDataExport(envelope, exportedAt);
    expect(buildUserDataExport(envelope, exportedAt)).toBe(first);
    expect(first).toContain('\n  "schemaVersion": 3,');
    expect(JSON.parse(first)).toEqual({ ...envelope, app: { name: "Maillon", exportedAt, planVersion: "2026-07-09/2026-08-05" } });
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
    expect(userDataExportFilename(envelope, exportedAt)).toBe("maillon-user-user-1-2026-07-14.json");
    expect(sessionLogsCsvFilename(envelope, exportedAt)).toBe("maillon-user-user-1-2026-07-14.csv");
  });
});

describe("session log CSV export", () => {
  it("writes the logger and KPI columns for the active history, oldest first", () => {
    const csv = buildSessionLogsCsv([
      {
        id: "later",
        sessionId: "plan-session-2",
        createdAt: "2026-11-03T18:04:00.000Z",
        notes: 'crux, "duro"',
        rpe: 8,
        pump: 6,
        pain: 1,
        attempts: 4,
        moves: 12,
        bestLink: 9,
        footCuts: 2,
        pullWeight: 12,
        sleep: 7.5,
        energy: 6
      },
      {
        id: "earlier",
        sessionId: "plan-session-1",
        createdAt: "2026-10-27T12:00:00.000Z",
        notes: "line\n2",
        rpe: 7,
        pump: 5,
        pain: 0,
        attempts: 3,
        moves: 8,
        bestLink: 5,
        footCuts: 4,
        pullWeight: 0,
        sleep: 8,
        energy: 7
      }
    ]);

    expect(csv).toBe([
      "date,session_id,rpe,pain,best_link,foot_cuts,attempts,moves,pump,energy,sleep,notes",
      "2026-10-27,plan-session-1,7,0,5,4,3,8,5,7,8,\"line\n2\"",
      "2026-11-03,plan-session-2,8,1,9,2,4,12,6,6,7.5,\"crux, \"\"duro\"\"\""
    ].join("\n") + "\n");
    expect(csv).not.toContain("pullWeight");
    expect(csv).not.toContain("pull_weight");
  });

  it("keeps a header when there are no sessions and blanks missing metrics", () => {
    expect(buildSessionLogsCsv([])).toBe("date,session_id,rpe,pain,best_link,foot_cuts,attempts,moves,pump,energy,sleep,notes\n");
    const csv = buildSessionLogsCsv([{
      id: "partial",
      sessionId: "",
      createdAt: "2026-11-01T00:00:00.000Z",
      notes: "=suma",
      rpe: 6,
      pump: 0,
      pain: 0,
      attempts: undefined as unknown as number,
      moves: 0,
      bestLink: undefined as unknown as number,
      footCuts: 1,
      pullWeight: 0,
      sleep: 0,
      energy: 5
    }]);
    expect(csv).toContain("2026-11-01,,6,0,,1,,0,0,5,0,'=suma\n");
  });
});
