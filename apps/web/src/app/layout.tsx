import type { Metadata } from "next";
import Script from "next/script";
import type { ReactElement, ReactNode } from "react";

import { appName } from "@workspace/config";

import { Providers } from "@/components/providers";
import { DEFAULT_LOCALE } from "@/shared/i18n";

import "./globals.css";

const themeInitScript = `
(function() {
  try {
    var theme = localStorage.getItem('trefix_admin_theme');
    var dark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    if (dark) {
      document.documentElement.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.style.colorScheme = 'light';
    }
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: appName,
  description: "Admin frontend for Trefix",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactElement {
  return (
    // `lang` starts at the default locale and is corrected by the settings
    // provider once the persisted locale is known, so the server markup stays
    // deterministic.
    <html lang={DEFAULT_LOCALE} suppressHydrationWarning>
      <body>
        {/*
          Applies the persisted theme before the first paint. `next/script` is
          used instead of a bare <script> because React never executes script
          tags rendered inside a component on the client, which Next reports as
          an error.
        */}
        <Script
          id="trefix-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
