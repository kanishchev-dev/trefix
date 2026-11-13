import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsEmail, IsOptional, IsString, IsUrl, MinLength } from 'class-validator';

export class AdminUpdateUserDto {
  @ApiPropertyOptional({ example: 'John', description: 'User first name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  firstName?: string;

  @ApiPropertyOptional({ example: 'Doe', description: 'User last name' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  lastName?: string;

  @ApiPropertyOptional({ example: 'user@example.com', description: 'User email' })
  @IsOptional()
  @Transform(({ value }) => String(value).trim().toLowerCase())
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({
    example: 'https://example.com/avatar.jpg',
    description: "Public URL to the user's avatar image",
  })
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'REF123', description: 'Referral code' })
  @IsOptional()
  @IsString()
  referralCode?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Email verification status',
  })
  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;
}
