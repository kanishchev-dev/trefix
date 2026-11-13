import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches } from 'class-validator';

import { AUTH_EMAIL_VERIFICATION_CODE_LENGTH } from '../auth.constants';

export class EmailChangeRequestDto {
  @ApiProperty({ example: 'new@example.com', description: 'New account email; the code is sent there' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email!: string;
}

export class EmailChangeConfirmDto {
  @ApiProperty({ example: '4821', description: 'Code from the email sent to the new address' })
  @IsString()
  @Length(AUTH_EMAIL_VERIFICATION_CODE_LENGTH, AUTH_EMAIL_VERIFICATION_CODE_LENGTH)
  @Matches(/^\d+$/)
  code!: string;
}

export class EmailChangeChallengeResponseDto {
  @ApiProperty({ example: 'new@example.com' })
  email!: string;

  @ApiProperty({ example: 600 })
  expiresInSeconds!: number;

  @ApiProperty({ example: 60 })
  resendAfterSeconds!: number;
}
