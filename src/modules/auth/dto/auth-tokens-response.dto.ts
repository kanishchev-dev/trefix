import { ApiProperty } from '@nestjs/swagger';

import { AuthUserResponseDto } from './auth-user-response.dto';

export class AuthTokensResponseDto {
  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  accessToken!: string;

  @ApiProperty({ example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' })
  refreshToken!: string;

  @ApiProperty({ example: 'session-id' })
  sessionId!: string;

  @ApiProperty({ example: 900 })
  accessTokenExpiresIn!: number;

  @ApiProperty({ type: () => AuthUserResponseDto })
  user!: AuthUserResponseDto;
}
