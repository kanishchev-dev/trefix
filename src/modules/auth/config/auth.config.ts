import { registerAs } from '@nestjs/config';

export default registerAs('auth', () => ({
  accessTokenSecret: process.env.AUTH_ACCESS_TOKEN_SECRET || process.env.JWT_ACCESS_SECRET,
  accessTokenExpiresIn: process.env.AUTH_ACCESS_TOKEN_EXPIRES_IN || process.env.JWT_ACCESS_EXPIRATION || '15m',
  refreshTokenSecret: process.env.AUTH_REFRESH_TOKEN_SECRET,
  refreshTokenExpiresIn: process.env.AUTH_REFRESH_TOKEN_EXPIRES_IN || '30d',
  emailCodeExpiresIn: process.env.AUTH_EMAIL_CODE_EXPIRES_IN || '10m',
  passwordResetExpiresIn: process.env.AUTH_PASSWORD_RESET_EXPIRES_IN || '15m',
  emailCodeResendCooldown: process.env.AUTH_EMAIL_CODE_RESEND_COOLDOWN || '60s',
}));
