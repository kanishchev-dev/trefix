"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactElement } from "react";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@workspace/ui/components/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@workspace/ui/components/sidebar";
import { ChevronRightIcon } from "lucide-react";

export type NavMainItem = {
  title: string;
  url: string;
  icon: React.ReactNode;
  items?: { title: string; url: string }[];
};

export function NavMain({
  items,
  label,
}: {
  items: NavMainItem[];
  label: string;
}): ReactElement {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => (
          <NavMainItemRow key={item.title} item={item} />
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function isItemActive(pathname: string, url: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`);
}

/**
 * Whether a section should open itself on this render.
 *
 * Extracted as a pure function so the rule is testable without mounting the
 * sidebar, which is where the regression it guards against lived: it is a
 * render-time decision, so a mistake in it silently produces a menu that never
 * completes.
 */
export function shouldAutoOpenSection({
  hasChildren,
  justGainedChildren,
  isActive,
  open,
  userToggled,
}: {
  hasChildren: boolean;
  justGainedChildren: boolean;
  isActive: boolean;
  open: boolean;
  userToggled: boolean;
}): boolean {
  if (userToggled || !hasChildren || open) {
    return false;
  }

  return isActive || justGainedChildren;
}

/**
 * One sidebar row, with its collapsible section.
 *
 * The section is controlled rather than initialized with `defaultOpen`. Route
 * changes flip `isActive`, and feeding that into `defaultOpen` of an already
 * mounted uncontrolled collapsible is what Base UI warns about — it fired on
 * every navigation, even for items that have no submenu at all.
 *
 * Entering a section opens it, and the user stays free to collapse it again:
 * the state is adjusted during render (React's recommended alternative to an
 * effect) and never forced back open while the route stays the same.
 *
 * A section that only *gains* children once the session is resolved also opens
 * itself. Its initial `open` was computed from a permission list that was still
 * empty, so it stayed collapsed and its submenu never appeared — the menu looked
 * permanently incomplete until a reload, by which point the permissions were
 * there on the very first render. Once the user touches it themselves, their
 * choice wins.
 */
function NavMainItemRow({ item }: { item: NavMainItem }): ReactElement {
  const pathname = usePathname();
  const isActive = isItemActive(pathname, item.url);
  const hasChildren = Boolean(item.items?.length);
  const [open, setOpen] = useState(hasChildren && isActive);
  const [userToggled, setUserToggled] = useState(false);
  const [hadChildren, setHadChildren] = useState(hasChildren);

  const justGainedChildren = hasChildren && !hadChildren;

  if (hadChildren !== hasChildren) {
    setHadChildren(hasChildren);
  }

  if (
    shouldAutoOpenSection({
      hasChildren,
      justGainedChildren,
      isActive,
      open,
      userToggled,
    })
  ) {
    setOpen(true);
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={(next: boolean) => {
        setUserToggled(true);
        setOpen(next);
      }}
      render={<SidebarMenuItem />}
    >
      <SidebarMenuButton
        tooltip={item.title}
        isActive={isActive}
        render={<Link href={item.url} />}
      >
        {item.icon}
        <span>{item.title}</span>
      </SidebarMenuButton>
      {hasChildren ? (
        <>
          <CollapsibleTrigger
            render={
              <SidebarMenuAction className="aria-expanded:rotate-90" />
            }
          >
            <ChevronRightIcon />
            <span className="sr-only">Toggle</span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <SidebarMenuSub>
              {item.items?.map((subItem) => (
                <SidebarMenuSubItem key={subItem.url}>
                  <SidebarMenuSubButton
                    isActive={isItemActive(pathname, subItem.url)}
                    render={<Link href={subItem.url} />}
                  >
                    <span>{subItem.title}</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </>
      ) : null}
    </Collapsible>
  );
}
