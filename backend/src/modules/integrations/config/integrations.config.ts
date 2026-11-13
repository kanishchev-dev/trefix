import { registerAs } from '@nestjs/config';

/**
 * Secrets have no fallbacks here: `validation.schema.ts` supplies development
 * defaults and makes them mandatory in production.
 */
export default registerAs('integrations', () => ({
  encryptionKey: process.env.INTEGRATIONS_ENCRYPTION_KEY,
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID,
    clientSecret: process.env.STRAVA_CLIENT_SECRET,
    redirectUri: process.env.STRAVA_REDIRECT_URI,
    webhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN,
    /** When set, webhook calls for any other subscription are ignored. */
    webhookSubscriptionId: process.env.STRAVA_WEBHOOK_SUBSCRIPTION_ID,
    apiBaseUrl: process.env.STRAVA_API_BASE_URL || 'https://www.strava.com/api/v3',
    oauthBaseUrl: process.env.STRAVA_OAUTH_BASE_URL || 'https://www.strava.com/oauth',
  },
  health: {
    /** Apple Health / Health Connect endpoints; off until the Health Connect declaration is approved. */
    enabled: process.env.HEALTH_INTEGRATIONS_ENABLED === 'true',
  },
}));
