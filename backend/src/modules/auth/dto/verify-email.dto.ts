import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '1234' })
  @IsNotEmpty()
  @Matches(/^\d{4}$/)
  code!: string;
}
