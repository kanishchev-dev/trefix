import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AppleNativeExchangeDto {
  @ApiProperty({ example: 'authorization-code' })
  @IsString()
  @IsNotEmpty()
  authorizationCode!: string;
}
