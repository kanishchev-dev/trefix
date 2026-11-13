"use client";

import { use, type ReactElement } from "react";

import { UserTrainingCalendar } from "@/features/training-calendar/components/user-training-calendar";

export default function UserCalendarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <UserTrainingCalendar userId={id} />;
}
