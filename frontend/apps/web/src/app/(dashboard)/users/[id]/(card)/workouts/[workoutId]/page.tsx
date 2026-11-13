"use client";

import { use, type ReactElement } from "react";

import { UserWorkoutPage } from "@/features/user-workout/components/user-workout-page";

export default function UserWorkoutRoute({
  params,
}: {
  params: Promise<{ id: string; workoutId: string }>;
}): ReactElement {
  const { id, workoutId } = use(params);
  return <UserWorkoutPage userId={id} workoutId={workoutId} />;
}
