"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement } from "react";

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@trefix/ui/components/navigation-menu";
import { cn } from "@trefix/ui/lib/utils";

import { useAuth } from "@/components/auth-provider";
import {
  USER_SECTION_GROUPS,
  USER_SECTIONS,
  canSeeSection,
  resolveUserSection,
  userSectionHref,
  type UserSection,
} from "@/features/users/lib/user-sections";
import { useI18n } from "@/shared/i18n";

/**
 * Section menu of a user's card: top-level links for the overview and the
 * history, grouped panels for the rest. The open group shows the current
 * section next to its name so the place is clear without opening the panel.
 */
export function UserSectionNav({ userId }: { userId: string }): ReactElement {
  const pathname = usePathname();
  const { t } = useI18n();
  const { hasPermission } = useAuth();

  const active = resolveUserSection(pathname);
  const visible = USER_SECTIONS.filter((section) =>
    canSeeSection(section, hasPermission),
  );
  const activeSection = visible.find((section) => section.key === active);

  const topLink = (section: UserSection): ReactElement => (
    <NavigationMenuItem key={section.key}>
      <NavigationMenuLink
        active={section.key === active}
        render={<Link href={userSectionHref(userId, section.key)} />}
        className="h-9 px-3"
      >
        {t(`userCard.sections.${section.key}.title`)}
      </NavigationMenuLink>
    </NavigationMenuItem>
  );

  const overview = visible.find((section) => section.key === "overview");
  const history = visible.find((section) => section.key === "history");

  return (
    <div className="border-b pb-2">
      <NavigationMenu aria-label={t("userCard.nav.label")}>
        <NavigationMenuList className="flex-wrap justify-start gap-1">
          {overview ? topLink(overview) : null}
          {USER_SECTION_GROUPS.map((group) => {
            const sections = visible.filter(
              (section) => section.group === group,
            );
            if (sections.length === 0) {
              return null;
            }
            const isActiveGroup = activeSection?.group === group;
            return (
              <NavigationMenuItem key={group}>
                <NavigationMenuTrigger
                  className={cn(isActiveGroup && "bg-muted text-foreground")}
                >
                  {t(`userCard.groups.${group}`)}
                  {isActiveGroup && activeSection ? (
                    <span className="ml-1 font-normal whitespace-nowrap text-muted-foreground">
                      · {t(`userCard.sections.${activeSection.key}.title`)}
                    </span>
                  ) : null}
                </NavigationMenuTrigger>
                <NavigationMenuContent>
                  <ul className="grid w-[min(34rem,calc(100vw-2rem))] gap-1 sm:grid-cols-2">
                    {sections.map((section) => (
                      <li key={section.key}>
                        <NavigationMenuLink
                          active={section.key === active}
                          render={
                            <Link href={userSectionHref(userId, section.key)} />
                          }
                          className="flex-col items-start gap-0.5"
                        >
                          <span className="font-medium whitespace-nowrap">
                            {t(`userCard.sections.${section.key}.title`)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {t(`userCard.sections.${section.key}.description`)}
                          </span>
                        </NavigationMenuLink>
                      </li>
                    ))}
                  </ul>
                </NavigationMenuContent>
              </NavigationMenuItem>
            );
          })}
          {history ? topLink(history) : null}
        </NavigationMenuList>
      </NavigationMenu>
    </div>
  );
}
