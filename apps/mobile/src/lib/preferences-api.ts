import {
  userPreferencesSchema,
  userPreferencesUpdateSchema,
  type UserPreferences,
  type UserPreferencesUpdate,
} from "@workspace/api-client";
import { request } from "./api-client";

export async function getPreferences(): Promise<UserPreferences> {
  const response = await request<unknown>("/me/preferences", { useAuth: true });
  return userPreferencesSchema.parse(response);
}

export async function updatePreferences(patch: UserPreferencesUpdate): Promise<UserPreferences> {
  const response = await request<unknown>("/me/preferences", {
    method: "PATCH",
    body: userPreferencesUpdateSchema.parse(patch),
    useAuth: true,
  });
  return userPreferencesSchema.parse(response);
}
