import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const sourceSchema = "local-schema-3";
const hashPattern = /^[a-f0-9]{64}$/i;
const videoBucket = "climbing-videos";

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
type Envelope = { schemaVersion: 3; activeUserId: string; users: Record<string, User>; migration: { migratedFrom: string | null; migratedAt: string | null } };
type User = { identity: { id: string; auth: { subject: string } | null }; facts: Fact[]; sessionLogs: SessionLog[]; videoAnalyses: Video[]; guidedSessions: Json };
type Fact = { id: string; key: string; value: Json; unit: string | null; recordedAt: string; supersedes: string | null };
type SessionLog = { id: string; createdAt: string; notes: string; rpe: number; pump: number; pain: number; attempts: number; moves: number; bestLink: number; footCuts: number; pullWeight: number; sleep: number; energy: number };
type Video = { id: string; fileName: string; duration: number; size: number; createdAt: string; notes: string; footCuts: number; swing: number; hips: number; shoulder: number; breath: number; reading: number; advice: Json };
type CompletedVideo = { id: string; checksum: string };

function json(status: number, value: Json): Response {
  return new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });
}

function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function stableJson(value: Json): string {
  if (value === null || typeof value === "boolean" || typeof value === "number" || typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

async function payloadHash(value: Json): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(stableJson(value)));
  return [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validEnvelope(value: unknown, athleteId: string): value is Envelope {
  if (!record(value) || value.schemaVersion !== 3 || typeof value.activeUserId !== "string" || !record(value.users) || !record(value.migration)) return false;
  const user = value.users[value.activeUserId];
  if (!record(user) || !record(user.identity) || user.identity.id !== value.activeUserId || !Array.isArray(user.facts) || !Array.isArray(user.sessionLogs) || !Array.isArray(user.videoAnalyses)) return false;
  const auth = user.identity.auth;
  if (auth !== null && (!record(auth) || typeof auth.subject !== "string" || auth.subject !== athleteId)) return false;
  return user.facts.every((fact) => record(fact) && typeof fact.id === "string" && typeof fact.key === "string" && typeof fact.recordedAt === "string")
    && user.sessionLogs.every((log) => record(log) && typeof log.id === "string" && typeof log.createdAt === "string" && typeof log.notes === "string")
    && user.videoAnalyses.every((video) => record(video) && typeof video.id === "string" && typeof video.fileName === "string" && typeof video.duration === "number" && typeof video.size === "number");
}

function receiptStatus(receipt: unknown): string | null {
  return record(receipt) && typeof receipt.status === "string" ? receipt.status : null;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json(405, { error: "method_not_allowed" });
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { error: "unauthenticated" });
  const token = authorization.slice("Bearer ".length);
  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceRole) return json(500, { error: "import_unavailable" });

  const authClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return json(401, { error: "unauthenticated" });
  const athleteId = userData.user.id;

  let body: { sourceSchema?: unknown; payloadHash?: unknown; envelope?: unknown; completedVideos?: unknown };
  try { body = await request.json(); } catch { return json(400, { error: "invalid_import" }); }
  if (body.sourceSchema !== sourceSchema || typeof body.payloadHash !== "string" || !hashPattern.test(body.payloadHash) || !validEnvelope(body.envelope, athleteId)) return json(400, { error: "invalid_import" });
  if (await payloadHash(body.envelope as Json) !== body.payloadHash.toLowerCase()) return json(400, { error: "invalid_import" });

  const admin = createClient(url, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: existing, error: lookupError } = await admin.from("import_receipts").select("id, receipt").eq("athlete_id", athleteId).eq("source_schema", sourceSchema).eq("payload_hash", body.payloadHash.toLowerCase()).maybeSingle();
  if (lookupError) return json(503, { error: "import_unavailable" });

  let receipt = existing;
  if (!receipt) {
    const { data, error } = await admin.from("import_receipts").insert({ athlete_id: athleteId, source_schema: sourceSchema, payload_hash: body.payloadHash.toLowerCase(), receipt: { status: "received" } }).select("id, receipt").single();
    if (error) {
      const retry = await admin.from("import_receipts").select("id, receipt").eq("athlete_id", athleteId).eq("source_schema", sourceSchema).eq("payload_hash", body.payloadHash.toLowerCase()).maybeSingle();
      if (retry.error || !retry.data) return json(503, { error: "import_unavailable" });
      receipt = retry.data;
    } else receipt = data;
  }
  if (!receipt) return json(503, { error: "import_unavailable" });
  if (receiptStatus(receipt.receipt) === "completed") return json(200, { status: "completed", receiptId: receipt.id, pendingVideoIds: [] });

  const user = (body.envelope as Envelope).users[(body.envelope as Envelope).activeUserId];
  if (receiptStatus(receipt.receipt) === "received") {
    const facts = user.facts.map((fact) => ({ athlete_id: athleteId, fact_key: fact.key, value: fact.value, source: { type: "import", field: fact.key, version: 3, local_id: fact.id, recorded_at: fact.recordedAt, unit: fact.unit, supersedes: fact.supersedes } }));
    const logs = user.sessionLogs.map((log) => ({ athlete_id: athleteId, body: log.notes || null, rpe: log.rpe, pump: log.pump, pain: log.pain, energy: log.energy, metrics: { imported_source_id: log.id, created_at: log.createdAt, attempts: log.attempts, moves: log.moves, best_link: log.bestLink, foot_cuts: log.footCuts, pull_weight: log.pullWeight, sleep: log.sleep } }));
    // Receipt creation is the idempotency claim. These writes are only reached by its owner; retries resume from the receipt.
    if ((facts.length && (await admin.from("athlete_facts").insert(facts)).error) || (logs.length && (await admin.from("session_logs").insert(logs)).error)) return json(503, { error: "import_unavailable" });
    const { error } = await admin.from("import_receipts").update({ receipt: { status: "metadata_imported", counts: { facts: facts.length, logs: logs.length, guided_runs: Array.isArray((user.guidedSessions as Record<string, unknown>).history) ? (user.guidedSessions as Record<string, unknown>).history.length : 0, videos: user.videoAnalyses.length }, source_ids: { facts: user.facts.map((fact) => fact.id), logs: user.sessionLogs.map((log) => log.id), videos: user.videoAnalyses.map((video) => video.id) } } }).eq("id", receipt.id).eq("athlete_id", athleteId);
    if (error) return json(503, { error: "import_unavailable" });
    receipt.receipt = { status: "metadata_imported" };
  }

  const pendingVideoIds = user.videoAnalyses.map((video) => video.id);
  const completedVideos = body.completedVideos;
  if (!Array.isArray(completedVideos) || completedVideos.length === 0) return json(200, { status: "metadata_imported", receiptId: receipt.id, pendingVideoIds });
  if (!completedVideos.every((video): video is CompletedVideo => record(video) && typeof video.id === "string" && typeof video.checksum === "string" && hashPattern.test(video.checksum) && pendingVideoIds.includes(video.id))) return json(400, { error: "invalid_import" });
  if (completedVideos.length !== pendingVideoIds.length) return json(200, { status: "metadata_imported", receiptId: receipt.id, pendingVideoIds });

  const videoRows = [];
  for (const completed of completedVideos) {
    const video = user.videoAnalyses.find((candidate) => candidate.id === completed.id)!;
    const objectPath = `${athleteId}/${receipt.id}/${video.id}`;
    const { data: objects, error } = await admin.storage.from(videoBucket).list(`${athleteId}/${receipt.id}`, { search: video.id });
    if (error || !objects?.some((object) => object.name === video.id)) return json(409, { error: "video_upload_pending" });
    videoRows.push({ athlete_id: athleteId, object_path: objectPath, checksum: completed.checksum.toLowerCase(), mime_type: "video/mp4", byte_size: video.size, duration_seconds: Math.max(0, Math.round(video.duration)), upload_status: "uploaded", processing_status: "pending", sanitized_failure: null });
  }
  const { error: videoError } = await admin.from("video_assets").upsert(videoRows, { onConflict: "object_path" });
  if (videoError) return json(503, { error: "import_unavailable" });
  const { error: completeError } = await admin.from("import_receipts").update({ receipt: { status: "completed", completed_video_ids: pendingVideoIds } }).eq("id", receipt.id).eq("athlete_id", athleteId);
  if (completeError) return json(503, { error: "import_unavailable" });
  return json(200, { status: "completed", receiptId: receipt.id, pendingVideoIds: [] });
});
