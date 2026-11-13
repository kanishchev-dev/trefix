import { ApiProperty } from '@nestjs/swagger';

import type { AuthSocialProvider } from '../interfaces/auth-social-provider.interface';

export class AuthIdentityResponseDto {
  @ApiProperty({ enum: ['apple', 'google'] })
  provider!: AuthSocialProvider;

  @ApiProperty({ type: String, nullable: true, example: 'runner@icloud.com' })
  email!: string | null;

  @ApiProperty()
  linkedAt!: Date;
}

export class AuthIdentityListResponseDto {
  @ApiProperty({ type: [AuthIdentityResponseDto] })
  items!: AuthIdentityResponseDto[];
}
