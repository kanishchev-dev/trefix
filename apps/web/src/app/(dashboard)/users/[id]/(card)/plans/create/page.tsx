"use client";

import { use, type ReactElement } from "react";

import { PlanCreateScreen } from "@/features/training-plans/components/plan-screens";

export default function UserPlanCreatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  return <PlanCreateScreen userId={id} />;
}
