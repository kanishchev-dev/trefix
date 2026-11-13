"use client";

import type { ReactElement } from "react";

import { GroupForm } from "@/features/groups/components/group-form";
import { useI18n } from "@/shared/i18n";
import { PageHeader } from "@/widgets/page-header";

export default function GroupCreatePage(): ReactElement {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("groups.createTitle")} />
      <GroupForm mode="create" />
    </div>
  );
}
