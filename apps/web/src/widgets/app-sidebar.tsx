"use client";

import type { ReactElement } from "react";

import { LayoutDashboardIcon, SettingsIcon, UsersIcon } from "lucide-react";
import { Skeleton } from "@workspace/ui/components/skeleton";

import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/widgets/brand-logo";
import { NavMain, type NavMainItem } from "@/widgets/nav-main";
import { NavUser } from "@/widgets/nav-user";
import { useI18n } from "@/shared/i18n";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@workspace/ui/components/sidebar";

type NavigationNode = {
  titleKey: string;
  url: string;
  icon: React.ReactNode;
  requiredPermissions: string[];
  items?: {
    titleKey: string;
    url: string;
    requiredPermissions: string[];
  }[];
};

const NAVIGATION: NavigationNode[] = [
  {
    titleKey: "sidebar.dashboard",
    url: "/dashboard",
    icon: <LayoutDashboardIcon />,
    requiredPermissions: [],
  },
  {
    titleKey: "sidebar.users",
    url: "/users/list",
    icon: <UsersIcon />,
    requiredPermissions: ["users.read"],
    items: [
      {
        titleKey: "sidebar.userList",
        url: "/users/list",
        requiredPermissions: ["users.read"],
      },
      {
        titleKey: "sidebar.userGroups",
        url: "/users/groups",
        requiredPermissions: ["permissions.read"],
      },
    ],
  },
  {
    titleKey: "sidebar.settings",
    url: "/settings/authentication",
    icon: <SettingsIcon />,
    requiredPermissions: [],
    items: [
      {
        titleKey: "sidebar.authentication",
        url: "/settings/authentication",
        requiredPermissions: ["permissions.read"],
      },
    ],
  },
];

function hasPermission(userPermissions: string[], required: string[]): boolean {
  if (required.length === 0) {
    return true;
  }

  return required.some((permission) => userPermissions.includes(permission));
}

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>): ReactElement {
  const { permissions, status } = useAuth();
  const { t } = useI18n();

  /**
   * The navigation is filtered by permission, and permission only exists once
   * the session has been resolved.
   *
   * Filtering earlier — which is what rendering straight from `permissions`
   * did — shows only the entries that require nothing at all, so the first
   * paint of every fresh login was missing sections until something forced a
   * reload. A placeholder is honest about not knowing yet and keeps the
   * sidebar from jumping when the real items arrive.
   */
  const isResolvingSession = status === "loading";

  const visibleItems: NavMainItem[] = isResolvingSession
    ? []
    : NAVIGATION.filter((node) =>
        hasPermission(permissions, node.requiredPermissions),
      ).map((node) => ({
        title: t(node.titleKey),
        url: node.url,
        icon: node.icon,
        items: node.items
          ?.filter((child) =>
            hasPermission(permissions, child.requiredPermissions),
          )
          .map((child) => ({ title: t(child.titleKey), url: child.url })),
      }));

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              size="lg"
              className="hover:bg-transparent"
              render={<a href="/dashboard" aria-label={t("common.appName")} />}
            >
              <BrandLogo className="w-full" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {isResolvingSession ? (
          <SidebarGroup>
            <SidebarGroupLabel>{t("sidebar.navigation")}</SidebarGroupLabel>
            <SidebarMenu>
              {[0, 1, 2].map((row) => (
                <SidebarMenuItem key={row}>
                  <SidebarMenuButton className="pointer-events-none">
                    <Skeleton className="size-4 rounded-full" />
                    <Skeleton className="h-4 w-32" />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        ) : (
          <NavMain items={visibleItems} label={t("sidebar.navigation")} />
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
