"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import { Button } from "@trefix/ui/components/button";
import { PlusIcon } from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/shared/i18n";

export function CreateUserButton(): ReactElement {
  const { hasPermission } = useAuth();
  const { t } = useI18n();

  if (!hasPermission("users.create")) {
    return <span />;
  }

  return (
    <Button size="sm" render={<Link href="/users/create" />}>
      <PlusIcon />
      {t("users.createButton")}
    </Button>
  );
}
