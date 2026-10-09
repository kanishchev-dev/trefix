import {
  integrationItemSchema,
  integrationsListSchema,
  integrationSyncStatusSchema,
  stravaConnectResponseSchema,
  stravaProfileAccessSchema,
  type IntegrationItem,
  type IntegrationsList,
  type IntegrationSyncStatus,
  type StravaConnectResponse,
  type StravaProfileAccess,
} from "@workspace/api-client";
import { request } from "./api-client";

export async function getIntegrations(): Promise<IntegrationsList> {
  const response = await request<unknown>("/integrations", {
    useAuth: true,
  });
  return integrationsListSchema.parse(response);
}

export async function getStravaIntegration(): Promise<IntegrationItem> {
  const response = await request<unknown>("/integrations/strava", {
    useAuth: true,
  });
  return integrationItemSchema.parse(response);
}

export async function initiateStravaConnect(): Promise<StravaConnectResponse> {
  const response = await request<unknown>("/integrations/strava/connect", {
    useAuth: true,
  });
  return stravaConnectResponseSchema.parse(response);
}

export async function disconnectStrava(): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/integrations/strava", {
    method: "DELETE",
    useAuth: true,
  });
}

export async function triggerStravaSync(): Promise<IntegrationSyncStatus> {
  const response = await request<unknown>("/integrations/strava/sync/trigger", {
    useAuth: true,
  });
  return integrationSyncStatusSchema.parse(response);
}

export async function getStravaSyncStatus(): Promise<IntegrationSyncStatus> {
  const response = await request<unknown>("/integrations/strava/sync", {
    useAuth: true,
  });
  return integrationSyncStatusSchema.parse(response);
}

/** Authorization URL that adds profile access (weight, sex, shoes) to the Strava connection. */
export async function requestStravaProfileAccess(): Promise<StravaProfileAccess> {
  const response = await request<unknown>("/integrations/strava/profile-access", {
    method: "POST",
    useAuth: true,
  });
  return stravaProfileAccessSchema.parse(response);
}

/** Pulls weight, sex and shoes from Strava now. */
export async function syncStravaProfile(): Promise<void> {
  await request<unknown>("/integrations/strava/profile-sync", { method: "POST", useAuth: true });
}
