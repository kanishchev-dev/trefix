import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

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
    example: 'https://example.com/avatar.jpg',
    description: "Public URL to the user's avatar image",
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;
}
