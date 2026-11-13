"use client";

import { use } from "react";
import type { ReactElement } from "react";

import { GroupForm } from "@/features/groups/components/group-form";
import { useGroup } from "@/features/permissions/hooks/use-permissions";
import { useI18n } from "@/shared/i18n";
import { DetailSkeleton, ErrorState } from "@/widgets/data-state";
import { PageHeader } from "@/widgets/page-header";

export default function GroupEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  const { t } = useI18n();
  const groupQuery = useGroup(id);

  if (groupQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (groupQuery.isError || !groupQuery.data) {
    return <ErrorState onRetry={() => groupQuery.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("groups.editTitle")} />
      <GroupForm group={groupQuery.data} mode="edit" />
    </div>
  );
}
