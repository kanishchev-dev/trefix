import {
  consentSchema,
  consentsListSchema,
  type Consent,
  type ConsentsList,
  type ConsentType,
} from "@trefix/api-client";

import { request } from "./api-client";

/** Version of the health data consent text shown in the app; must match the backend's current version. */
export const HEALTH_CONSENT_VERSION = "2026-10";

export async function getConsents(): Promise<ConsentsList> {
  const response = await request<unknown>("/me/consents", { useAuth: true });
  return consentsListSchema.parse(response);
}

export async function giveConsent(
  type: ConsentType,
  version: string,
  client: { platform: "ios" | "android"; appVersion?: string; locale?: string },
): Promise<Consent> {
  const response = await request<unknown>("/me/consents", {
    method: "POST",
    body: { type, version, client },
    useAuth: true,
  });
  return consentSchema.parse(response);
}

export async function revokeConsent(type: ConsentType): Promise<void> {
  await request<unknown>(`/me/consents/${type}`, {
    method: "DELETE",
    useAuth: true,
  });
}
