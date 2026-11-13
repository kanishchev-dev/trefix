"use client";

import { use } from "react";
import type { ReactElement } from "react";

import { GroupDetail } from "@/features/groups/components/group-detail";
import { useGroup } from "@/features/permissions/hooks/use-permissions";
import { DetailSkeleton, ErrorState } from "@/widgets/data-state";

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  const groupQuery = useGroup(id);

  if (groupQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (groupQuery.isError || !groupQuery.data) {
    return <ErrorState onRetry={() => groupQuery.refetch()} />;
  }

  return <GroupDetail group={groupQuery.data} />;
}
