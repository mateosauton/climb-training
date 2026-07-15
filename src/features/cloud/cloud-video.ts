import type { JsonValue } from "./cloud-types";

const VIDEO_BUCKET = "climbing-videos";
const PLAYBACK_EXPIRY_SECONDS = 60;
const extensions = new Set(["mp4", "mov", "webm"]);

type CloudResult<T = unknown> = { data?: T; error: unknown | null };
type VideoAsset = { id: string; athlete_id: string; object_path: string; checksum: string; byte_size: number; upload_status: string };
type StoredObject = { name: string; metadata?: { size?: number | string } };

export type VideoUploadFailure = { code: "unauthenticated" | "invalid_video_path" | "file_mismatch" | "upload_pending" | "unavailable"; videoId?: string; path?: string };
export type VideoFile = Blob & { name: string; type: string; size: number };

export interface CloudVideoClient {
  auth: { getUser(): PromiseLike<CloudResult<{ user: { id: string } | null }>> };
  storage: { from(bucket: typeof VIDEO_BUCKET): {
    upload(path: string, file: VideoFile, options: { contentType: string; upsert: boolean }): PromiseLike<CloudResult>;
    createSignedUrl(path: string, expiresIn: number): PromiseLike<CloudResult<{ signedUrl: string }>>;
    list(path: string, options: { search: string }): PromiseLike<CloudResult<StoredObject[]>>;
  } };
  from(table: "video_assets"): {
    insert(values: Record<string, JsonValue>): PromiseLike<CloudResult>;
    update(values: Record<string, JsonValue>): { eq(column: string, value: string): PromiseLike<CloudResult> };
    select(columns: string): { eq(column: string, value: string): { maybeSingle(): PromiseLike<CloudResult<VideoAsset | null>> } };
  };
  rpc(name: "append_video_analysis", values: Record<string, JsonValue>): PromiseLike<CloudResult>;
}

export type VideoAnalysisPayload = {
  status: "completed" | "failed";
  metrics: Record<string, JsonValue>;
  advice: Record<string, JsonValue>;
};

export type AppendVideoAnalysis = (videoId: string, payload: VideoAnalysisPayload) => Promise<void>;

export function videoPath(userId: string, videoId: string, fileName: string): string {
  const extension = fileName.trim().split(".").pop()?.toLowerCase();
  if (!userId.trim() || !videoId.trim() || !extension || !extensions.has(extension)) throw new Error("invalid_video_path");
  return `${userId}/${videoId}/original.${extension}`;
}

async function sha256(file: VideoFile): Promise<string> {
  const bytes = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function failure(code: VideoUploadFailure["code"], videoId?: string, path?: string): VideoUploadFailure {
  return { code, ...(videoId ? { videoId } : {}), ...(path ? { path } : {}) };
}

function matchesAsset(asset: VideoAsset, athleteId: string, videoId: string, path: string, checksum: string, byteSize: number): boolean {
  return asset.id === videoId && asset.athlete_id === athleteId && asset.object_path === path && asset.checksum === checksum && Number(asset.byte_size) === byteSize;
}

export function createCloudVideoService(
  client: CloudVideoClient,
  dependencies: { createId?: () => string; checksum?: (file: VideoFile) => Promise<string> } = {}
) {
  const createId = dependencies.createId ?? crypto.randomUUID.bind(crypto);
  const checksum = dependencies.checksum ?? sha256;

  async function authenticatedUserId(): Promise<string> {
    const { data, error } = await client.auth.getUser();
    if (error || !data?.user) throw failure("unauthenticated");
    return data.user.id;
  }

  async function asset(videoId: string): Promise<VideoAsset | null> {
    const result = await client.from("video_assets").select("id, athlete_id, object_path, checksum, byte_size, upload_status").eq("id", videoId).maybeSingle();
    if (result.error) throw failure("unavailable", videoId);
    return result.data ?? null;
  }

  return {
    async upload(file: VideoFile, options: { videoId?: string; durationSeconds?: number } = {}) {
      const athleteId = await authenticatedUserId();
      const videoId = options.videoId ?? createId();
      let path: string;
      try { path = videoPath(athleteId, videoId, file.name); } catch { throw failure("invalid_video_path"); }
      const digest = await checksum(file);
      let existing = await asset(videoId);
      if (existing && !matchesAsset(existing, athleteId, videoId, path, digest, file.size)) throw failure("file_mismatch", videoId, path);
      if (!existing) {
        const pending = await client.from("video_assets").insert({
          id: videoId, athlete_id: athleteId, object_path: path, checksum: digest,
          mime_type: file.type || `video/${path.split(".").pop()}`, byte_size: file.size,
          ...(options.durationSeconds ? { duration_seconds: Math.round(options.durationSeconds) } : {}),
          upload_status: "pending", processing_status: "pending"
        });
        if (pending.error) {
          existing = await asset(videoId);
          if (!existing || !matchesAsset(existing, athleteId, videoId, path, digest, file.size)) throw failure("unavailable", videoId, path);
        }
      }
      const uploaded = await client.storage.from(VIDEO_BUCKET).upload(path, file, { contentType: file.type || `video/${path.split(".").pop()}`, upsert: true });
      if (uploaded.error) {
        await client.from("video_assets").update({ sanitized_failure: { code: "upload_pending" } }).eq("id", videoId);
        throw failure("upload_pending", videoId, path);
      }
      const verified = await asset(videoId);
      const objects = await client.storage.from(VIDEO_BUCKET).list(`${athleteId}/${videoId}`, { search: path.split("/").pop()! });
      const object = objects.data?.find((candidate) => candidate.name === path.split("/").pop());
      if (objects.error || !verified || !matchesAsset(verified, athleteId, videoId, path, digest, file.size) || !object || Number(object.metadata?.size) !== file.size) {
        await client.from("video_assets").update({ sanitized_failure: { code: "upload_pending" } }).eq("id", videoId);
        throw failure("upload_pending", videoId, path);
      }
      const updated = await client.from("video_assets").update({ upload_status: "uploaded", processing_status: "pending", sanitized_failure: null }).eq("id", videoId);
      if (updated.error) throw failure("unavailable", videoId, path);
      return { videoId, path };
    },

    async playbackUrl(videoId: string) {
      const athleteId = await authenticatedUserId();
      const saved = await asset(videoId);
      if (!saved || saved.athlete_id !== athleteId || saved.upload_status !== "uploaded") throw failure("unavailable", videoId);
      const signed = await client.storage.from(VIDEO_BUCKET).createSignedUrl(saved.object_path, PLAYBACK_EXPIRY_SECONDS);
      if (signed.error || !signed.data?.signedUrl) throw failure("unavailable", videoId);
      return signed.data.signedUrl;
    },

    async appendAnalysis(videoId: string, payload: VideoAnalysisPayload) {
      const result = await client.rpc("append_video_analysis", {
        p_video_asset_id: videoId, p_status: payload.status, p_metrics: payload.metrics, p_advice: payload.advice
      });
      if (result.error) throw failure("unavailable", videoId);
    }
  };
}

export async function appendVideoAnalysis(append: AppendVideoAnalysis, videoId: string, payload: VideoAnalysisPayload): Promise<void> {
  await append(videoId, payload);
}
