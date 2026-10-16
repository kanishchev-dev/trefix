import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsISO8601, IsOptional, IsString, MaxLength } from 'class-validator';

import { USER_BLOCK_REASONS, USER_STATUSES, type UserBlockReason, type UserStatus } from '../user-status';

export class BlockUserDto {
  @ApiProperty({ enum: USER_BLOCK_REASONS })
  @IsIn(USER_BLOCK_REASONS)
  reason!: UserBlockReason;

  @ApiPropertyOptional({ maxLength: 500, description: 'Visible to administrators only' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  comment?: string;

  @ApiPropertyOptional({ format: 'date-time', description: 'End of a temporary block; omit to block until unblocked' })
  @IsOptional()
  @IsISO8601()
  until?: string;

  @ApiPropertyOptional({ default: true, description: 'End every active session right away' })
  @IsOptional()
  @IsBoolean()
  revokeSessions?: boolean;

  @ApiPropertyOptional({ default: false, description: 'Email the user that the account is blocked' })
  @IsOptional()
  @IsBoolean()
  notify?: boolean;
}

export class AdminUserRefDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, nullable: true })
  name!: string | null;
}

export class AccountBlockDto {
  @ApiProperty({ format: 'date-time' })
  at!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  until!: Date | null;

  @ApiProperty({ enum: USER_BLOCK_REASONS, nullable: true })
  reason!: UserBlockReason | null;

  @ApiProperty({ type: String, nullable: true })
  comment!: string | null;

  @ApiProperty({ type: () => AdminUserRefDto, nullable: true })
  by!: AdminUserRefDto | null;
}

export class AccountDeletionStateDto {
  @ApiProperty({ format: 'date-time' })
  deletedAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true, description: 'When the data is erased for good' })
  purgeAt!: Date | null;
}

export class AccountSecurityResponseDto {
  @ApiProperty({ enum: USER_STATUSES })
  status!: UserStatus;

  @ApiProperty({ type: () => AccountBlockDto, nullable: true, description: 'The block in force' })
  block!: AccountBlockDto | null;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  emailVerified!: boolean;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  emailVerifiedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  passwordChangedAt!: Date | null;

  @ApiProperty()
  hasPassword!: boolean;

  @ApiProperty({ type: () => AccountDeletionStateDto, nullable: true })
  deletion!: AccountDeletionStateDto | null;

  @ApiProperty()
  isSystem!: boolean;
}
