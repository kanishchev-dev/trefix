import { activityPageSchema, type ActivityPage } from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

export type ActivityFilter = {
  domain?: readonly string[];
  actorType?: readonly string[];
  from?: string;
  to?: string;
  entityType?: string;
  entityId?: string;
  q?: string;
};

export type ActivityLogFilter = ActivityFilter & {
  kind?: "admin" | "data_access" | "all";
  actorUserId?: string;
  subjectUserId?: string;
};

export const activityPaths = {
  user: (userId: string) => `/api/admin/users/${userId}/activity`,
  userExport: (userId: string) => `/api/admin/users/${userId}/activity/export`,
  log: "/api/admin/activity",
  logExport: "/api/admin/activity/export",
} as const;

function toSearchParams(
  filter: ActivityLogFilter,
): Record<string, string | readonly string[] | undefined> {
  return {
    domain: filter.domain?.length ? filter.domain : undefined,
    actorType: filter.actorType?.length ? filter.actorType : undefined,
    from: filter.from,
    to: filter.to,
    entityType: filter.entityType,
    entityId: filter.entityId,
    q: filter.q || undefined,
    kind: filter.kind,
    actorUserId: filter.actorUserId,
    subjectUserId: filter.subjectUserId,
  };
}

export async function fetchUserActivity(
  userId: string,
  filter: ActivityFilter,
  cursor?: string,
  limit?: number,
): Promise<ActivityPage> {
  const response = await apiRequest<unknown>(activityPaths.user(userId), {
    searchParams: { ...toSearchParams(filter), cursor, limit },
  });
  return activityPageSchema.parse(response);
}

export async function fetchActivityLog(
  filter: ActivityLogFilter,
  cursor?: string,
): Promise<ActivityPage> {
  const response = await apiRequest<unknown>(activityPaths.log, {
    searchParams: { ...toSearchParams(filter), cursor },
  });
  return activityPageSchema.parse(response);
}

/** Link the browser downloads the CSV from; the proxy streams it through. */
export function activityExportUrl(
  filter: ActivityLogFilter,
  userId?: string,
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(toSearchParams(filter))) {
    if (value === undefined) continue;
    if (Array.isArray(value)) value.forEach((item) => search.append(key, item));
    else search.set(key, String(value));
  }
  const base = userId
    ? activityPaths.userExport(userId)
    : activityPaths.logExport;
  const query = search.toString();
  return query ? `${base}?${query}` : base;
}
