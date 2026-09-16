"use client";

import type { ReactElement, ReactNode } from "react";

import { Toaster } from "@workspace/ui/components/toast";
import { TooltipProvider } from "@workspace/ui/components/tooltip";

import { AuthProvider } from "@/components/auth-provider";

export function Providers({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <TooltipProvider>
      <AuthProvider>{children}</AuthProvider>
      <Toaster />
    </TooltipProvider>
  );
}
