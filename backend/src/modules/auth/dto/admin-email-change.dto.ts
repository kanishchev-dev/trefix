import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail } from 'class-validator';

export class AdminEmailChangeDto {
  @ApiProperty({ example: 'new@example.com', description: 'New account email; a verification code is sent there' })
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  email!: string;
}
