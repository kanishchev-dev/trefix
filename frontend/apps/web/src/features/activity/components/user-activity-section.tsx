"use client";

import { useMemo, useState, type ReactElement } from "react";

import { buttonVariants } from "@trefix/ui/components/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import { DownloadIcon } from "lucide-react";

import { activityExportUrl } from "@/entities/activity/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/shared/i18n";

import { useUserActivity } from "../hooks/use-activity";
import {
  ActivityFilters,
  DEFAULT_ACTIVITY_FILTER,
  toActivityFilter,
  type ActivityFilterState,
} from "./activity-filters";
import { ActivityList } from "./activity-list";

export function UserActivitySection({
  userId,
}: {
  userId: string;
}): ReactElement {
  const { t } = useI18n();
  const [state, setState] = useState<ActivityFilterState>(
    DEFAULT_ACTIVITY_FILTER,
  );
  const debounced = useDebouncedValue(state);
  // The period is counted from the moment the filter changed, not on every render.
  const filter = useMemo(() => toActivityFilter(debounced), [debounced]);
  const query = useUserActivity(userId, filter);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("activity.userTitle")}</CardTitle>
        <CardDescription>{t("activity.userDescription")}</CardDescription>
        <CardAction>
          <a
            href={activityExportUrl(filter, userId)}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <DownloadIcon />
            {t("activity.export")}
          </a>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ActivityFilters value={state} onChange={setState} />
        <ActivityList query={query} />
      </CardContent>
    </Card>
  );
}
