"use client";

import { Suspense, type ReactElement } from "react";

import { useAuth } from "@/components/auth-provider";
import { AnalyticsDashboard } from "@/features/analytics/components/analytics-dashboard";
import { AnalyticsWelcome } from "@/features/analytics/components/analytics-welcome";
import { DetailSkeleton } from "@/widgets/data-state";

export default function DashboardPage(): ReactElement {
  const { hasPermission } = useAuth();

  if (!hasPermission("analytics.read")) {
    return <AnalyticsWelcome />;
  }

  return (
    <Suspense fallback={<DetailSkeleton />}>
      <AnalyticsDashboard />
    </Suspense>
  );
}
