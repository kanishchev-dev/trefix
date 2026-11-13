"use client";

import Link from "next/link";
import type { ReactElement } from "react";

import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@trefix/ui/components/item";
import {
  BellIcon,
  ChevronRightIcon,
  HistoryIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { useI18n } from "@/shared/i18n";
import { PageHeader } from "@/widgets/page-header";

const LINKS: Array<{
  href: string;
  permission: string;
  key: string;
  icon: LucideIcon;
}> = [
  {
    href: "/users/list",
    permission: "users.read",
    key: "users",
    icon: UsersIcon,
  },
  {
    href: "/notifications",
    permission: "notifications.broadcasts.read",
    key: "notifications",
    icon: BellIcon,
  },
  { href: "/audit", permission: "audit.read", key: "audit", icon: HistoryIcon },
];

/** Start page for administrators without access to analytics. */
export function AnalyticsWelcome(): ReactElement {
  const { t } = useI18n();
  const { hasPermission } = useAuth();
  const links = LINKS.filter((link) => hasPermission(link.permission));
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t("analytics.title")}
        description={t("analytics.welcome")}
      />
      <ItemGroup className="max-w-xl gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Item
              key={link.href}
              variant="muted"
              render={<Link href={link.href} />}
            >
              <ItemMedia variant="icon">
                <Icon />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{t(`analytics.links.${link.key}.title`)}</ItemTitle>
                <ItemDescription>
                  {t(`analytics.links.${link.key}.description`)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <ChevronRightIcon className="size-4 text-muted-foreground" />
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </div>
  );
}
