import { adminOverviewSchema, type AdminOverview } from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

export async function fetchUserOverview(
  userId: string,
  timezone: string,
): Promise<AdminOverview> {
  return adminOverviewSchema.parse(
    await apiRequest<unknown>(`/api/admin/users/${userId}/overview`, {
      searchParams: { timezone },
    }),
  );
}
