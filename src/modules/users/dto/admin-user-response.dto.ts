import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AdminUserGroupDto {
  @ApiProperty({ example: 'b8c8d8e8-f8a8-48b8-88c8-d8e8f8a8b8c8' })
  id!: string;

  @ApiProperty({ example: 'Администраторы' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, example: 'System group with full access' })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'system.administrators' })
  systemKey!: string | null;

  @ApiProperty({ example: false })
  isSystem!: boolean;
}

export class AdminUserPermissionDto {
  @ApiProperty({ example: 'users.read' })
  name!: string;

  @ApiProperty({ type: String, nullable: true, example: 'Read user profiles and lists' })
  description!: string | null;
}

export class AdminUserResponseDto {
  @ApiProperty({ example: 'b8c8d8e8-f8a8-48b8-88c8-d8e8f8a8b8c8' })
  id!: string;

  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 'John' })
  firstName!: string;

  @ApiProperty({ example: 'Doe' })
  lastName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'https://example.com/avatar.jpg',
  })
  avatarUrl!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'REF123' })
  referralCode!: string | null;

  @ApiProperty({ example: false })
  emailVerified!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-09-10T12:00:00.000Z' })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ example: false })
  isSystem!: boolean;

  @ApiProperty({ type: String, nullable: true, example: 'system.admin' })
  systemKey!: string | null;

  @ApiProperty({ example: '2026-09-10T12:00:00.000Z' })
  createdAt!: Date;

  @ApiProperty({ example: '2026-09-10T12:00:00.000Z' })
  updatedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, example: '2026-09-11T12:00:00.000Z' })
  passwordChangedAt!: Date | null;

  @ApiProperty({ type: [AdminUserGroupDto] })
  groups!: AdminUserGroupDto[];

  @ApiProperty({ type: [AdminUserPermissionDto] })
  individualPermissions!: AdminUserPermissionDto[];

  @ApiProperty({ type: [String], example: ['users.read'] })
  effectivePermissions!: string[];
}
