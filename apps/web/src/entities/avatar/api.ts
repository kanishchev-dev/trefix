import { ApiClientError, avatarUploadSchema } from "@workspace/api-client";

export const avatarPaths = {
  /** Self-service upload of the own avatar. */
  own: "/api/admin/avatars/me",
} as const;

/**
 * Uploads the own avatar.
 *
 * Sent as multipart, which is why the API proxies stream non-JSON bodies
 * through untouched instead of trying to parse them as JSON. The blob arrives
 * already cropped and downscaled by the client, so the backend does no image
 * processing of its own.
 *
 * `fetch` is used directly rather than the shared JSON helper: that one always
 * sets `content-type: application/json`, which would corrupt the multipart
 * boundary and leave the backend with an empty file.
 */
export async function uploadAvatar(file: Blob): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append("file", file, "avatar.webp");

  const response = await fetch(avatarPaths.own, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
      code?: string;
    } | null;

    throw new ApiClientError(
      errorBody?.message || `Request failed with status ${response.status}`,
      response.status,
      errorBody?.code,
      errorBody,
    );
  }

  return avatarUploadSchema.parse(await response.json());
}
