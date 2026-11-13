import { ApiProperty } from '@nestjs/swagger';

export class EmailOtpChallengeResponseDto {
  @ApiProperty({ example: 'user@example.com' })
  email!: string;

  @ApiProperty({ example: 600 })
  expiresInSeconds!: number;

  @ApiProperty({ example: 60 })
  resendAfterSeconds!: number;
}
