"use client";

import type { ReactElement } from "react";

import {
  LayoutDashboardIcon,
  SettingsIcon,
  UsersIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { BrandLogo } from "@/widgets/brand-logo";
import { NavMain, type NavMainItem } from "@/widgets/nav-main";
import { NavUser } from "@/widgets/nav-user";
import { useI18n } from "@/shared/i18n";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
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

function hasPermission(
  userPermissions: string[],
  required: string[],
): boolean {
  if (required.length === 0) {
    return true;
  }

  return required.some((permission) => userPermissions.includes(permission));
}

export function AppSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>): ReactElement {
  const { permissions } = useAuth();
  const { t } = useI18n();

  const visibleItems: NavMainItem[] = NAVIGATION.filter((node) =>
    hasPermission(permissions, node.requiredPermissions),
  ).map((node) => ({
    title: t(node.titleKey),
    url: node.url,
    icon: node.icon,
    items: node.items
      ?.filter((child) => hasPermission(permissions, child.requiredPermissions))
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
        <NavMain items={visibleItems} label={t("sidebar.navigation")} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
