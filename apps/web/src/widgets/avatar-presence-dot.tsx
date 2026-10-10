"use client";

import type { ReactElement } from "react";

/**
 * Small status dot meant to sit on the corner of an avatar.
 *
 * Renders nothing at all when the user is offline: a permanent dot on every
 * row makes the table harder to scan and draws the eye to accounts nobody is
 * using, which is the opposite of what presence is for.
 *
 * Rendered as an absolutely positioned sibling rather than inside the avatar,
 * because the avatar clips its own children to a rounded square and the dot
 * would be cut in half.
 */
export function AvatarPresenceDot({
  online,
  label,
  className = "size-2.5",
}: {
  online: boolean;
  label: string;
  className?: string;
}): ReactElement | null {
  if (!online) {
    return null;
  }

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={`absolute right-0 bottom-0 block rounded-full bg-success ring-2 ring-background ${className}`}
    />
  );
}