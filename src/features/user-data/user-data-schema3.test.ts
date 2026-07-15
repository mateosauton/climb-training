import { describe, expect, it } from "vitest";

import { defaultState, type TrackerState } from "../../lib/training";
import { guidedSessionDefinitions } from "../guided-session/guided-session-data";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import {
  LEGACY_USER_DATA_STORAGE_KEY,
  USER_DATA_STORAGE_KEY,
  loadUserData
} from "./user-data-storage";
import { validateUserDataEnvelope } from "./user-data-validation";

const at = "2026-07-14T12:00:00.000Z";
const normalize = (value: unknown): TrackerState => ({ ...structuredClone(defaultState), ...(value as Partial<TrackerState>) });

function user(id: string, subject: string | null) {
  return {
    identity: {
      id,
      displayName: id,
      createdAt: at,
      updatedAt: at,
      auth: subject ? { provider: "apple", subject, email: `${id}@example.com` } : null
    },
    facts: [],
    sessionLogs: [],
    videoAnalyses: [],
    guidedSessions: emptyGuidedSessionState()
  };
}

function schema3() {
  return {
    schemaVersion: 3,
    activeUserId: "u1",
    users: { u1: user("u1", "apple-1"), u2: user("u2", null) },
    migration: { migratedFrom: "climb4w.users.v2", migratedAt: at }
  };
}

describe("user data schema 3", () => {
  it("accepts Apple and unbound identities", () => {
    const value = schema3();
    expect(validateUserDataEnvelope(value)).toEqual(value);
  });

  it("rejects malformed and duplicate Apple subjects", () => {
    const malformed: any = schema3();
    malformed.users.u1.identity.auth.provider = "google";
    expect(validateUserDataEnvelope(malformed)).toBeNull();

    const duplicate: any = schema3();
    duplicate.users.u2.identity.auth = { provider: "apple", subject: "apple-1", email: null };
    expect(validateUserDataEnvelope(duplicate)).toBeNull();
  });

  it("migrates v2 once without changing its recovery source", () => {
    const v2 = {
      schemaVersion: 2,
      activeUserId: "local-1",
      users: {
        "local-1": {
          identity: { id: "local-1", displayName: "Mateo", createdAt: at, updatedAt: at },
          facts: [], sessionLogs: [], videoAnalyses: [], guidedSessions: emptyGuidedSessionState()
        }
      },
      migration: { migratedFrom: null, migratedAt: null }
    };
    localStorage.setItem(LEGACY_USER_DATA_STORAGE_KEY, JSON.stringify(v2));

    const result = loadUserData(localStorage, {
      now: () => at,
      makeId: () => "new-id",
      normalizeLegacyTracker: normalize,
      guidedDefinitions: guidedSessionDefinitions
    });

    expect(result.envelope).toMatchObject({ schemaVersion: 3, migration: { migratedFrom: "climb4w.users.v2", migratedAt: at } });
    expect(result.envelope.users["local-1"].identity.auth).toBeNull();
    expect(JSON.parse(localStorage.getItem(USER_DATA_STORAGE_KEY)!)).toEqual(result.envelope);
    expect(JSON.parse(localStorage.getItem(LEGACY_USER_DATA_STORAGE_KEY)!)).toEqual(v2);
  });
});
