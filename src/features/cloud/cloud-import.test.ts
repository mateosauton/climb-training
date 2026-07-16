import { beforeEach, describe, expect, it, vi } from "vitest";

import { defaultState } from "../../lib/training";
import { emptyGuidedSessionState } from "../guided-session/guided-session-storage";
import { migrateLegacyUserData } from "../user-data/user-data-migration";
import { CLOUD_IMPORT_STATUS_STORAGE_KEY } from "../user-data/user-data-storage";
import {
  canonicalizeLocalImport,
  createCloudImport,
  type CloudImportClient
} from "./cloud-import";

const exportedAt = "2026-07-15T12:00:00.000Z";

function envelope() {
  let index = 0;
  return migrateLegacyUserData({
    tracker: defaultState,
    guided: emptyGuidedSessionState(),
    now: exportedAt,
    makeId: () => `local-${++index}`
  });
}

function client(result: { data: { status: "metadata_imported" | "completed"; receiptId: string; pendingVideoIds: string[] } | null; error: unknown | null } = { data: { status: "completed", receiptId: "receipt-1", pendingVideoIds: [] }, error: null }) {
  const invoke = vi.fn().mockResolvedValue(result);
  return { invoke, client: { functions: { invoke } } as unknown as CloudImportClient };
}

describe("cloud import", () => {
  beforeEach(() => localStorage.clear());

  it("canonicalizes schema-3 payloads to the same SHA-256 hash regardless of key order", async () => {
    const first = envelope();
    const second = JSON.parse(JSON.stringify(first));
    second.users = Object.fromEntries(Object.entries(second.users).reverse());
    second.migration = { migratedAt: second.migration.migratedAt, migratedFrom: second.migration.migratedFrom };

    await expect(canonicalizeLocalImport(first)).resolves.toEqual(await canonicalizeLocalImport(second));
  });

  it("returns a completed receipt without sending another import request", async () => {
    const fixture = envelope();
    const canonical = await canonicalizeLocalImport(fixture);
    localStorage.setItem(CLOUD_IMPORT_STATUS_STORAGE_KEY, JSON.stringify({ payloadHash: canonical.payloadHash, receiptId: "receipt-1", completedAt: exportedAt }));
    const fake = client();

    await expect(createCloudImport(fake.client, localStorage).import(fixture)).resolves.toEqual({ status: "completed", receiptId: "receipt-1", pendingVideoIds: [] });
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it.each([
    ["malformed", { schemaVersion: 3 }],
    ["unsupported", { ...envelope(), schemaVersion: 2 }],
    ["mismatched user", (() => { const value = envelope(); value.users[value.activeUserId].identity.auth = { provider: "supabase", subject: "another-athlete", email: null }; return value; })()]
  ])("rejects %s payloads before invoking import", async (_name, value) => {
    const fake = client();
    const importer = createCloudImport(fake.client, localStorage, () => "athlete-1");

    await expect(importer.import(value)).rejects.toEqual({ code: "invalid_import" });
    expect(fake.invoke).not.toHaveBeenCalled();
  });

  it("preserves recovery data and records completion only after verified completion", async () => {
    const fixture = envelope();
    const fake = client({ data: { status: "metadata_imported", receiptId: "receipt-1", pendingVideoIds: ["video-1"] }, error: null });
    localStorage.setItem("climb4w.state.v1", "recovery-data");

    await expect(createCloudImport(fake.client, localStorage).import(fixture)).resolves.toEqual({ status: "metadata_imported", receiptId: "receipt-1", pendingVideoIds: ["video-1"] });
    expect(localStorage.getItem(CLOUD_IMPORT_STATUS_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem("climb4w.state.v1")).toBe("recovery-data");
  });
});
