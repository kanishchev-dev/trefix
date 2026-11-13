import { File, Paths } from "expo-file-system";
import { gzip } from "pako";
import {
  ApiClientError,
  recordedActivityAcceptedSchema,
  type RecordedActivityAccepted,
} from "@trefix/api-client";

import { authorizedFetch, toApiError } from "../../../lib/api-client";
import {
  deleteSession,
  listUploads,
  markUploadFailed,
  type StoredUpload,
} from "./tracker-db";

/** Statuses after which a retry will not help: the record is invalid for the server. */
const PERMANENT_FAILURES = new Set([400, 404, 409, 413, 422]);
const UPLOAD_TIMEOUT_MS = 60_000;

/** Sends one queued recording; repeats are safe, the server answers with the stored result. */
export async function uploadRecording(
  upload: StoredUpload,
): Promise<RecordedActivityAccepted> {
  const form = new FormData();
  form.append("summary", JSON.stringify(upload.summary));
  let trackFile: File | null = null;
  if (upload.track) {
    trackFile = new File(Paths.cache, `track-${upload.sessionId}.json.gz`);
    trackFile.create({ overwrite: true });
    trackFile.write(gzip(JSON.stringify(upload.track)));
    // React Native sends a local file as a part described by uri/name/type.
    form.append("track", {
      uri: trackFile.uri,
      name: "track.json.gz",
      type: "application/gzip",
    } as unknown as Blob);
  }

  try {
    const response = await authorizedFetch(
      "/recorded-activities",
      { method: "POST", body: form, headers: { Accept: "application/json" } },
      { useAuth: true, timeoutMs: UPLOAD_TIMEOUT_MS },
    );
    if (!response.ok) {
      throw await toApiError(response);
    }
    return recordedActivityAcceptedSchema.parse(await response.json());
  } finally {
    if (trackFile?.exists) trackFile.delete();
  }
}

export type UploadOutcome =
  | { sessionId: string; status: "uploaded"; result: RecordedActivityAccepted }
  | { sessionId: string; status: "retry" | "rejected"; error: unknown };

let running: Promise<UploadOutcome[]> | null = null;

/**
 * Sends every queued recording of the user, one by one. A recording leaves the
 * phone only after the server accepted it; a rejected one stays for the user to see.
 */
export function processUploadQueue(userId: string): Promise<UploadOutcome[]> {
  running ??= (async () => {
    const outcomes: UploadOutcome[] = [];
    for (const upload of await listUploads(userId)) {
      if (upload.lastError?.startsWith("rejected:")) continue;
      try {
        const result = await uploadRecording(upload);
        await deleteSession(upload.sessionId);
        outcomes.push({
          sessionId: upload.sessionId,
          status: "uploaded",
          result,
        });
      } catch (error) {
        const rejected =
          error instanceof ApiClientError &&
          PERMANENT_FAILURES.has(error.status);
        const message = error instanceof Error ? error.message : String(error);
        await markUploadFailed(
          upload.sessionId,
          rejected ? `rejected: ${message}` : message,
        );
        outcomes.push({
          sessionId: upload.sessionId,
          status: rejected ? "rejected" : "retry",
          error,
        });
      }
    }
    return outcomes;
  })().finally(() => {
    running = null;
  });
  return running;
}
