import {
  adminNotificationPageSchema,
  audiencePreviewSchema,
  broadcastPageSchema,
  broadcastRecipientPageSchema,
  broadcastSchema,
  pushDeviceListSchema,
  type AdminNotificationPage,
  type AudiencePreview,
  type Broadcast,
  type BroadcastAudienceInput,
  type BroadcastPage,
  type BroadcastRecipientPage,
  type BroadcastStatus,
  type CreateBroadcastInput,
  type PushDevice,
} from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

export const notificationPaths = {
  broadcasts: "/api/admin/notification-broadcasts",
  broadcast: (id: string) => `/api/admin/notification-broadcasts/${id}`,
  recipients: (id: string) =>
    `/api/admin/notification-broadcasts/${id}/recipients`,
  preview: "/api/admin/notification-broadcasts/audience-preview",
  userInbox: (userId: string) => `/api/admin/users/${userId}/notifications`,
  userDevices: (userId: string) =>
    `/api/admin/users/${userId}/notifications/devices`,
} as const;

export type PageQuery = { page?: number; limit?: number };

export async function fetchBroadcasts(
  query: PageQuery & { status?: BroadcastStatus },
): Promise<BroadcastPage> {
  return broadcastPageSchema.parse(
    await apiRequest<unknown>(notificationPaths.broadcasts, {
      searchParams: {
        page: query.page,
        limit: query.limit,
        status: query.status,
      },
    }),
  );
}

export async function fetchBroadcast(id: string): Promise<Broadcast> {
  return broadcastSchema.parse(
    await apiRequest<unknown>(notificationPaths.broadcast(id)),
  );
}

export async function fetchBroadcastRecipients(
  id: string,
  query: PageQuery & { unread?: boolean },
): Promise<BroadcastRecipientPage> {
  return broadcastRecipientPageSchema.parse(
    await apiRequest<unknown>(notificationPaths.recipients(id), {
      searchParams: {
        page: query.page,
        limit: query.limit,
        unread: query.unread ? "true" : undefined,
      },
    }),
  );
}

export async function previewAudience(
  audience: BroadcastAudienceInput,
): Promise<AudiencePreview> {
  return audiencePreviewSchema.parse(
    await apiRequest<unknown>(notificationPaths.preview, {
      method: "POST",
      body: { audience },
    }),
  );
}

export async function createBroadcast(
  input: CreateBroadcastInput,
): Promise<Broadcast> {
  return broadcastSchema.parse(
    await apiRequest<unknown>(notificationPaths.broadcasts, {
      method: "POST",
      body: input,
    }),
  );
}

export async function fetchUserNotifications(
  userId: string,
  query: PageQuery,
): Promise<AdminNotificationPage> {
  return adminNotificationPageSchema.parse(
    await apiRequest<unknown>(notificationPaths.userInbox(userId), {
      searchParams: { page: query.page, limit: query.limit },
    }),
  );
}

export async function fetchUserPushDevices(
  userId: string,
): Promise<PushDevice[]> {
  return pushDeviceListSchema.parse(
    await apiRequest<unknown>(notificationPaths.userDevices(userId)),
  ).items;
}
