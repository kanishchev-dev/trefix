import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * Data Transfer Object for creating a new permission.
 */
export class CreatePermissionDto {
  /**
   * The unique name of the permission, usually in 'domain.action' format.
   * @example 'users.read'
   */
  @ApiProperty({
    example: 'users.read',
    description: 'Unique permission name, e.g., domain.action',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  /**
   * A human-readable description of what this permission allows.
   * @example 'Allows reading the list of users'
   */
  @ApiProperty({
    example: 'Can read user list',
    description: 'Human-readable description of the permission',
    required: false,
  })
  @IsString()
  @IsOptional()
  description?: string;
}
