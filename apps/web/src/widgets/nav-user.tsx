"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import type { ReactElement } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@workspace/ui/components/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@workspace/ui/components/sidebar";
import {
  CheckIcon,
  ChevronsUpDownIcon,
  LanguagesIcon,
  LogOutIcon,
  MonitorIcon,
  MoonIcon,
  SunIcon,
  UserRoundIcon,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { RealtimeStatusIndicator } from "@/shared/api/realtime-status";
import { useI18n, type Locale } from "@/shared/i18n";
import { useAppSettings, type ThemeMode } from "@/shared/state/app-settings-provider";

const THEME_OPTIONS: { value: ThemeMode; icon: ReactElement }[] = [
  { value: "system", icon: <MonitorIcon /> },
  { value: "light", icon: <SunIcon /> },
  { value: "dark", icon: <MoonIcon /> },
];

export function NavUser(): ReactElement {
  const { isMobile } = useSidebar();
  const { user, signOut, hasPermission } = useAuth();
  const { theme, setTheme } = useAppSettings();
  const { locale, setLocale, t } = useI18n();
  const router = useRouter();
  const activeThemeOption = THEME_OPTIONS.find((option) => option.value === theme);

  const displayName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email
    : "";
  const fallbackInitials = displayName.slice(0, 2).toUpperCase();

  const signOutMutation = useMutation({
    mutationFn: async () => {
      await signOut();
      router.replace("/login");
    },
  });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="aria-expanded:bg-muted"
              />
            }
          >
            <Avatar>
              <AvatarImage
                src={user?.avatarUrl ?? undefined}
                alt={displayName}
              />
              <AvatarFallback>{fallbackInitials || "U"}</AvatarFallback>
            </Avatar>
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{displayName}</span>
              <span className="truncate text-xs">{user?.email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <Avatar>
                    <AvatarImage
                      src={user?.avatarUrl ?? undefined}
                      alt={displayName}
                    />
                    <AvatarFallback>{fallbackInitials || "U"}</AvatarFallback>
                  </Avatar>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-medium">{displayName}</span>
                    <span className="truncate text-xs">{user?.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  {activeThemeOption?.icon}
                  {t("sidebar.theme")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {THEME_OPTIONS.map((option) => (
                    <DropdownMenuItem
                      key={option.value}
                      onClick={() => setTheme(option.value)}
                    >
                      <CheckIcon
                        className={
                          option.value === theme ? "opacity-100" : "opacity-0"
                        }
                      />
                      {t(`sidebar.theme${option.value[0].toUpperCase()}${option.value.slice(1)}`)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuGroup>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <LanguagesIcon />
                  {t("sidebar.language")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {( ["ru", "en"] as Locale[] ).map((option) => (
                    <DropdownMenuItem
                      key={option}
                      onClick={() => setLocale(option)}
                    >
                      <CheckIcon
                        className={option === locale ? "opacity-100" : "opacity-0"}
                      />
                      {option === "ru"
                        ? t("sidebar.languageRussian")
                        : t("sidebar.languageEnglish")}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <RealtimeStatusIndicator />
            <DropdownMenuSeparator />
            {hasPermission("account.update") ? (
              <DropdownMenuItem onClick={() => router.push("/profile")}>
                <UserRoundIcon />
                {t("sidebar.profile")}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem
              onClick={() => signOutMutation.mutate()}
              disabled={signOutMutation.isPending}
            >
              <LogOutIcon />
              {t("sidebar.signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
