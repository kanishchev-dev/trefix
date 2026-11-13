import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SocialExchangeDto {
  @ApiProperty({ example: 'handoff-code' })
  @IsString()
  @IsNotEmpty()
  code!: string;
}
