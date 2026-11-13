import type { Notification } from "@trefix/api-client";

export type InboxGroup = {
  /** `today`, `yesterday` or the local date `YYYY-MM-DD`. */
  key: string;
  items: Notification[];
};

function localDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Splits a newest-first list into days; the two latest days get their own names. */
export function groupByDay(
  items: readonly Notification[],
  now = new Date(),
): InboxGroup[] {
  const today = localDay(now);
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(now.getDate() - 1);
  const yesterday = localDay(yesterdayDate);

  const groups: InboxGroup[] = [];
  for (const item of items) {
    const day = localDay(new Date(item.createdAt));
    const key = day === today ? "today" : day === yesterday ? "yesterday" : day;
    const last = groups[groups.length - 1];
    if (last?.key === key) {
      last.items.push(item);
    } else {
      groups.push({ key, items: [item] });
    }
  }
  return groups;
}
