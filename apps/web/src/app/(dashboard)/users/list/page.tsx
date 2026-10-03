"use client";

import { Suspense, type ReactElement } from "react";

import { CreateUserButton } from "@/features/users/components/create-user-button";
import { UsersTable } from "@/features/users/components/users-table";
import { useI18n } from "@/shared/i18n";
import { PageHeader } from "@/widgets/page-header";
import { TableSkeleton } from "@/widgets/data-state";

export default function UsersListPage(): ReactElement {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("users.listTitle")}
        actions={<CreateUserButton />}
      />
      <Suspense fallback={<TableSkeleton rows={6} columns={4} />}>
        <UsersTable />
      </Suspense>
    </div>
  );
}
