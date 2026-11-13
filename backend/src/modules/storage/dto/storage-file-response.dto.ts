import { ApiProperty } from '@nestjs/swagger';

export class StorageFileResponseDto {
  @ApiProperty({
    description: 'Unique file identifier.',
    example: '0198fdc1-11f7-7c6f-9b8e-6e2f2f2a9d5a',
  })
  id!: string;

  @ApiProperty({
    description: 'Original file name.',
    example: 'avatar.jpg',
  })
  name!: string;

  @ApiProperty({
    description: 'MIME type of the file.',
    example: 'image/jpeg',
  })
  mimeType!: string;

  @ApiProperty({
    description: 'File size in bytes.',
    example: 245812,
  })
  size!: number;
}
