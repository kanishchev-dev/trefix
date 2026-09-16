import type { ReactElement, ReactNode } from "react";

import { PublicShell } from "@/components/public-shell";

export default function PublicLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return <PublicShell>{children}</PublicShell>;
}
