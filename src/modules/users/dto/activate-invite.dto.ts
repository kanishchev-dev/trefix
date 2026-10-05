import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

import { USER_INVITE_CODE_LENGTH } from '../users.constants';

export class ActivateInviteDto {
  @ApiProperty({ example: 'invited@example.com' })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '12345678', description: `Activation code from the invite email (${USER_INVITE_CODE_LENGTH} digits)` })
  @IsString()
  @IsNotEmpty()
  @MaxLength(USER_INVITE_CODE_LENGTH)
  code!: string;

  @ApiProperty({ example: 'StrongPass123!', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  newPassword!: string;
}