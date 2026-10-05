import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  env: process.env.NODE_ENV,
  port: parseInt(process.env.PORT || '3000', 10),
  logLevel: process.env.LOG_LEVEL || 'info',
  autoSeedSystemData:
    process.env.AUTO_SEED_SYSTEM_DATA !== undefined
      ? process.env.AUTO_SEED_SYSTEM_DATA === 'true'
      : process.env.NODE_ENV !== 'test',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:3001,http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  webAppUrl: (process.env.WEB_APP_URL || 'http://localhost:3001').replace(/\/+$/, ''),
  /**
   * Public base URL of this API, used to build absolute links that leave the
   * system: avatar images. It has to be reachable from wherever the link is
   * rendered — an email, a mobile device, another browser — so it cannot be a
   * relative path.
   */
  apiBaseUrl: (process.env.API_BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  /**
   * Default rate limit for every endpoint without its own `@Throttle`.
   *
   * Endpoints worth protecting (login, password reset, verification codes)
   * declare a much tighter limit of their own. This ceiling is only here to
   * stop runaway clients, so it has to leave room for normal use: the admin
   * panel issues a handful of requests per page, two tabs double that, and the
   * limiter counts by IP — a limit low enough to notice a second tab is a
   * limit that breaks a single one.
   */
  throttleLimit: parseInt(process.env.THROTTLE_LIMIT || '300', 10),
  throttleTtl: parseInt(process.env.THROTTLE_TTL || '60000', 10),
}));
