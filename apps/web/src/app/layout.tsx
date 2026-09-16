import type { Metadata } from "next";
import type { ReactElement, ReactNode } from "react";

import { appName } from "@workspace/config";

import { Providers } from "@/components/providers";

import "./globals.css";

export const metadata: Metadata = {
  title: appName,
  description: "Admin frontend for Trefix",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    <html lang="ru">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
