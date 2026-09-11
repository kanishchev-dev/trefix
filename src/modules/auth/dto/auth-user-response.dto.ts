import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserResponseDto {
  @ApiProperty({ example: 'b8c8d8e8-f8a8-48b8-88c8-d8e8f8a8b8c8' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: true })
  emailVerified!: boolean;

  @ApiPropertyOptional({ isArray: true, example: ['users.read', 'users.write'] })
  permissions?: string[];
}
