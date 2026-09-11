import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class MobileEmailAuthRequestDto {
  @ApiProperty({ example: 'user@example.com' })
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email!: string;
}
