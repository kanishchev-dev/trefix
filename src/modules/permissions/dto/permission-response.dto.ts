import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PermissionResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ example: 'users.read' })
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  createdAt?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  updatedAt?: Date;
}

/** Group member as the group detail loads it (restricted attributes). */
export class PermissionGroupMemberDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  firstName?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  lastName?: string | null;

  @ApiProperty()
  email!: string;

  @ApiPropertyOptional()
  isSystem?: boolean;
}

export class PermissionGroupResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true })
  systemKey!: string | null;

  @ApiProperty()
  isSystem!: boolean;

  @ApiPropertyOptional({
    type: [PermissionResponseDto],
    description: 'Present when the group is loaded with its permissions',
  })
  permissions?: PermissionResponseDto[];

  @ApiPropertyOptional({ type: [PermissionGroupMemberDto], description: 'Group detail only' })
  users?: PermissionGroupMemberDto[];

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  createdAt?: Date;

  @ApiPropertyOptional({ type: String, format: 'date-time' })
  updatedAt?: Date;
}
