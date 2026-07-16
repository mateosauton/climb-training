const AVATAR_BUCKET = "profile-photos";
export const AVATAR_EXPIRY_SECONDS = 60;
export const AVATAR_REFRESH_DELAY_MS = 50_000;
export const AVATAR_RETRY_DELAY_MS = 1_000;
const AVATAR_MAX_RETRY_DELAY_MS = 8_000;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const extensionsByMime = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
} as const;

type CloudResult<T = unknown> = { data: T; error: unknown | null };
export type AvatarFile = Blob & { name: string; type: string; size: number };
export type CloudAvatarError = {
  code: "invalid_avatar_file" | "avatar_too_large" | "invalid_avatar_path" | "unavailable";
};

function failure(code: CloudAvatarError["code"]): CloudAvatarError {
  return { code };
}

export function avatarRetryDelayMs(attempt: number): number {
  return Math.min(AVATAR_RETRY_DELAY_MS * (2 ** attempt), AVATAR_MAX_RETRY_DELAY_MS);
}

export interface CloudAvatarClient {
  storage: {
    from(bucket: typeof AVATAR_BUCKET): {
      upload(path: string, file: AvatarFile, options: { contentType: string; upsert: boolean }): PromiseLike<CloudResult>;
      remove(paths: string[]): PromiseLike<CloudResult>;
      createSignedUrl(path: string, expiresIn: number): PromiseLike<CloudResult<{ signedUrl: string } | null>>;
    };
  };
}

export function validateAvatarFile(file: AvatarFile): "jpg" | "png" | "webp" {
  const extension = extensionsByMime[file.type as keyof typeof extensionsByMime];
  if (!extension) throw failure("invalid_avatar_file");
  if (file.size > MAX_AVATAR_BYTES) throw failure("avatar_too_large");
  return extension;
}

export function avatarPath(athleteId: string, file: AvatarFile): string {
  if (!athleteId.trim()) throw failure("invalid_avatar_path");
  return `${athleteId}/avatar.${validateAvatarFile(file)}`;
}

export async function uploadAvatar(client: CloudAvatarClient, athleteId: string, file: AvatarFile): Promise<string> {
  const path = avatarPath(athleteId, file);
  const { error } = await client.storage.from(AVATAR_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: true
  });
  if (error) throw failure("unavailable");
  return path;
}

export async function createAvatarSignedUrl(client: CloudAvatarClient, path: string): Promise<string> {
  const { data, error } = await client.storage.from(AVATAR_BUCKET).createSignedUrl(path, AVATAR_EXPIRY_SECONDS);
  if (error || !data?.signedUrl) throw failure("unavailable");
  return data.signedUrl;
}

export async function removeAvatar(client: CloudAvatarClient, path: string): Promise<void> {
  const { error } = await client.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) throw failure("unavailable");
}
