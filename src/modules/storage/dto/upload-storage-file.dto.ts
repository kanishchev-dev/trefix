import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadStorageFileDto {
  @ApiPropertyOptional({
    description: 'Domain area that owns the file, such as users or chats.',
    example: 'users',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  scopeType?: string;

  @ApiPropertyOptional({
    description: 'Identifier of the related domain entity.',
    example: 'user_123',
  })
  @IsOptional()
  @IsString()
  @MaxLength(128)
  scopeId?: string;

  @ApiPropertyOptional({
    description: 'Logical subfolder within the scope.',
    example: 'avatars',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  folder?: string;
}
