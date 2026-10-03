"use client";

import Link from "next/link";
import { Suspense, type ReactElement } from "react";

import { Button } from "@workspace/ui/components/button";
import { PlusIcon } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { GroupsTable } from "@/features/groups/components/groups-table";
import { useI18n } from "@/shared/i18n";
import { PageHeader } from "@/widgets/page-header";
import { TableSkeleton } from "@/widgets/data-state";

export default function GroupsListPage(): ReactElement {
  const { t } = useI18n();
  const { hasPermission } = useAuth();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("groups.listTitle")}
        actions={
          hasPermission("permissions.manage") ? (
            <Button size="sm" render={<Link href="/users/groups/create" />}>
              <PlusIcon />
              {t("groups.createButton")}
            </Button>
          ) : (
            <span />
          )
        }
      />
      <Suspense fallback={<TableSkeleton rows={5} columns={4} />}>
        <GroupsTable />
      </Suspense>
    </div>
  );
}
