import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, Matches } from 'class-validator';

export class MobileEmailAuthVerifyDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email!: string;

  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  @Matches(/^\d{6}$/)
  code!: string;
}
