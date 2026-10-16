"use client";

import { use, type ReactElement } from "react";

import { BroadcastDetail } from "@/features/notifications/components/broadcast-detail";

export default function NotificationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <BroadcastDetail id={id} />;
}
