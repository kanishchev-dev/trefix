"use client";

import { use, type ReactElement } from "react";

import { UserPlansPanel } from "@/features/training-plans/components/user-plans-panel";
import { PendingAdaptationsCard } from "@/features/user-workout/components/pending-adaptations-card";

export default function UserPlansPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return (
    <>
      <PendingAdaptationsCard userId={id} />
      <UserPlansPanel userId={id} />
    </>
  );
}
