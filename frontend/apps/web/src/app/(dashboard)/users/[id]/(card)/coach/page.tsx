"use client";

import { use, type ReactElement } from "react";

import { UserCoachSection } from "@/features/user-coach/components/user-coach-section";

export default function UserCoachPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <UserCoachSection userId={id} />;
}
