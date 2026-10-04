"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  useState,
  type ReactElement,
  type ReactNode,
} from "react";

import { Toaster } from "@workspace/ui/components/toast";
import { TooltipProvider } from "@workspace/ui/components/tooltip";

import { AuthProvider } from "@/components/auth-provider";
import { RealtimeProvider } from "@/shared/api/realtime-provider";
import { AppSettingsProvider } from "@/shared/state/app-settings-provider";

export function Providers({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            retry: 1,
            // Left at its default (true) on purpose. Realtime marks a cache
            // stale the moment a change arrives, but a background tab has its
            // requests deprioritised by the browser, so the refetch may not have
            // happened yet. Refetching on focus is what turns that stale mark
            // into fresh data instead of leaving the tab behind until a reload.
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppSettingsProvider>
          <AuthProvider>
            <RealtimeProvider>{children}</RealtimeProvider>
          </AuthProvider>
        </AppSettingsProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
