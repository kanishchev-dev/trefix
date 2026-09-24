import {
  integrationItemSchema,
  integrationsListSchema,
  integrationSyncStatusSchema,
  stravaConnectResponseSchema,
  type IntegrationItem,
  type IntegrationsList,
  type IntegrationSyncStatus,
  type StravaConnectResponse,
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
