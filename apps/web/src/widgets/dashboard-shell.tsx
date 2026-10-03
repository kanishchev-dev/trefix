"use client";

import type { ReactElement, ReactNode } from "react";

import { Separator } from "@workspace/ui/components/separator";
import {
  SidebarInset,
  SidebarProvider,
} from "@workspace/ui/components/sidebar";

import { AppSidebar } from "@/widgets/app-sidebar";
import { SiteHeader } from "@/widgets/site-header";

export function DashboardShell({
  children,
}: {
  children: ReactNode;
}): ReactElement {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <SiteHeader />
        <Separator className="data-horizontal:opacity-40" />
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
