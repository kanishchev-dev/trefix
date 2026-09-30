import {
  manualPlanPreviewSchema,
  planOverviewSchema,
  trainingAthleteSchema,
  trainingPlanSchema,
  trainingStateSchema,
  trainingWorkoutSchema,
  z,
  type CompleteWorkoutInput,
  type CreateManualPlanInput,
  type CreateWorkoutInput,
  type ManualPlanPreview,
  type PlanOverview,
  type PreviewManualPlanInput,
  type TrainingAthlete,
  type TrainingPlan,
  type TrainingState,
  type TrainingWorkout,
} from "@workspace/api-client";
import { request } from "./api-client";

export async function getAthlete(athleteId: string): Promise<TrainingAthlete> {
  const response = await request<unknown>(`/athletes/${athleteId}`, {
    useAuth: true,
  });
  return trainingAthleteSchema.parse(response);
}

export async function getMyAthlete(): Promise<TrainingAthlete | null> {
  try {
    const response = await request<unknown>("/athletes/me", {
      useAuth: true,
    });
    return trainingAthleteSchema.parse(response);
  } catch (error) {
    return null;
  }
}

export async function getAthleteState(
  athleteId: string,
): Promise<TrainingState> {
  const response = await request<unknown>(`/athletes/${athleteId}/state`, {
    useAuth: true,
  });
  return trainingStateSchema.parse(response);
}

export async function getLatestPlan(
  athleteId: string,
): Promise<TrainingPlan | null> {
  const response = await request<unknown>(`/plans?athleteId=${athleteId}`, {
    useAuth: true,
  });
  if (Array.isArray(response) && response.length > 0) {
    return trainingPlanSchema.parse(response[0]);
  }
  return null;
}

export async function getPlanOverview(planId = "current"): Promise<PlanOverview> {
  const response = await request<unknown>(`/plans/${planId}/overview`, {
    useAuth: true,
  });
  return planOverviewSchema.parse(response);
}

export async function getWorkouts(
  from?: string,
  to?: string,
): Promise<TrainingWorkout[]> {
  const params = new URLSearchParams();
  if (from) params.append("from", from);
  if (to) params.append("to", to);

  const queryString = params.toString();
  const url = queryString ? `/workouts?${queryString}` : "/workouts";

  const response = await request<unknown>(url, {
    useAuth: true,
  });

  return z.array(trainingWorkoutSchema).parse(response);
}

export async function createWorkout(
  dto: CreateWorkoutInput,
): Promise<TrainingWorkout> {
  const response = await request<unknown>("/workouts", {
    method: "POST",
    body: dto,
    useAuth: true,
  });

  return trainingWorkoutSchema.parse(response);
}

export async function completeWorkout(
  workoutId: string,
  dto: CompleteWorkoutInput,
): Promise<{ workout: TrainingWorkout }> {
  const response = await request<{ workout: unknown }>(
    `/workouts/${workoutId}/complete`,
    {
      method: "POST",
      body: dto,
      useAuth: true,
    },
  );

  return {
    workout: trainingWorkoutSchema.parse(response.workout),
  };
}

/** Builds a non-persisted manual plan preview via the Training Engine (PRD section 12). */
export async function previewManualPlan(
  dto: PreviewManualPlanInput,
): Promise<ManualPlanPreview> {
  const response = await request<unknown>("/plans/manual/preview", {
    method: "POST",
    body: dto,
    useAuth: true,
  });

  return manualPlanPreviewSchema.parse(response);
}

/** Creates the final manual training plan (PRD section 16). */
export async function createManualPlan(
  dto: CreateManualPlanInput,
): Promise<TrainingPlan> {
  const response = await request<unknown>("/plans/manual", {
    method: "POST",
    body: dto,
    useAuth: true,
  });

  return trainingPlanSchema.parse(response);
}
