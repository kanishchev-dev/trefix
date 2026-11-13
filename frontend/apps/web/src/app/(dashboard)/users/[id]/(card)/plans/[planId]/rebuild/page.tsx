"use client";

import { use, type ReactElement } from "react";

import { PlanRebuildScreen } from "@/features/training-plans/components/plan-screens";

export default function UserPlanRebuildPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}): ReactElement {
  const { id, planId } = use(params);
  return <PlanRebuildScreen userId={id} planId={planId} />;
}
