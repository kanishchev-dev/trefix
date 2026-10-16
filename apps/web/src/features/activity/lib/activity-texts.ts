import type { ActivityItem } from "@trefix/api-client";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

export const ACTIVITY_DOMAINS = [
  "account",
  "access",
  "athlete",
  "workouts",
  "plans",
  "progress",
  "gear",
  "integrations",
  "coach",
  "preferences",
  "data_access",
  "settings",
] as const;

export const ACTIVITY_ACTOR_TYPES = [
  "user",
  "admin",
  "system",
  "integration",
  "coach",
] as const;

/** Translation of a key, or null when the dictionary has none. */
function optional(
  t: Translate,
  key: string,
  params?: Record<string, string | number>,
): string | null {
  const value = t(key, params);
  return value === key ? null : value;
}

const keyOf = (value: string): string => value.replace(/[.-]/g, "_");

/** Human sentence for an entry; unknown actions fall back to their code. */
export function describeActivity(item: ActivityItem, t: Translate): string {
  const resource =
    typeof item.metadata.resource === "string"
      ? (optional(t, `activity.resources.${keyOf(item.metadata.resource)}`) ??
        item.metadata.resource)
      : "";
  const provider =
    typeof item.metadata.provider === "string" ? item.metadata.provider : "";
  return (
    optional(t, `activity.actions.${keyOf(item.action)}`, {
      resource,
      provider,
    }) ?? item.action
  );
}

export function describeActor(item: ActivityItem, t: Translate): string {
  const type = t(`activity.actors.${item.actor.type}`);
  if (item.actor.type === "admin" && item.actor.name) {
    return `${type} · ${item.actor.name}`;
  }
  if (
    item.actor.type === "integration" &&
    typeof item.metadata.provider === "string"
  ) {
    return `${type} · ${item.metadata.provider}`;
  }
  return type;
}

export function fieldLabel(field: string, t: Translate): string {
  return optional(t, `activity.fields.${field}`) ?? field;
}

/** Short rendering of a changed value for the diff table. */
export function formatChangeValue(value: unknown, t: Translate): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean")
    return value ? t("common.yes") : t("common.no");
  if (typeof value === "number" || typeof value === "string")
    return String(value);
  if (Array.isArray(value)) {
    return value.every((item) => typeof item !== "object")
      ? value.join(", ")
      : JSON.stringify(value);
  }
  return JSON.stringify(value);
}

/** Card page the entry's entity opens, when the admin panel has one. */
export function entityHref(item: ActivityItem): string | null {
  const userId = item.subject?.id;
  const id = item.entity?.id;
  if (!userId || !id) return null;
  switch (item.entity?.type) {
    case "workout":
      return `/users/${userId}/workouts/${id}`;
    case "plan":
      return `/users/${userId}/plans/${id}`;
    default:
      return null;
  }
}
