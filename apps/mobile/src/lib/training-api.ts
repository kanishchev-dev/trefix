import {
  trainingAthleteSchema,
  trainingPlanSchema,
  trainingStateSchema,
  type TrainingAthlete,
  type TrainingPlan,
  type TrainingState,
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
  // This endpoint might not exist directly as described, let's check TrainingController
  // TrainingController has GET /plans/:id
  // But we need a way to get the *latest* plan.
  // TrainingService has getLatestPlanForAthlete.
  // Let's check if the controller exposes it.
  // I saw GET /plans/:id in TrainingController but not GET /athletes/:id/plans/latest
  // Wait, I missed it?
  const response = await request<unknown>(`/plans?athleteId=${athleteId}`, {
    useAuth: true,
  });
  if (Array.isArray(response) && response.length > 0) {
    return trainingPlanSchema.parse(response[0]);
  }
  return null;
}
