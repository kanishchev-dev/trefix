"use client";

import { useMemo, useState, type ReactElement } from "react";

import { buttonVariants } from "@trefix/ui/components/button";
import { Card, CardContent } from "@trefix/ui/components/card";
import { DownloadIcon } from "lucide-react";

import {
  activityExportUrl,
  type ActivityLogFilter,
} from "@/entities/activity/api";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useI18n } from "@/shared/i18n";
import { OptionSelect } from "@/widgets/option-select";
import { PageHeader } from "@/widgets/page-header";

import { useActivityLog } from "../hooks/use-activity";
import {
  ActivityFilters,
  DEFAULT_ACTIVITY_FILTER,
  toActivityFilter,
  type ActivityFilterState,
} from "./activity-filters";
import { ActivityList } from "./activity-list";

type Kind = NonNullable<ActivityLogFilter["kind"]>;
const KINDS: readonly Kind[] = ["admin", "data_access", "all"];

/** Log of what admins did and which personal data they opened. */
export function AuditLog(): ReactElement {
  const { t } = useI18n();
  const [kind, setKind] = useState<Kind>("admin");
  const [state, setState] = useState<ActivityFilterState>(
    DEFAULT_ACTIVITY_FILTER,
  );
  const debounced = useDebouncedValue(state);
  const filter = useMemo<ActivityLogFilter>(
    () => ({ ...toActivityFilter(debounced), kind }),
    [debounced, kind],
  );
  const query = useActivityLog(filter);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("activity.auditTitle")}
        description={t("activity.auditDescription")}
        actions={
          <a
            href={activityExportUrl(filter)}
            download
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <DownloadIcon />
            {t("activity.export")}
          </a>
        }
      />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <ActivityFilters value={state} onChange={setState}>
            <div className="w-48">
              <OptionSelect
                value={kind}
                options={KINDS.map((value) => ({
                  value,
                  label: t(`activity.kinds.${value}`),
                }))}
                onValueChange={setKind}
              />
            </div>
          </ActivityFilters>
          <ActivityList query={query} showSubject />
        </CardContent>
      </Card>
    </div>
  );
}
