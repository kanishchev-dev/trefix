"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, type ReactElement } from "react";

import { Button } from "@trefix/ui/components/button";
import { ArrowLeftIcon, InfoIcon } from "lucide-react";

import { ApiClientError, type PlanDetails } from "@trefix/api-client";

import { getBrowserTimezone } from "@/features/training-calendar/lib/calendar-dates";
import { useUser } from "@/features/users/hooks/use-users";
import { useI18n } from "@/shared/i18n";
import { DetailSkeleton, ErrorState } from "@/widgets/data-state";

import {
  useCurrentMetrics,
  usePlan,
  useRebuildPrefill,
} from "../hooks/use-user-plans";
import {
  getDefaultWizardValues,
  metricsFromCurrent,
  valuesFromRebuildPrefill,
} from "../lib/plan-wizard-form";
import { planTitle } from "../lib/plan-texts";
import { PlanWizard } from "../wizard/plan-wizard";
import { PlanDetailsView } from "./plan-details-view";

const isNotFound = (error: unknown): boolean =>
  error instanceof ApiClientError && error.status === 404;

function ScreenHeader({
  userId,
  title,
  subtitle,
}: {
  userId: string;
  title: string;
  subtitle?: string;
}): ReactElement {
  const { t } = useI18n();
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="w-fit"
        render={<Link href={`/users/${userId}?tab=plans`} />}
      >
        <ArrowLeftIcon />
        {t("userPlans.actions.backToPlans")}
      </Button>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? (
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

function useUserDisplayName(userId: string): string | undefined {
  const userQuery = useUser(userId);
  const user = userQuery.data;
  return user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : undefined;
}

function NoAthleteProfile(): ReactElement {
  const { t } = useI18n();
  return (
    <p className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
      <InfoIcon className="size-4 shrink-0" />
      {t("trainingCalendar.noAthleteProfile")}
    </p>
  );
}

export function PlanDetailsScreen({
  userId,
  planId,
}: {
  userId: string;
  planId: string;
}): ReactElement {
  const { t } = useI18n();
  const planQuery = usePlan(userId, planId);

  if (planQuery.isLoading) return <DetailSkeleton />;
  if (isNotFound(planQuery.error)) {
    return (
      <div className="flex flex-col gap-4">
        <ScreenHeader userId={userId} title={t("userPlans.errors.notFound")} />
      </div>
    );
  }
  if (planQuery.isError || !planQuery.data)
    return <ErrorState onRetry={() => planQuery.refetch()} />;

  return <PlanDetailsView userId={userId} plan={planQuery.data} />;
}

export function PlanCreateScreen({ userId }: { userId: string }): ReactElement {
  const { t } = useI18n();
  const router = useRouter();
  const userName = useUserDisplayName(userId);
  const metricsQuery = useCurrentMetrics(userId);

  const initialValues = useMemo(() => {
    const defaults = getDefaultWizardValues();
    return metricsQuery.data
      ? { ...defaults, metrics: metricsFromCurrent(metricsQuery.data) }
      : defaults;
  }, [metricsQuery.data]);

  const onSaved = (plan: PlanDetails) =>
    router.push(`/users/${userId}/plans/${plan.id}`);

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        userId={userId}
        title={t("userPlans.wizard.createTitle")}
        subtitle={userName}
      />
      {metricsQuery.isLoading ? (
        <DetailSkeleton />
      ) : isNotFound(metricsQuery.error) ? (
        <NoAthleteProfile />
      ) : metricsQuery.isError ? (
        <ErrorState onRetry={() => metricsQuery.refetch()} />
      ) : (
        <PlanWizard
          userId={userId}
          initialValues={initialValues}
          currentMetrics={metricsQuery.data}
          onSaved={onSaved}
        />
      )}
    </div>
  );
}

export function PlanRebuildScreen({
  userId,
  planId,
}: {
  userId: string;
  planId: string;
}): ReactElement {
  const { t, locale } = useI18n();
  const router = useRouter();
  const timezone = useMemo(() => getBrowserTimezone(), []);
  const planQuery = usePlan(userId, planId);
  const prefillQuery = useRebuildPrefill(userId, planId, timezone);

  const plan = planQuery.data;
  const prefill = prefillQuery.data;
  const initialValues = useMemo(
    () =>
      prefill && plan ? valuesFromRebuildPrefill(prefill, plan.name) : null,
    [prefill, plan],
  );

  if (planQuery.isLoading || prefillQuery.isLoading) return <DetailSkeleton />;
  if (
    planQuery.isError ||
    prefillQuery.isError ||
    !plan ||
    !prefill ||
    !initialValues
  ) {
    return (
      <ErrorState
        onRetry={() => {
          void planQuery.refetch();
          void prefillQuery.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <ScreenHeader
        userId={userId}
        title={t("userPlans.rebuild.title")}
        subtitle={t("userPlans.rebuild.subtitle", {
          name: planTitle(plan, t, locale),
        })}
      />
      <PlanWizard
        userId={userId}
        initialValues={initialValues}
        currentMetrics={prefill.metrics.current}
        rebuildSource={plan}
        onSaved={(saved) => router.push(`/users/${userId}/plans/${saved.id}`)}
      />
    </div>
  );
}
