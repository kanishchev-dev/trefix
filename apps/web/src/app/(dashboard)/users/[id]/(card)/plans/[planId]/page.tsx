"use client";

import { use, type ReactElement } from "react";

import { PlanDetailsScreen } from "@/features/training-plans/components/plan-screens";

export default function UserPlanPage({
  params,
}: {
  params: Promise<{ id: string; planId: string }>;
}): ReactElement {
  const { id, planId } = use(params);
  return <PlanDetailsScreen userId={id} planId={planId} />;
}
