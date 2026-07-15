import type { JsonValue } from "./cloud-types";

const VIDEO_BUCKET = "climbing-videos";
const extensions = new Set(["mp4", "mov", "webm"]);

type CloudResult<T = unknown> = { data?: T; error: unknown | null };

export type VideoUploadFailure = { code: "unauthenticated" | "invalid_video_path" | "upload_pending" | "unavailable"; videoId?: string; path?: string };

export type VideoFile = Blob & { name: string; type: string; size: number };

export interface CloudVideoClient {
  auth: { getUser(): PromiseLike<CloudResult<{ user: { id: string } | null }>> };
  storage: {
    from(bucket: typeof VIDEO_BUCKET): {
      upload(path: string, file: VideoFile, options: { contentType: string; upsert: boolean }): PromiseLike<CloudResult>;
      createSignedUrl(path: string, expiresIn: number): PromiseLike<CloudResult<{ signedUrl: string }>>;
    };
  };
  from(table: "video_assets"): {
    insert(values: Record<string, JsonValue>): PromiseLike<CloudResult>;
    update(values: Record<string, JsonValue>): { eq(column: string, value: string): PromiseLike<CloudResult> };
  };
}

export type VideoAnalysisPayload = {
  analysisVersion: number;
  status: "completed" | "failed";
  metrics: Record<string, JsonValue>;
  advice: Record<string, JsonValue>;
};

export type AppendVideoAnalysis = (videoId: string, payload: VideoAnalysisPayload) => Promise<void>;

export function videoPath(userId: string, videoId: string, fileName: string): string {
  const extension = fileName.trim().split(".").pop()?.toLowerCase();
  if (!userId.trim() || !videoId.trim() || !extension || !extensions.has(extension)) {
    throw new Error("invalid_video_path");
  }
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

  return {
    async upload(file: VideoFile, options: { videoId?: string; durationSeconds?: number; createMetadata?: boolean } = {}) {
      const athleteId = await authenticatedUserId();
      const videoId = options.videoId ?? createId();
      let path: string;
      try {
        path = videoPath(athleteId, videoId, file.name);
      } catch {
        throw failure("invalid_video_path");
      }

      const digest = await checksum(file);
      if (options.createMetadata ?? !options.videoId) {
        const pending = await client.from("video_assets").insert({
          id: videoId,
          athlete_id: athleteId,
          object_path: path,
          checksum: digest,
          mime_type: file.type || `video/${path.split(".").pop()}`,
          byte_size: file.size,
          ...(options.durationSeconds ? { duration_seconds: Math.round(options.durationSeconds) } : {}),
          upload_status: "pending",
          processing_status: "pending"
        });
        if (pending.error) throw failure("unavailable");
      }

      const uploaded = await client.storage.from(VIDEO_BUCKET).upload(path, file, {
        contentType: file.type || `video/${path.split(".").pop()}`,
        upsert: !(options.createMetadata ?? !options.videoId)
      });
      if (uploaded.error) {
        await client.from("video_assets").update({ sanitized_failure: { code: "upload_pending" } }).eq("id", videoId);
        throw failure("upload_pending", videoId, path);
      }

      const updated = await client.from("video_assets").update({
        upload_status: "uploaded",
        processing_status: "pending",
        sanitized_failure: null
      }).eq("id", videoId);
      if (updated.error) throw failure("unavailable", videoId, path);
      return { videoId, path };
    },

    async playbackUrl(path: string, expiresIn = 60) {
      const signed = await client.storage.from(VIDEO_BUCKET).createSignedUrl(path, expiresIn);
      if (signed.error || !signed.data?.signedUrl) throw failure("unavailable");
      return signed.data.signedUrl;
    }
  };
}

export async function appendVideoAnalysis(
  append: AppendVideoAnalysis,
  videoId: string,
  payload: VideoAnalysisPayload
): Promise<void> {
  await append(videoId, payload);
}
