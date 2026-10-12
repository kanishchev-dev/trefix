import { applyDecorators, Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

import { PaginatedResponseDto } from '../dto/pagination.dto';

/** 200 response of `PaginatedResponseDto<model>`: the generic `data` is typed per endpoint. */
export function ApiPaginatedResponse<TModel extends Type<unknown>>(model: TModel): MethodDecorator & ClassDecorator {
  return applyDecorators(
    ApiExtraModels(PaginatedResponseDto, model),
    ApiOkResponse({
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedResponseDto) },
          { properties: { data: { type: 'array', items: { $ref: getSchemaPath(model) } } }, required: ['data'] },
        ],
      },
    }),
  );
}
