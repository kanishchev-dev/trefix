"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import type {
  AdminCalendarDay,
  AdminCalendarSummary,
  AdminCreateWorkoutInput,
  AdminUpdateWorkoutInput,
} from "@trefix/api-client";

import {
  createCalendarWorkout,
  fetchCalendarDay,
  fetchCalendarSummary,
  updateCalendarWorkout,
  type CalendarDayQuery,
  type CalendarRangeQuery,
} from "@/entities/training-calendar/api";

export const trainingCalendarKeys = {
  all: ["training-calendar"] as const,
  user: (userId: string) => [...trainingCalendarKeys.all, userId] as const,
  day: (userId: string, query: CalendarDayQuery) =>
    [...trainingCalendarKeys.user(userId), "day", query] as const,
  summary: (userId: string, query: CalendarRangeQuery) =>
    [...trainingCalendarKeys.user(userId), "summary", query] as const,
};

export function useCalendarDay(
  userId: string,
  query: CalendarDayQuery,
): UseQueryResult<AdminCalendarDay> {
  return useQuery({
    queryKey: trainingCalendarKeys.day(userId, query),
    queryFn: () => fetchCalendarDay(userId, query),
  });
}

export function useCalendarSummary(
  userId: string,
  query: CalendarRangeQuery,
): UseQueryResult<AdminCalendarSummary> {
  return useQuery({
    queryKey: trainingCalendarKeys.summary(userId, query),
    queryFn: () => fetchCalendarSummary(userId, query),
    // Keeps the markers of the previous month while the next one loads, so the grid does not flicker.
    placeholderData: keepPreviousData,
  });
}

/** A workout change can move it between days, so every cached day and month of the user is refreshed. */
function useInvalidateUserCalendar(userId: string): () => Promise<void> {
  const queryClient = useQueryClient();

  return () =>
    queryClient.invalidateQueries({
      queryKey: trainingCalendarKeys.user(userId),
    });
}

export function useCreateCalendarWorkout(userId: string) {
  const invalidate = useInvalidateUserCalendar(userId);

  return useMutation({
    mutationFn: (input: AdminCreateWorkoutInput) =>
      createCalendarWorkout(userId, input),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCalendarWorkout(userId: string) {
  const invalidate = useInvalidateUserCalendar(userId);

  return useMutation({
    mutationFn: ({
      workoutId,
      input,
    }: {
      workoutId: string;
      input: AdminUpdateWorkoutInput;
    }) => updateCalendarWorkout(userId, workoutId, input),
    onSuccess: () => invalidate(),
  });
}
