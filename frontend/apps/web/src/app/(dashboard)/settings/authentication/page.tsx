"use client";

import type { ReactElement } from "react";

import { AuthenticationSettings } from "@/features/settings/components/authentication-settings";
import { useI18n } from "@/shared/i18n";
import { PageHeader } from "@/widgets/page-header";

export default function SettingsAuthenticationPage(): ReactElement {
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("settings.authentication.title")}
        description={t("settings.authentication.description")}
      />
      <AuthenticationSettings />
    </div>
  );
}
