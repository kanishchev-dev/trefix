import {
  adminCalendarDaySchema,
  adminCalendarSummarySchema,
  adminCreateWorkoutSchema,
  adminUpdateWorkoutSchema,
  adminWorkoutMutationSchema,
  type AdminCalendarDay,
  type AdminCalendarSummary,
  type AdminCalendarWorkout,
  type AdminCreateWorkoutInput,
  type AdminUpdateWorkoutInput,
} from "@workspace/api-client";

import { apiRequest } from "@/lib/api";

export const trainingCalendarPaths = {
  day: (userId: string) => `/api/admin/users/${userId}/training/calendar`,
  summary: (userId: string) =>
    `/api/admin/users/${userId}/training/calendar/summary`,
  workouts: (userId: string) => `/api/admin/users/${userId}/training/workouts`,
  workout: (userId: string, workoutId: string) =>
    `/api/admin/users/${userId}/training/workouts/${workoutId}`,
} as const;

export type CalendarDayQuery = { date: string; timezone: string };
export type CalendarRangeQuery = { from: string; to: string; timezone: string };

export async function fetchCalendarDay(
  userId: string,
  query: CalendarDayQuery,
): Promise<AdminCalendarDay> {
  const response = await apiRequest<unknown>(
    trainingCalendarPaths.day(userId),
    {
      searchParams: query,
    },
  );
  return adminCalendarDaySchema.parse(response);
}

export async function fetchCalendarSummary(
  userId: string,
  query: CalendarRangeQuery,
): Promise<AdminCalendarSummary> {
  const response = await apiRequest<unknown>(
    trainingCalendarPaths.summary(userId),
    {
      searchParams: query,
    },
  );
  return adminCalendarSummarySchema.parse(response);
}

export async function createCalendarWorkout(
  userId: string,
  input: AdminCreateWorkoutInput,
): Promise<AdminCalendarWorkout> {
  const response = await apiRequest<unknown>(
    trainingCalendarPaths.workouts(userId),
    {
      method: "POST",
      body: adminCreateWorkoutSchema.parse(input),
    },
  );
  return adminWorkoutMutationSchema.parse(response).workout;
}

export async function updateCalendarWorkout(
  userId: string,
  workoutId: string,
  input: AdminUpdateWorkoutInput,
): Promise<AdminCalendarWorkout> {
  const response = await apiRequest<unknown>(
    trainingCalendarPaths.workout(userId, workoutId),
    {
      method: "PATCH",
      body: adminUpdateWorkoutSchema.parse(input),
    },
  );
  return adminWorkoutMutationSchema.parse(response).workout;
}
