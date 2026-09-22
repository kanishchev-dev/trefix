import {
  progressSnapshotSchema,
  type ProgressSnapshot,
} from "@workspace/api-client";
import { request } from "./api-client";

export async function fetchProgress(
  periodKey = "6M"
): Promise<ProgressSnapshot> {
  const response = await request<unknown>(
    `/progress?period=${encodeURIComponent(periodKey)}`,
    {
      useAuth: true,
    }
  );
  return progressSnapshotSchema.parse(response);
}
