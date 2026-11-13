"use client";

import { use, type ReactElement } from "react";

import { UserNotificationsSection } from "@/features/notifications/components/user-notifications-section";

export default function UserNotificationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <UserNotificationsSection userId={id} />;
}
