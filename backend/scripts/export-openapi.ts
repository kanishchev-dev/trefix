/**
 * Writes the OpenAPI document to a file without connecting to anything:
 * preview mode builds the module graph but instantiates no providers.
 *
 *   npx ts-node -r tsconfig-paths/register scripts/export-openapi.ts [out.json]
 */
import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { writeFileSync } from 'fs';

import { applyOpenApiPlaceholderEnv } from '../src/openapi/placeholder-env';
import { buildSwaggerDocument } from '../src/openapi/swagger-document';

async function main(): Promise<void> {
  // Config is validated when the module is imported, so the env comes first.
  applyOpenApiPlaceholderEnv();
  const { AppModule } = await import('../src/app.module');
  const app = await NestFactory.create(AppModule, { preview: true, logger: false });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  const document = buildSwaggerDocument(app);
  const target = process.argv[2] ?? 'openapi.json';
  writeFileSync(target, `${JSON.stringify(document, null, 2)}\n`);
  await app.close();
  // eslint-disable-next-line no-console
  console.log(`OpenAPI: ${Object.keys(document.paths).length} paths -> ${target}`);
}

void main();
