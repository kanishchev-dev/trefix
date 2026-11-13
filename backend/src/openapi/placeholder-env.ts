/**
 * Values for the required settings when the app is only built to describe its
 * API (preview mode connects to nothing). Real values in the environment win.
 */
const PLACEHOLDERS: Record<string, string> = {
  DB_HOST: 'localhost',
  DB_USERNAME: 'openapi',
  DB_PASSWORD: 'openapi',
  DB_DATABASE: 'openapi',
  MAIL_HOST: 'localhost',
  MAIL_USER: 'openapi',
  MAIL_PASSWORD: 'openapi',
  MAIL_FROM: 'openapi@example.com',
  MAIL_FROM_NAME: 'OpenAPI',
  S3_ENDPOINT: 'http://localhost',
  S3_REGION: 'local',
  S3_BUCKET: 'openapi',
  S3_ACCESS_KEY: 'openapi',
  S3_SECRET_KEY: 'openapi',
  JWT_ACCESS_SECRET: 'openapi-placeholder-secret',
  AUTH_ACCESS_TOKEN_SECRET: 'openapi-placeholder-secret',
  AUTH_REFRESH_TOKEN_SECRET: 'openapi-placeholder-secret',
};

export function applyOpenApiPlaceholderEnv(): void {
  for (const [key, value] of Object.entries(PLACEHOLDERS)) {
    process.env[key] ??= value;
  }
}
