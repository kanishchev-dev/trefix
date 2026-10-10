import {
  deviceProfileMetricsResultSchema,
  deviceSyncBatchAcceptedSchema,
  deviceSyncStatusSchema,
  integrationItemSchema,
  integrationsListSchema,
  integrationSyncStatusSchema,
  stravaConnectResponseSchema,
  stravaProfileAccessSchema,
  workoutSourcesSchema,
  type DeviceConnectionRequest,
  type DeviceConnectionUpdate,
  type DeviceProfileMetricsRequest,
  type DeviceProfileMetricsResult,
  type DeviceProvider,
  type DeviceSyncBatchAccepted,
  type DeviceSyncBatchRequest,
  type DeviceSyncStatus,
  type IntegrationItem,
  type IntegrationsList,
  type IntegrationSyncStatus,
  type StravaConnectResponse,
  type StravaProfileAccess,
  type WorkoutSources,
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

// --- Apple Health / Health Connect ---

export async function connectDeviceProvider(
  provider: DeviceProvider,
  body: DeviceConnectionRequest,
): Promise<IntegrationItem> {
  const response = await request<unknown>(`/integrations/${provider}/connection`, {
    method: "PUT",
    body,
    useAuth: true,
  });
  return integrationItemSchema.parse(response);
}

export async function updateDeviceConnection(
  provider: DeviceProvider,
  body: DeviceConnectionUpdate,
): Promise<IntegrationItem> {
  const response = await request<unknown>(`/integrations/${provider}/connection`, {
    method: "PATCH",
    body,
    useAuth: true,
  });
  return integrationItemSchema.parse(response);
}

export async function disconnectDeviceProvider(provider: DeviceProvider): Promise<{ success: boolean }> {
  return request<{ success: boolean }>(`/integrations/${provider}`, { method: "DELETE", useAuth: true });
}

/** 202 means the batch is stored on the server: the caller may move its sync cursor. */
export async function postDeviceSyncBatch(
  provider: DeviceProvider,
  body: DeviceSyncBatchRequest,
): Promise<DeviceSyncBatchAccepted> {
  const response = await request<unknown>(`/integrations/${provider}/sync-batches`, {
    method: "POST",
    body,
    useAuth: true,
  });
  return deviceSyncBatchAcceptedSchema.parse(response);
}

export async function getDeviceSyncStatus(provider: DeviceProvider): Promise<DeviceSyncStatus> {
  const response = await request<unknown>(`/integrations/${provider}/sync`, { useAuth: true });
  return deviceSyncStatusSchema.parse(response);
}

export async function postDeviceProfileMetrics(
  provider: DeviceProvider,
  body: DeviceProfileMetricsRequest,
): Promise<DeviceProfileMetricsResult> {
  const response = await request<unknown>(`/integrations/${provider}/profile-metrics`, {
    method: "POST",
    body,
    useAuth: true,
  });
  return deviceProfileMetricsResultSchema.parse(response);
}

export async function getWorkoutSources(workoutId: string): Promise<WorkoutSources> {
  const response = await request<unknown>(`/integrations/workouts/${workoutId}/sources`, { useAuth: true });
  return workoutSourcesSchema.parse(response);
}
