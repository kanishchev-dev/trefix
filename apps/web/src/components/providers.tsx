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
            refetchOnWindowFocus: false,
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
