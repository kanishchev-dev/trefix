import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Data Transfer Object for creating a new permission group.
 */
export class CreatePermissionGroupDto {
  /**
   * Unique name of the group.
   * @example 'Administrators'
   */
  @ApiProperty({
    example: 'Administrators',
    description: 'Unique name for the permission group',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  /**
   * Detailed description of what this group represents.
   * @example 'Group with full administrative access'
   */
  @ApiProperty({
    example: 'Full access to all modules',
    description: 'Description of the group purpose',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
