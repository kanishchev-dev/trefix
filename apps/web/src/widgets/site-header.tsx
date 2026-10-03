"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@workspace/ui/components/breadcrumb";
import { Separator } from "@workspace/ui/components/separator";
import { SidebarTrigger } from "@workspace/ui/components/sidebar";

import { useI18n } from "@/shared/i18n";

const BREADCRUMB_KEYS: Array<{ prefix: string; key: string }> = [
  { prefix: "/users/list", key: "breadcrumbs.list" },
  { prefix: "/users/create", key: "breadcrumbs.create" },
  { prefix: "/users/groups", key: "breadcrumbs.groups" },
  { prefix: "/users", key: "breadcrumbs.users" },
  { prefix: "/settings/authentication", key: "breadcrumbs.authentication" },
  { prefix: "/settings", key: "breadcrumbs.settings" },
];

function resolveBreadcrumbKey(pathname: string): string {
  const match = [...BREADCRUMB_KEYS]
    .reverse()
    .find((entry) => pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`));

  return match?.key ?? "breadcrumbs.dashboard";
}

export function SiteHeader(): ReactElement {
  const pathname = usePathname();
  const { t } = useI18n();
  const breadcrumbKey = resolveBreadcrumbKey(pathname);

  return (
    <header className="flex h-16 shrink-0 items-center gap-2">
      <div className="flex w-full items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
        />
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink render={<Link href="/dashboard" />}>
                {t("breadcrumbs.dashboard")}
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t(breadcrumbKey)}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
