import type { ReactElement, ReactNode } from "react";

import { DashboardShell } from "@/widgets/dashboard-shell";
import { DashboardGate } from "@/widgets/dashboard-gate";

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <DashboardShell>
      <DashboardGate>{children}</DashboardGate>
    </DashboardShell>
  );
}
