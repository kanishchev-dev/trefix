import {
  athleteProfileSchema,
  gearListSchema,
  gearSchema,
  progressSummarySchema,
  progressRecordsSchema,
  raceResultSchema,
  recordHistorySchema,
  type AthleteProfile,
  type AthleteProfileUpdate,
  type Gear,
  type GearInput,
  type GearList,
  type ProgressSummary,
  type RaceResult,
  type RaceResultInput,
  type RecordHistory,
  z,
} from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

const base = (userId: string) => `/api/admin/users/${userId}`;

export async function fetchUserAthlete(
  userId: string,
): Promise<AthleteProfile> {
  return athleteProfileSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/athlete`),
  );
}

export async function updateUserAthlete(
  userId: string,
  input: AthleteProfileUpdate,
): Promise<AthleteProfile> {
  return athleteProfileSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/athlete`, {
      method: "PATCH",
      body: input,
    }),
  );
}

export async function fetchUserProgressSummary(
  userId: string,
  timezone: string,
): Promise<ProgressSummary> {
  return progressSummarySchema.parse(
    await apiRequest<unknown>(`${base(userId)}/progress/summary`, {
      searchParams: { timezone },
    }),
  );
}

export type ProgressRecords = z.infer<typeof progressRecordsSchema>;

export async function fetchUserRecords(
  userId: string,
): Promise<ProgressRecords> {
  return progressRecordsSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/progress/records`),
  );
}

export async function fetchUserRecordHistory(
  userId: string,
  distance: string,
): Promise<RecordHistory> {
  return recordHistorySchema.parse(
    await apiRequest<unknown>(`${base(userId)}/progress/records/${distance}`),
  );
}

export async function addUserResult(
  userId: string,
  input: RaceResultInput,
): Promise<RaceResult> {
  return raceResultSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/progress/results`, {
      method: "POST",
      body: input,
    }),
  );
}

export function deleteUserResult(
  userId: string,
  resultId: string,
): Promise<void> {
  return apiRequest<void>(`${base(userId)}/progress/results/${resultId}`, {
    method: "DELETE",
  });
}

export async function fetchUserGear(
  userId: string,
  status: "active" | "retired",
): Promise<GearList> {
  return gearListSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/gear`, {
      searchParams: { status },
    }),
  );
}

export async function createUserGear(
  userId: string,
  input: GearInput,
): Promise<Gear> {
  return gearSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/gear`, {
      method: "POST",
      body: input,
    }),
  );
}

export async function updateUserGear(
  userId: string,
  gearId: string,
  input: Partial<GearInput>,
): Promise<Gear> {
  return gearSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/gear/${gearId}`, {
      method: "PATCH",
      body: input,
    }),
  );
}

export async function setUserGearArchived(
  userId: string,
  gearId: string,
  archived: boolean,
): Promise<Gear> {
  return gearSchema.parse(
    await apiRequest<unknown>(
      `${base(userId)}/gear/${gearId}/${archived ? "retire" : "restore"}`,
      { method: "POST" },
    ),
  );
}

export function deleteUserGear(userId: string, gearId: string): Promise<void> {
  return apiRequest<void>(`${base(userId)}/gear/${gearId}`, {
    method: "DELETE",
  });
}
