import type {
  Broadcast,
  Notification,
  NotificationLink,
} from "@trefix/api-client";

type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

type Locale = "ru" | "en";

/** Translation of a key, or null when the dictionary has none. */
function optional(t: Translate, key: string): string | null {
  const value = t(key);
  return value === key ? null : value;
}

const keyOf = (value: string): string => value.replace(/[.-]/g, "_");

/** The sender shown when the notification has no title of its own. */
export function notificationTitle(
  item: Pick<Notification, "title" | "category">,
  t: Translate,
): string {
  return (
    item.title ||
    optional(t, `notifications.categories.${item.category}`) ||
    item.category
  );
}

/** The written text, or the name of the type for system notifications. */
export function notificationBody(
  item: Pick<Notification, "body" | "type">,
  t: Translate,
): string {
  return (
    item.body ||
    optional(t, `notifications.types.${keyOf(item.type)}`) ||
    item.type
  );
}

/** The broadcast text in the admin's language, or the other one. */
export function broadcastText(
  broadcast: Pick<Broadcast, "content">,
  locale: Locale,
): { title: string | null; body: string } {
  const own = broadcast.content[locale];
  const other = broadcast.content[locale === "ru" ? "en" : "ru"];
  const text = own ?? other;
  return { title: text?.title ?? null, body: text?.body ?? "" };
}

export function broadcastAudienceLabel(
  broadcast: Pick<Broadcast, "audience">,
  t: Translate,
): string {
  const { audience } = broadcast;
  if (audience.type === "users") {
    return t("notifications.audience.summary.users", {
      count: audience.userIds?.length ?? 0,
    });
  }
  return t(`notifications.audience.summary.${audience.type}`);
}

export function linkLabel(link: NotificationLink | null, t: Translate): string {
  if (!link) {
    return t("notifications.link.targets.none");
  }
  const target = t(`notifications.link.targets.${link.target}`);
  if (link.target === "url" && link.url) {
    return `${target} · ${link.url}`;
  }
  return link.id ? `${target} · ${link.id}` : target;
}

/** Share of `part` in `total`, rounded; 0 for an empty total. */
export function percent(part: number, total: number): number {
  return total > 0 ? Math.round((part / total) * 100) : 0;
}
