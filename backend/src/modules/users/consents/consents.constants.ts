export const CONSENT_TYPES = ['health_data'] as const;
export type ConsentType = (typeof CONSENT_TYPES)[number];

/** Version of the health data consent text the apps show; bump it when the text changes so users accept it again. */
export const HEALTH_CONSENT_CURRENT_VERSION = '2026-10';

export const CURRENT_CONSENT_VERSIONS: Readonly<Record<ConsentType, string>> = {
  health_data: HEALTH_CONSENT_CURRENT_VERSION,
};

export const CONSENT_CLIENT_PLATFORMS = ['ios', 'android', 'web'] as const;
