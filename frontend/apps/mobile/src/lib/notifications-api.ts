import {
  notificationPageSchema,
  notificationUnreadCountSchema,
  type NotificationPage,
  type RegisterPushDeviceInput,
} from "@trefix/api-client";

import { request } from "./api-client";

export const NOTIFICATIONS_PAGE_SIZE = 30;

export async function getNotifications(
  page: number,
): Promise<NotificationPage> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(NOTIFICATIONS_PAGE_SIZE),
  });
  const response = await request<unknown>(`/notifications?${query}`, {
    useAuth: true,
  });
  return notificationPageSchema.parse(response);
}

export async function getUnreadNotificationsCount(): Promise<number> {
  const response = await request<unknown>("/notifications/unread-count", {
    useAuth: true,
  });
  return notificationUnreadCountSchema.parse(response).count;
}

/** Returns the unread count after the change. */
export async function markNotificationsRead(ids: string[]): Promise<number> {
  const response = await request<unknown>("/notifications/read", {
    method: "POST",
    body: { ids },
    useAuth: true,
  });
  return notificationUnreadCountSchema.parse(response).count;
}

export async function markAllNotificationsRead(): Promise<number> {
  const response = await request<unknown>("/notifications/read-all", {
    method: "POST",
    useAuth: true,
  });
  return notificationUnreadCountSchema.parse(response).count;
}

export async function deleteNotification(id: string): Promise<void> {
  await request<void>(`/notifications/${id}`, {
    method: "DELETE",
    useAuth: true,
  });
}

export async function registerPushDevice(
  input: RegisterPushDeviceInput,
): Promise<void> {
  await request<unknown>("/notifications/devices", {
    method: "PUT",
    body: input,
    useAuth: true,
  });
}
