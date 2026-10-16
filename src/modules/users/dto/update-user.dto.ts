import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MaxLength, MinLength, ValidateIf } from 'class-validator';

import { USER_BIO_MAX_LENGTH } from '../users.constants';

export class UpdateUserDto {
  /**
   * User first name.
   * @example John
   */
  @ApiPropertyOptional({ example: 'John', description: 'User first name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  /**
   * User last name.
   * @example Doe
   */
  @ApiPropertyOptional({ example: 'Doe', description: 'User last name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  /**
   * Public URL to the user's avatar image.
   * @example https://example.com/avatar.jpg
   */
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://example.com/avatar.jpg',
    description: "Public URL to the user's avatar image; `null` removes the avatar",
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsUrl()
  avatarUrl?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: USER_BIO_MAX_LENGTH,
    example: 'Running my first marathon this autumn',
    description: 'Short text about the user; empty string or `null` clears it',
  })
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsString()
  @MaxLength(USER_BIO_MAX_LENGTH)
  bio?: string | null;
}
