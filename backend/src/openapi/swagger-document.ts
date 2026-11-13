import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** The OpenAPI document of the API; served by Swagger UI and exported for the frontend contract. */
export function buildSwaggerDocument(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Trefix API')
    .setDescription('The Trefix project API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  addNullToNullableEnums(document);
  removeDefaultsFromPatchBodies(document);
  return document;
}

/**
 * OpenAPI 3.0.3: a nullable enum must list `null` among its values, otherwise
 * `nullable` does not apply to it. Nest emits only `nullable: true`, and code
 * generators then reject `null` the API actually sends.
 */
function addNullToNullableEnums(node: unknown): void {
  if (Array.isArray(node)) {
    node.forEach(addNullToNullableEnums);
    return;
  }
  if (!node || typeof node !== 'object') {
    return;
  }
  const schema = node as { nullable?: boolean; enum?: unknown[] };
  if (schema.nullable === true && Array.isArray(schema.enum) && !schema.enum.includes(null)) {
    schema.enum = [...schema.enum, null];
  }
  Object.values(node).forEach(addNullToNullableEnums);
}

/**
 * A PATCH body changes only the fields it carries. Defaults inherited from the
 * create DTO through PartialType would make generated clients fill in, and so
 * overwrite, every field the user did not touch.
 */
function removeDefaultsFromPatchBodies(document: OpenAPIObject): void {
  const schemas = (document.components?.schemas ?? {}) as Record<string, { properties?: Record<string, object> }>;
  for (const item of Object.values(document.paths)) {
    const body = item.patch?.requestBody as { content?: Record<string, { schema?: { $ref?: string } }> } | undefined;
    const ref = body?.content?.['application/json']?.schema?.$ref;
    const schema = ref ? schemas[ref.split('/').pop() ?? ''] : undefined;
    for (const property of Object.values(schema?.properties ?? {})) {
      delete (property as { default?: unknown }).default;
    }
  }
}
