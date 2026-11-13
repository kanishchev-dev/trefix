import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

import { PaginationDto } from '@/common/dto/pagination.dto';

/**
 * Query options for the permission catalog and permission group lists.
 * Extends the shared pagination contract with a free-text `search` filter.
 */
export class PermissionQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    example: 'users',
    description: 'Free text search over permission name/description and group name/description',
  })
  @IsOptional()
  @IsString()
  search?: string;
}
