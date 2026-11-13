import { VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { OpenAPIObject } from '@nestjs/swagger';

import { applyOpenApiPlaceholderEnv } from '../src/openapi/placeholder-env';
import { buildSwaggerDocument } from '../src/openapi/swagger-document';

type Schema = Record<string, unknown> & {
  type?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  additionalProperties?: unknown;
};

/**
 * The frontend contract is generated from this document, so a property the
 * document cannot describe becomes `unknown` (or is silently dropped) on the
 * client. A union type without an explicit `type` in `@ApiProperty` is the
 * usual cause: reflection reports it as `Object`.
 */
describe('OpenAPI document (e2e)', () => {
  let document: OpenAPIObject;

  beforeAll(async () => {
    // Preview mode builds the module graph without connecting to the database or Redis.
    applyOpenApiPlaceholderEnv();
    const { AppModule } = await import('../src/app.module');
    const app = await NestFactory.create(AppModule, { preview: true, logger: false });
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    document = buildSwaggerDocument(app);
    await app.close();
  }, 60_000);

  const schemas = (): Array<[string, Schema]> =>
    Object.entries((document.components?.schemas ?? {}) as Record<string, Schema>);

  it('describes every property with a concrete type', () => {
    const vague: string[] = [];
    for (const [name, schema] of schemas()) {
      for (const [property, value] of Object.entries(schema.properties ?? {})) {
        const text = JSON.stringify(value);
        const bareObject =
          value.type === 'object' &&
          !value.properties &&
          value.additionalProperties === undefined &&
          !text.includes('$ref');
        const nestedArray = value.type === 'array' && value.items?.type === 'array';
        if (bareObject || nestedArray) {
          vague.push(`${name}.${property}`);
        }
      }
    }
    expect(vague).toEqual([]);
  });

  it('has no empty object schemas (they would strip every field on the client)', () => {
    const empty = schemas()
      .filter(
        ([, schema]) => schema.type === 'object' && !schema.properties && schema.additionalProperties === undefined,
      )
      .map(([name]) => name);
    expect(empty).toEqual([]);
  });

  it('describes the JSON response of every endpoint the apps read', () => {
    const withoutBody = new Set([
      // Probes for the orchestrator, not read by the apps.
      'get /health',
      'get /health/ready',
      // Redirects, files, webhooks and event streams have no JSON body.
      'get /v1/auth/social/{provider}/start',
      'get /v1/auth/social/{provider}/callback',
      'get /v1/storage/files/{id}',
      'get /v1/avatars/{userId}',
      'post /v1/coach/sessions/{id}/stream',
      'get /v1/coach/sessions/{id}/stream',
      'get /v1/integrations/strava/callback',
      'get /v1/integrations/strava/webhook',
      'post /v1/integrations/strava/webhook',
    ]);
    const missing: string[] = [];
    for (const [path, item] of Object.entries(document.paths)) {
      for (const [method, operation] of Object.entries(
        item as Record<string, { responses?: Record<string, unknown> }>,
      )) {
        const key = `${method} ${path}`;
        if (withoutBody.has(key)) continue;
        const responses = Object.entries(operation.responses ?? {}).filter(([code]) => code.startsWith('2'));
        const described = responses.some(([code, response]) => {
          if (code === '204') return true;
          // An example-only schema generates `unknown` on the client.
          const schema = (response as { content?: Record<string, { schema?: Schema & { $ref?: string } }> }).content?.[
            'application/json'
          ]?.schema;
          return Boolean(schema && (schema.$ref || schema.type || schema.allOf));
        });
        if (!described) missing.push(key);
      }
    }
    expect(missing).toEqual([]);
  });

  it('has no defaults in PATCH bodies (a client would overwrite untouched fields)', () => {
    const withDefaults: string[] = [];
    for (const [path, item] of Object.entries(document.paths)) {
      const ref = (item.patch?.requestBody as { content?: Record<string, { schema?: { $ref?: string } }> } | undefined)
        ?.content?.['application/json']?.schema?.$ref;
      const schema = ref ? schemas().find(([name]) => ref.endsWith(`/${name}`))?.[1] : undefined;
      for (const [property, value] of Object.entries(schema?.properties ?? {})) {
        if ('default' in (value as object)) withDefaults.push(`${path}: ${property}`);
      }
    }
    expect(withDefaults).toEqual([]);
  });
});
