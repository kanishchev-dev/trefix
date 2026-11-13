import {
  appSettingsSchema,
  updateSettingsSchema,
  type AppSettings,
  type UpdateSettingsInput,
} from "@trefix/api-client";

import { apiRequest } from "@/lib/api";

export const settingsPaths = {
  root: "/api/admin/settings",
} as const;

export async function fetchSettings(): Promise<AppSettings> {
  const response = await apiRequest<unknown>(settingsPaths.root);
  return appSettingsSchema.parse(response);
}

export async function patchSettings(
  input: UpdateSettingsInput,
): Promise<AppSettings> {
  const payload = updateSettingsSchema.parse(input);
  const response = await apiRequest<unknown>(settingsPaths.root, {
    method: "PATCH",
    body: payload,
  });
  return appSettingsSchema.parse(response);
}
