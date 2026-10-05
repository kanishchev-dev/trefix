import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '@/common/dto/pagination.dto';

export const USER_SORTABLE_FIELDS = ['createdAt', 'email', 'firstName', 'lastName'] as const;
export type UserSortableField = (typeof USER_SORTABLE_FIELDS)[number];

export class UserQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'john',
    description: 'Free text search over email, first name and last name',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    enum: USER_SORTABLE_FIELDS,
    default: 'createdAt',
    description: 'Field to sort by',
  })
  @IsOptional()
  @IsIn(USER_SORTABLE_FIELDS)
  sortBy?: UserSortableField = 'createdAt';

  @ApiPropertyOptional({
    enum: ['ASC', 'DESC'],
    default: 'DESC',
    description: 'Sort direction',
  })
  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}
