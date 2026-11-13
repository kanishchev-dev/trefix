"use client";

import { use, type ReactElement } from "react";

import { UserProgressSection } from "@/features/user-athlete/components/user-progress-section";

export default function UserProgressPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <UserProgressSection userId={id} />;
}
