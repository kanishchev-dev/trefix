"use client";

import type { ReactElement, ReactNode } from "react";

export function PublicShell({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl items-center px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </div>
    </div>
  );
}
