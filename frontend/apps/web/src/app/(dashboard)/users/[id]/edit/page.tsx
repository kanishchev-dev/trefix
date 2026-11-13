"use client";

import { use } from "react";
import type { ReactElement } from "react";

import { UserForm } from "@/features/users/components/user-form";
import { useUser } from "@/features/users/hooks/use-users";
import { useI18n } from "@/shared/i18n";
import { DetailSkeleton, ErrorState } from "@/widgets/data-state";
import { PageHeader } from "@/widgets/page-header";

export default function UserEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): ReactElement {
  const { id } = use(params);
  const { t } = useI18n();
  const userQuery = useUser(id);

  if (userQuery.isLoading) {
    return <DetailSkeleton />;
  }

  if (userQuery.isError || !userQuery.data) {
    return <ErrorState onRetry={() => userQuery.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("users.editTitle")} />
      <UserForm user={userQuery.data} mode="edit" />
    </div>
  );
}
