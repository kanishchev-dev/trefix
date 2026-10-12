"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, type ReactElement } from "react";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@trefix/ui/components/breadcrumb";
import { Separator } from "@trefix/ui/components/separator";
import { SidebarTrigger } from "@trefix/ui/components/sidebar";

import { useI18n } from "@/shared/i18n";

export interface BreadcrumbItemDef {
  key: string;
  href?: string;
}

export function resolveBreadcrumbs(pathname: string): BreadcrumbItemDef[] {
  if (pathname === "/dashboard" || pathname === "/") {
    return [{ key: "breadcrumbs.dashboard" }];
  }

  if (pathname.startsWith("/profile")) {
    return [{ key: "breadcrumbs.profile" }];
  }

  if (pathname === "/settings") {
    return [{ key: "breadcrumbs.settings" }];
  }

  if (pathname.startsWith("/settings/authentication")) {
    return [
      { key: "breadcrumbs.settings", href: "/settings" },
      { key: "breadcrumbs.authentication" },
    ];
  }

  if (pathname.startsWith("/users/groups")) {
    const items: BreadcrumbItemDef[] = [
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.groups", href: "/users/groups" },
    ];
    if (pathname === "/users/groups/create") {
      items.push({ key: "breadcrumbs.create" });
    } else if (pathname.endsWith("/edit")) {
      items.push({ key: "breadcrumbs.edit" });
    }
    return items;
  }

  const planMatch = /^\/users\/([^/]+)\/plans\/([^/]+)(\/rebuild)?\/?$/.exec(
    pathname,
  );
  if (planMatch) {
    const [, userId, planSegment, rebuild] = planMatch;
    const items: BreadcrumbItemDef[] = [
      { key: "breadcrumbs.users", href: "/users/list" },
      { key: "breadcrumbs.user", href: `/users/${userId}` },
      { key: "breadcrumbs.plans", href: `/users/${userId}?tab=plans` },
    ];
    if (planSegment === "create") {
      items.push({ key: "breadcrumbs.createPlan" });
    } else if (rebuild) {
      items.push({
        key: "breadcrumbs.plan",
        href: `/users/${userId}/plans/${planSegment}`,
      });
      items.push({ key: "breadcrumbs.rebuild" });
    } else {
      items.push({ key: "breadcrumbs.plan" });
    }
    return items;
  }

  if (pathname.startsWith("/users")) {
    const items: BreadcrumbItemDef[] = [
      { key: "breadcrumbs.users", href: "/users/list" },
    ];
    if (pathname === "/users/list" || pathname === "/users") {
      items.push({ key: "breadcrumbs.list" });
    } else if (pathname === "/users/create") {
      items.push({ key: "breadcrumbs.create" });
    } else if (pathname.endsWith("/edit")) {
      items.push({ key: "breadcrumbs.edit" });
    }
    return items;
  }

  return [{ key: "breadcrumbs.dashboard" }];
}

export function SiteHeader(): ReactElement {
  const pathname = usePathname();
  const { t } = useI18n();
  const breadcrumbs = resolveBreadcrumbs(pathname);

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
            {breadcrumbs.map((item, index) => {
              const isLast = index === breadcrumbs.length - 1;
              return (
                <Fragment key={`${item.key}-${index}`}>
                  <BreadcrumbItem>
                    {isLast || !item.href ? (
                      <BreadcrumbPage>{t(item.key)}</BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink render={<Link href={item.href} />}>
                        {t(item.key)}
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
    </header>
  );
}
