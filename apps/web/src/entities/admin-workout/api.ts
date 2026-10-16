import {
  coachWorkoutNoteSchema,
  pendingAdaptationListSchema,
  pendingAdaptationSchema,
  recordsExclusionSchema,
  trainingWorkoutCompletionSchema,
  trainingWorkoutSchema,
  workoutRecordingSchema,
  workoutSourcesSchema,
  type CoachWorkoutNote,
  type CompleteWorkoutInput,
  type PendingAdaptation,
  type TrainingWorkout,
  type WorkoutRecording,
  type WorkoutSources,
} from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

const workoutBase = (userId: string, workoutId: string) =>
  `/api/admin/users/${userId}/training/workouts/${workoutId}`;
const adaptationsBase = (userId: string) =>
  `/api/admin/users/${userId}/training/plans/active/adaptations`;

export async function fetchAdminWorkout(
  userId: string,
  workoutId: string,
): Promise<TrainingWorkout> {
  return trainingWorkoutSchema.parse(
    await apiRequest<unknown>(workoutBase(userId, workoutId)),
  );
}

export async function completeAdminWorkout(
  userId: string,
  workoutId: string,
  input: CompleteWorkoutInput,
): Promise<TrainingWorkout> {
  const response = trainingWorkoutCompletionSchema.parse(
    await apiRequest<unknown>(`${workoutBase(userId, workoutId)}/complete`, {
      method: "POST",
      body: input,
    }),
  );
  return response.workout;
}

export async function updateAdminWorkoutResult(
  userId: string,
  workoutId: string,
  input: CompleteWorkoutInput,
): Promise<TrainingWorkout> {
  return trainingWorkoutSchema.parse(
    await apiRequest<unknown>(`${workoutBase(userId, workoutId)}/result`, {
      method: "PATCH",
      body: input,
    }),
  );
}

export async function reopenAdminWorkout(
  userId: string,
  workoutId: string,
): Promise<TrainingWorkout> {
  return trainingWorkoutSchema.parse(
    await apiRequest<unknown>(`${workoutBase(userId, workoutId)}/reopen`, {
      method: "POST",
    }),
  );
}

export function deleteAdminWorkout(
  userId: string,
  workoutId: string,
): Promise<void> {
  return apiRequest<void>(workoutBase(userId, workoutId), { method: "DELETE" });
}

export function setAdminWorkoutGear(
  userId: string,
  workoutId: string,
  gearId: string | null,
): Promise<unknown> {
  return apiRequest<unknown>(`${workoutBase(userId, workoutId)}/gear`, {
    method: "PATCH",
    body: { gearId },
  });
}

export function setAdminWorkoutDevice(
  userId: string,
  workoutId: string,
  deviceId: string | null,
): Promise<unknown> {
  return apiRequest<unknown>(`${workoutBase(userId, workoutId)}/device`, {
    method: "PATCH",
    body: { deviceId },
  });
}

export async function setAdminWorkoutRecordsExcluded(
  userId: string,
  workoutId: string,
  excluded: boolean,
): Promise<boolean> {
  return recordsExclusionSchema.parse(
    await apiRequest<unknown>(`${workoutBase(userId, workoutId)}/records`, {
      method: "PATCH",
      body: { excluded },
    }),
  ).excluded;
}

export async function fetchAdminWorkoutSources(
  userId: string,
  workoutId: string,
): Promise<WorkoutSources> {
  return workoutSourcesSchema.parse(
    await apiRequest<unknown>(`${workoutBase(userId, workoutId)}/sources`),
  );
}

export function unlinkAdminWorkoutSource(
  userId: string,
  workoutId: string,
  provider: string,
): Promise<void> {
  return apiRequest<void>(
    `${workoutBase(userId, workoutId)}/sources/${provider}`,
    {
      method: "DELETE",
    },
  );
}

export async function fetchAdminWorkoutRecording(
  userId: string,
  workoutId: string,
): Promise<WorkoutRecording> {
  return workoutRecordingSchema.parse(
    await apiRequest<unknown>(`${workoutBase(userId, workoutId)}/recording`),
  );
}

export async function fetchAdminWorkoutNote(
  userId: string,
  workoutId: string,
): Promise<CoachWorkoutNote> {
  return coachWorkoutNoteSchema.parse(
    await apiRequest<unknown>(`${workoutBase(userId, workoutId)}/note`),
  );
}

export async function regenerateAdminWorkoutNote(
  userId: string,
  workoutId: string,
): Promise<CoachWorkoutNote> {
  return coachWorkoutNoteSchema.parse(
    await apiRequest<unknown>(
      `${workoutBase(userId, workoutId)}/note/regenerate`,
      {
        method: "POST",
      },
    ),
  );
}

export function deleteAdminWorkoutNote(
  userId: string,
  workoutId: string,
): Promise<void> {
  return apiRequest<void>(`${workoutBase(userId, workoutId)}/note`, {
    method: "DELETE",
  });
}

export async function fetchAdminAdaptations(
  userId: string,
): Promise<PendingAdaptation[]> {
  return pendingAdaptationListSchema.parse(
    await apiRequest<unknown>(adaptationsBase(userId)),
  ).items;
}

export async function decideAdminAdaptation(
  userId: string,
  adaptationId: string,
  decision: "apply" | "dismiss",
): Promise<PendingAdaptation> {
  return pendingAdaptationSchema.parse(
    await apiRequest<unknown>(
      `${adaptationsBase(userId)}/${adaptationId}/${decision}`,
      {
        method: "POST",
      },
    ),
  );
}
