"use client";

import { use } from "react";
import type { ReactElement } from "react";

import { UserDetail } from "@/features/users/components/user-detail";
import { useUser } from "@/features/users/hooks/use-users";
import { DetailSkeleton, ErrorState } from "@/widgets/data-state";

export default function UserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  const userQuery = useUser(id);

  if (userQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (userQuery.isError || !userQuery.data) {
    return <ErrorState onRetry={() => userQuery.refetch()} />;
  }

  return <UserDetail user={userQuery.data} />;
}
