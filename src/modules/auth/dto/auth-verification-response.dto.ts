import { ApiProperty } from '@nestjs/swagger';

import { AuthUserResponseDto } from './auth-user-response.dto';

export class AuthVerificationResponseDto {
  @ApiProperty({ type: () => AuthUserResponseDto })
  user!: AuthUserResponseDto;
}
