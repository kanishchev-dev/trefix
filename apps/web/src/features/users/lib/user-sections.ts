/**
 * Sections of a user's card in the admin panel. One list drives the section
 * menu, the breadcrumbs and the redirect of legacy `?tab=` links.
 */

export type UserSectionKey =
  | "overview"
  | "profile"
  | "access"
  | "account"
  | "athlete"
  | "calendar"
  | "plans"
  | "progress"
  | "gear"
  | "integrations"
  | "coach"
  | "notifications"
  | "history";

export type UserSectionGroup = "account" | "training" | "services";

export type UserSection = {
  key: UserSectionKey;
  /** Path segment after `/users/:id`; empty for the overview. */
  segment: string;
  /** Menu group the section is listed in; null for a top-level link. */
  group: UserSectionGroup | null;
  /** Permissions needed to see the section; any of them is enough. */
  permissions: readonly string[];
};

export const USER_SECTIONS: readonly UserSection[] = [
  { key: "overview", segment: "", group: null, permissions: [] },
  { key: "profile", segment: "profile", group: "account", permissions: [] },
  { key: "access", segment: "access", group: "account", permissions: [] },
  {
    key: "account",
    segment: "account",
    group: "account",
    permissions: ["users.security.read"],
  },
  {
    key: "athlete",
    segment: "athlete",
    group: "training",
    permissions: ["training.userathletes.read"],
  },
  {
    key: "calendar",
    segment: "calendar",
    group: "training",
    permissions: ["training.calendar.read"],
  },
  {
    key: "plans",
    segment: "plans",
    group: "training",
    permissions: ["training.userplans.read"],
  },
  {
    key: "progress",
    segment: "progress",
    group: "training",
    permissions: ["training.userprogress.read"],
  },
  {
    key: "gear",
    segment: "gear",
    group: "training",
    permissions: ["training.usergear.read"],
  },
  {
    key: "integrations",
    segment: "integrations",
    group: "services",
    permissions: ["integrations.users.read"],
  },
  {
    key: "coach",
    segment: "coach",
    group: "services",
    permissions: ["coach.users.read"],
  },
  {
    key: "notifications",
    segment: "notifications",
    group: "services",
    permissions: ["notifications.users.read"],
  },
  {
    key: "history",
    segment: "history",
    group: null,
    permissions: ["users.activity.read"],
  },
];

export const USER_SECTION_GROUPS: readonly UserSectionGroup[] = [
  "account",
  "training",
  "services",
];

export function userSectionHref(
  userId: string,
  section: UserSectionKey,
): string {
  const match = USER_SECTIONS.find((item) => item.key === section);
  return match?.segment
    ? `/users/${userId}/${match.segment}`
    : `/users/${userId}`;
}

/** Workout pages belong to the calendar; unknown paths fall back to the overview. */
export function resolveUserSection(pathname: string): UserSectionKey {
  const segment = pathname.split("/").filter(Boolean)[2] ?? "";
  if (segment === "workouts") {
    return "calendar";
  }
  return (
    USER_SECTIONS.find((item) => item.segment === segment)?.key ?? "overview"
  );
}

export function canSeeSection(
  section: UserSection,
  hasPermission: (permission: string) => boolean,
): boolean {
  return (
    section.permissions.length === 0 ||
    section.permissions.some((permission) => hasPermission(permission))
  );
}

/** Old links used `?tab=`; they keep working by pointing at the new paths. */
const LEGACY_TABS: Record<string, UserSectionKey> = {
  profile: "profile",
  access: "access",
  training: "calendar",
  plans: "plans",
};

export function legacyTabSection(tab: string | null): UserSectionKey | null {
  return tab ? (LEGACY_TABS[tab] ?? null) : null;
}
