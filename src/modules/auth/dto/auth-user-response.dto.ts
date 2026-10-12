import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AuthUserFeaturesDto {
  @ApiProperty({ example: true })
  showReferral!: boolean;

  @ApiPropertyOptional({ example: 'dark' })
  theme?: string;
}

export class AuthUserResponseDto {
  @ApiProperty({ example: 'b8c8d8e8-f8a8-48b8-88c8-d8e8f8a8b8c8' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'John' })
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @ApiPropertyOptional({ example: 'https://example.com/avatar.jpg' })
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'REF123' })
  referralCode?: string;

  @ApiProperty({ example: true })
  emailVerified!: boolean;

  @ApiProperty({ example: '2026-09-10T12:00:00.000Z' })
  createdAt!: Date;

  @ApiPropertyOptional({ type: [String], example: ['users.read', 'users.update'] })
  permissions?: string[];

  @ApiProperty({ type: AuthUserFeaturesDto })
  features!: AuthUserFeaturesDto;
}
