"use client";

import { use, type ReactElement } from "react";

import { UserAthleteSection } from "@/features/user-athlete/components/user-athlete-section";

export default function UserAthletePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <UserAthleteSection userId={id} />;
}
