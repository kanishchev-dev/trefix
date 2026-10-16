"use client";

import { use, type ReactElement } from "react";

import { UserActivitySection } from "@/features/activity/components/user-activity-section";

export default function UserHistoryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <UserActivitySection userId={id} />;
}
