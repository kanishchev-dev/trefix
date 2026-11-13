import { ApiProperty } from '@nestjs/swagger';
import { Equals } from 'class-validator';

export class DeleteAccountDto {
  @ApiProperty({ example: true, description: 'Must be `true`: the account and all data are deleted permanently' })
  @Equals(true)
  confirm!: true;
}
