import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { validateLocalImportEnvelope } from "../_shared/local-import-schema.ts";

const sourceSchema = "local-schema-3";
const hashPattern = /^[a-f0-9]{64}$/i;
const videoBucket = "climbing-videos";
const extensions = new Set(["mp4", "mov", "webm"]);
type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type RecordValue = Record<string, unknown>;

function json(status: number, value: Json): Response { return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } }); }
function record(value: unknown): value is RecordValue { return !!value && typeof value === "object" && !Array.isArray(value); }
function stableJson(value: Json): string { if (value === null || typeof value !== "object") return JSON.stringify(value); if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`; return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`; }
async function payloadHash(value: Json): Promise<string> { const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(value))); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }
function safeExtension(fileName: string): string | null { const ext = fileName.trim().split(".").pop()?.toLowerCase(); return ext && extensions.has(ext) ? ext : null; }
async function objectChecksum(admin: ReturnType<typeof createClient>, path: string): Promise<string> { const { data, error } = await admin.storage.from(videoBucket).download(path); if (error || !data) throw new Error("object_missing"); const digest = await crypto.subtle.digest("SHA-256", await data.arrayBuffer()); return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join(""); }

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "unauthenticated" });
  const url = Deno.env.get("SUPABASE_URL"), anonKey = Deno.env.get("SUPABASE_ANON_KEY"), serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRole) return json(500, { error: "import_unavailable" });
  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: auth, error: authError } = await authClient.auth.getUser(authorization.slice(7));
  if (authError || !auth.user) return json(401, { error: "unauthenticated" });
  let body: RecordValue; try { const candidate = await request.json(); if (!record(candidate)) throw new Error(); body = candidate; } catch { return json(400, { error: "invalid_import" }); }
  const athleteId = auth.user.id;
  if (body.sourceSchema !== sourceSchema || typeof body.payloadHash !== "string" || !hashPattern.test(body.payloadHash) || !validateLocalImportEnvelope(body.envelope, athleteId) || await payloadHash(body.envelope as Json) !== body.payloadHash.toLowerCase()) return json(400, { error: "invalid_import" });
  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: metadata, error: metadataError } = await admin.rpc("import_local_metadata", { p_athlete_id: athleteId, p_source_schema: sourceSchema, p_payload_hash: body.payloadHash.toLowerCase(), p_envelope: body.envelope });
  if (metadataError || !record(metadata) || typeof metadata.receiptId !== "string" || !Array.isArray(metadata.pendingVideoIds)) return json(503, { error: "import_unavailable" });
  if (metadata.status === "completed") return json(200, metadata as Json);
  const completedIds = body.completedVideoIds;
  if (!Array.isArray(completedIds) || completedIds.length === 0) return json(200, metadata as Json);
  const videos = (body.envelope as RecordValue).users as RecordValue;
  const active = videos[(body.envelope as RecordValue).activeUserId] as RecordValue;
  if (!completedIds.every((id) => typeof id === "string") || new Set(completedIds).size !== completedIds.length || completedIds.length !== metadata.pendingVideoIds.length || !completedIds.every((id) => metadata.pendingVideoIds.includes(id))) return json(400, { error: "invalid_import" });
  try {
    const verified = await Promise.all((active.videoAnalyses as RecordValue[]).filter((video) => completedIds.includes(video.id as string)).map(async (video) => {
      const extension = safeExtension(video.fileName as string); if (!extension) throw new Error("invalid_video");
      const path = `${athleteId}/${video.id}/original.${extension}`;
      return { id: video.id, path, checksum: await objectChecksum(admin, path), mime_type: `video/${extension === "mov" ? "quicktime" : extension}`, byte_size: Math.max(0, Math.round(video.size as number)), duration_seconds: Math.max(0, Math.round(video.duration as number)) };
    }));
    const { error } = await admin.rpc("complete_local_import_videos", { p_athlete_id: athleteId, p_receipt_id: metadata.receiptId, p_videos: verified });
    if (error) return json(409, { error: "video_upload_pending" });
  } catch { return json(409, { error: "video_upload_pending" }); }
  return json(200, { status: "completed", receiptId: metadata.receiptId, pendingVideoIds: [] });
});
