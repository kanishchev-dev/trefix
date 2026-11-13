import { registerAs } from '@nestjs/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

export default registerAs('auth', () => ({
  accessTokenSecret: process.env.AUTH_ACCESS_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET,
  accessTokenExpiresIn: process.env.AUTH_ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshTokenSecret: process.env.AUTH_REFRESH_TOKEN_SECRET,
  refreshTokenExpiresIn: process.env.AUTH_REFRESH_TOKEN_EXPIRES_IN || '30d',
  emailCodeExpiresIn: process.env.AUTH_EMAIL_CODE_EXPIRES_IN || '10m',
  passwordResetExpiresIn: process.env.AUTH_PASSWORD_RESET_EXPIRES_IN || '15m',
  emailCodeResendCooldown: process.env.AUTH_EMAIL_CODE_RESEND_COOLDOWN || '60s',
  googleOAuthClientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
  googleOAuthClientSecret: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
  appleOAuthClientId: process.env.APPLE_OAUTH_CLIENT_ID,
  appleOAuthTeamId: process.env.APPLE_OAUTH_TEAM_ID,
  appleOAuthKeyId: process.env.APPLE_OAUTH_KEY_ID,
  appleOAuthPrivateKey: resolveApplePrivateKey(),
}));

function resolveApplePrivateKey(): string | undefined {
  const inlinePrivateKey = process.env.APPLE_OAUTH_PRIVATE_KEY;
  if (inlinePrivateKey) {
    return inlinePrivateKey.replace(/\\n/g, '\n');
  }

  const privateKeyPath = process.env.APPLE_OAUTH_PRIVATE_KEY_PATH;
  if (!privateKeyPath) {
    return undefined;
  }

  return readFileSync(resolve(privateKeyPath), 'utf8');
}
