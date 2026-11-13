"use client";

import type { ReactElement } from "react";

import { UserForm } from "@/features/users/components/user-form";
import { useI18n } from "@/shared/i18n";
import { PageHeader } from "@/widgets/page-header";

export default function UserCreatePage(): ReactElement {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t("users.createTitle")} />
      <UserForm mode="create" />
    </div>
  );
}
