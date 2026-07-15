import { buildLocalImportEnvelope } from "../user-data/user-data-export";
import type { UserDataEnvelope } from "../user-data/user-data-types";
import { validateUserDataEnvelope } from "../user-data/user-data-validation";
import { CLOUD_IMPORT_STATUS_STORAGE_KEY } from "../user-data/user-data-storage";

const SOURCE_SCHEMA = "local-schema-3";

type ImportResult = {
  status: "metadata_imported" | "completed";
  receiptId: string;
  pendingVideoIds: string[];
};

type ImportStatus = { payloadHash: string; receiptId: string; completedAt: string };

export interface CloudImportClient {
  functions: {
    invoke(name: "import-local-data", options: { body: unknown }): PromiseLike<{ data: ImportResult | null; error: unknown | null }>;
  };
}

export type CloudImport = { import(envelope: unknown, completedVideoIds?: string[]): Promise<ImportResult> };

function stableJson(value: unknown): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`;
  }
  throw new Error("non-json value");
}

async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function canonicalizeLocalImport(value: unknown): Promise<{ sourceSchema: string; payloadHash: string; envelope: UserDataEnvelope }> {
  const envelope = validateUserDataEnvelope(value);
  if (!envelope) throw { code: "invalid_import" };
  const clean = buildLocalImportEnvelope(envelope);
  return { sourceSchema: SOURCE_SCHEMA, payloadHash: await sha256(stableJson(clean)), envelope: clean };
}

function completedStatus(storage: Storage, payloadHash: string): ImportResult | null {
  try {
    const raw = storage.getItem(CLOUD_IMPORT_STATUS_STORAGE_KEY);
    if (!raw) return null;
    const status = JSON.parse(raw) as Partial<ImportStatus>;
    if (status.payloadHash !== payloadHash || typeof status.receiptId !== "string" || typeof status.completedAt !== "string") return null;
    return { status: "completed", receiptId: status.receiptId, pendingVideoIds: [] };
  } catch {
    return null;
  }
}

function saveCompletedStatus(storage: Storage, payloadHash: string, receiptId: string): void {
  storage.setItem(CLOUD_IMPORT_STATUS_STORAGE_KEY, JSON.stringify({ payloadHash, receiptId, completedAt: new Date().toISOString() } satisfies ImportStatus));
}

function hasMismatchedIdentity(envelope: UserDataEnvelope, athleteId: string | undefined): boolean {
  const subject = envelope.users[envelope.activeUserId].identity.auth?.subject;
  return Boolean(subject && athleteId && subject !== athleteId);
}

export function createCloudImport(client: CloudImportClient, storage: Storage, athleteId?: () => string | undefined): CloudImport {
  return {
    async import(value: unknown, completedVideoIds?: string[]): Promise<ImportResult> {
      const canonical = await canonicalizeLocalImport(value);
      if (hasMismatchedIdentity(canonical.envelope, athleteId?.())) throw { code: "invalid_import" };
      const alreadyCompleted = completedStatus(storage, canonical.payloadHash);
      if (alreadyCompleted) return alreadyCompleted;

      const { data, error } = await client.functions.invoke("import-local-data", {
        body: { sourceSchema: canonical.sourceSchema, payloadHash: canonical.payloadHash, envelope: canonical.envelope, ...(completedVideoIds ? { completedVideoIds } : {}) }
      });
      if (error || !data || !["metadata_imported", "completed"].includes(data.status) || typeof data.receiptId !== "string" || !Array.isArray(data.pendingVideoIds)) {
        throw { code: "import_unavailable" };
      }
      if (data.status === "completed") saveCompletedStatus(storage, canonical.payloadHash, data.receiptId);
      return data;
    }
  };
}
