import { ApiProperty } from '@nestjs/swagger';

export class AvatarUploadResponseDto {
  @ApiProperty({ description: 'Public link of the avatar; loads without a token' })
  avatarUrl!: string;
}
