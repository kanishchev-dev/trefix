import { registerAs } from '@nestjs/config';

export default registerAs('integrations', () => ({
  encryptionKey: process.env.INTEGRATIONS_ENCRYPTION_KEY || 'default_integrations_master_encryption_key_32_chars!',
  strava: {
    clientId: process.env.STRAVA_CLIENT_ID || '12345',
    clientSecret: process.env.STRAVA_CLIENT_SECRET || 'strava_client_secret_placeholder',
    redirectUri: process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/integrations/strava/callback',
    webhookVerifyToken: process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'trefix_strava_webhook_secret',
    apiBaseUrl: process.env.STRAVA_API_BASE_URL || 'https://www.strava.com/api/v3',
    oauthBaseUrl: process.env.STRAVA_OAUTH_BASE_URL || 'https://www.strava.com/oauth',
  },
}));
