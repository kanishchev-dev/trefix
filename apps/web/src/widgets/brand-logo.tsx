"use client";

import Image from "next/image";
import type { ReactElement } from "react";

const LOGO_LIGHT_THEME = "/brand/trefix-logo-dark.png";
const LOGO_DARK_THEME = "/brand/trefix-logo-light.png";

/**
 * TREFIX wordmark for the sidebar header.
 *
 * Two bitmap variants are shipped because the artwork is a solid-colour word:
 * one for light surfaces, one for dark.
 *
 * Both are rendered and swapped with a `dark:` variant instead of picking one
 * in JavaScript. Picking in JS means the markup depends on the resolved theme,
 * which the server cannot know — that produced a hydration mismatch — and a
 * dark-themed user would get a black logo on a dark sidebar until hydration.
 * The `dark` class is set on <html> by the inline script in `app/layout.tsx`
 * while the document is still parsing, so the right artwork shows immediately
 * and both server and client render identical markup.
 *
 * The wordmark sits in a fixed-height box with `object-contain` so it stays
 * correct regardless of the aspect ratio and padding of the exported file.
 */
export function BrandLogo({
  className,
  height = 28,
}: {
  className?: string;
  height?: number;
}): ReactElement {
  return (
    <span className={`flex items-center ${className ?? ""}`} style={{ height }}>
      <Image
        src={LOGO_LIGHT_THEME}
        alt="TREFIX"
        width={220}
        height={48}
        priority
        className="h-full w-auto max-w-full object-contain dark:hidden"
      />
      <Image
        src={LOGO_DARK_THEME}
        alt=""
        aria-hidden
        width={220}
        height={48}
        className="hidden h-full w-auto max-w-full object-contain dark:block"
      />
    </span>
  );
}
