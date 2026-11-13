import {
  deviceSyncRequestSchema,
  integrationsListSchema,
  type IntegrationsList,
} from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

const base = (userId: string) => `/api/admin/users/${userId}/integrations`;

export async function fetchUserIntegrations(
  userId: string,
): Promise<IntegrationsList> {
  return integrationsListSchema.parse(await apiRequest<unknown>(base(userId)));
}

export function syncUserStrava(userId: string): Promise<unknown> {
  return apiRequest<unknown>(`${base(userId)}/strava/sync`, { method: "POST" });
}

export function syncUserStravaProfile(userId: string): Promise<unknown> {
  return apiRequest<unknown>(`${base(userId)}/strava/profile-sync`, {
    method: "POST",
  });
}

export async function requestUserDeviceSync(
  userId: string,
  provider: string,
): Promise<boolean> {
  return deviceSyncRequestSchema.parse(
    await apiRequest<unknown>(`${base(userId)}/${provider}/sync-request`, {
      method: "POST",
    }),
  ).delivered;
}

export function disconnectUserIntegration(
  userId: string,
  provider: string,
): Promise<unknown> {
  return apiRequest<unknown>(`${base(userId)}/${provider}`, {
    method: "DELETE",
  });
}
