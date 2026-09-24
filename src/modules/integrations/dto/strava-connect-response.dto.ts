import { ApiProperty } from '@nestjs/swagger';

export class StravaConnectResponseDto {
  @ApiProperty({ example: 'https://www.strava.com/oauth/authorize?client_id=...' })
  authUrl!: string;

  @ApiProperty({ example: 'csrf_state_token_12345' })
  state!: string;
}
