"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReactElement } from "react";

import { Button } from "@trefix/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@trefix/ui/components/toggle-group";
import { PlusIcon } from "lucide-react";

import { PLANS_LIMIT, type PlanListGroup } from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/shared/i18n";
import { EmptyState, ErrorState, TableSkeleton } from "@/widgets/data-state";

import { usePlanCounts, usePlans } from "../hooks/use-user-plans";
import { PlanListItem } from "./plan-list-item";

const PLAN_GROUPS: readonly PlanListGroup[] = ["active", "draft", "history"];

/** Query parameters of the plans tab: they live in the URL like the tab itself. */
export const PLANS_GROUP_PARAM = "group";
export const PLANS_PAGE_PARAM = "page";

const isGroup = (value: string | null): value is PlanListGroup =>
  value !== null && (PLAN_GROUPS as readonly string[]).includes(value);

/** Plans library of a user in the admin panel: grouped like in the app, with create. */
export function UserPlansPanel({ userId }: { userId: string }): ReactElement {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const requestedGroup = searchParams.get(PLANS_GROUP_PARAM);
  const group: PlanListGroup = isGroup(requestedGroup)
    ? requestedGroup
    : "active";
  const page = Math.max(
    1,
    Number(searchParams.get(PLANS_PAGE_PARAM) ?? "1") || 1,
  );

  const countsQuery = usePlanCounts(userId);
  const plansQuery = usePlans(userId, group, page);
  const canManage = hasPermission("training.userplans.manage");

  const counts = countsQuery.data;
  const total = counts ? counts.draft + counts.active + counts.history : 0;
  const limitReached = total >= PLANS_LIMIT;

  const navigate = (next: { group?: PlanListGroup; page?: number }) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(PLANS_GROUP_PARAM, next.group ?? group);
    if (next.page && next.page > 1) {
      params.set(PLANS_PAGE_PARAM, String(next.page));
    } else {
      params.delete(PLANS_PAGE_PARAM);
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const items = plansQuery.data?.items ?? [];
  const meta = plansQuery.data?.meta;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userPlans.title")}</CardTitle>
        <CardDescription>
          {limitReached
            ? t("userPlans.list.limitReached", { max: PLANS_LIMIT })
            : t("userPlans.description")}
        </CardDescription>
        {canManage ? (
          <CardAction>
            {limitReached ? (
              <Button size="sm" disabled>
                <PlusIcon />
                {t("userPlans.actions.create")}
              </Button>
            ) : (
              <Button
                size="sm"
                render={<Link href={`/users/${userId}/plans/create`} />}
              >
                <PlusIcon />
                {t("userPlans.actions.create")}
              </Button>
            )}
          </CardAction>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ToggleGroup
          variant="outline"
          spacing={0}
          value={[group]}
          onValueChange={(value: string[]) => {
            const next = value[0] ?? null;
            if (isGroup(next)) {
              navigate({ group: next, page: 1 });
            }
          }}
          aria-label={t("userPlans.list.groupLabel")}
        >
          {PLAN_GROUPS.map((item) => (
            <ToggleGroupItem key={item} value={item}>
              {t(`userPlans.groups.${item}`)}
              {counts ? (
                <span className="tabular-nums text-muted-foreground">
                  {counts[item]}
                </span>
              ) : null}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>

        {plansQuery.isLoading ? (
          <TableSkeleton rows={3} columns={1} />
        ) : plansQuery.isError ? (
          <ErrorState onRetry={() => plansQuery.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            title={t(`userPlans.empty.${group}.title`)}
            description={t(`userPlans.empty.${group}.description`)}
          />
        ) : (
          <ul className="-mx-3 flex flex-col">
            {items.map((plan) => (
              <PlanListItem key={plan.id} userId={userId} plan={plan} />
            ))}
          </ul>
        )}

        {meta && (meta.page > 1 || meta.hasNext) ? (
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">
              {t("common.pagination.page", {
                page: meta.page,
                totalPages: Math.max(1, Math.ceil(meta.total / meta.limit)),
              })}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={meta.page <= 1}
                onClick={() => navigate({ page: page - 1 })}
              >
                {t("common.table.previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!meta.hasNext}
                onClick={() => navigate({ page: page + 1 })}
              >
                {t("common.table.next")}
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
