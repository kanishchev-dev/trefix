import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBody, ApiConsumes, ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import { Response } from 'express';
import { diskStorage } from 'multer';
import { tmpdir } from 'os';
import { extname } from 'path';

import { StorageFileResponseDto } from './dto/storage-file-response.dto';
import { UploadStorageFileDto } from './dto/upload-storage-file.dto';
import { StorageFile } from './entities/storage-file.entity';
import { StorageAccessContextRequiredException } from './exceptions/storage-access-context-required.exception';
import { StorageUploadedFile } from './interfaces/storage-uploaded-file.interface';
import { STORAGE_DEFAULT_MAX_UPLOAD_SIZE_BYTES } from './storage.constants';
import { StorageService } from './storage.service';
import { createContentDisposition } from './utils/storage-path.util';

function buildTempFilename(originalname: string): string {
  const extension = extname(originalname);
  return `${randomUUID()}${extension}`;
}

const uploadStorage = diskStorage({
  destination: (
    _request: import('express').Request,
    _file: StorageUploadedFile,
    callback: (error: Error | null, destination: string) => void,
  ): void => {
    callback(null, tmpdir());
  },
  filename: (
    _request: import('express').Request,
    file: StorageUploadedFile,
    callback: (error: Error | null, filename: string) => void,
  ): void => {
    callback(null, buildTempFilename(file.originalname));
  },
});

@ApiTags('Storage')
@Controller({
  path: 'storage',
  version: '1',
})
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('files')
  @ApiOperation({ summary: 'Upload a file' })
  @ApiConsumes('multipart/form-data')
  @ApiHeader({ name: 'x-user-id', required: true, description: 'Current user identifier' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        scopeType: { type: 'string', example: 'users' },
        scopeId: { type: 'string', example: 'user_123' },
        folder: { type: 'string', example: 'avatars' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadStorage,
      limits: {
        fileSize: STORAGE_DEFAULT_MAX_UPLOAD_SIZE_BYTES,
      },
    }),
  )
  @ApiResponse({ status: 201, type: StorageFileResponseDto })
  async upload(
    @UploadedFile() file: StorageUploadedFile,
    @Body() body: UploadStorageFileDto,
    @Headers('x-user-id') userId: string | string[] | undefined,
  ): Promise<StorageFileResponseDto> {
    const requesterUserId = this.resolveRequesterUserId(userId);

    const createdFile = await this.storageService.uploadFile(file, {
      uploaderUserId: requesterUserId,
      scopeType: body.scopeType,
      scopeId: body.scopeId,
      folder: body.folder,
    });

    return this.toResponseDto(createdFile);
  }

  @Get('files/:id')
  @ApiOperation({ summary: 'Download a file' })
  @ApiHeader({ name: 'x-user-id', required: true, description: 'Current user identifier' })
  @ApiResponse({ status: 200, description: 'File stream' })
  async download(
    @Param('id') id: string,
    @Headers('x-user-id') userId: string | string[] | undefined,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const requesterUserId = this.resolveRequesterUserId(userId);

    const { file, stream } = await this.storageService.getFile(id, {
      requesterUserId,
    });

    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', String(file.size));
    response.setHeader('Content-Disposition', createContentDisposition(file.originalName));

    return new StreamableFile(stream);
  }

  @Delete('files/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a file' })
  @ApiHeader({ name: 'x-user-id', required: true, description: 'Current user identifier' })
  @ApiResponse({ status: 204, description: 'File deleted' })
  async delete(@Param('id') id: string, @Headers('x-user-id') userId: string | string[] | undefined): Promise<void> {
    const requesterUserId = this.resolveRequesterUserId(userId);

    await this.storageService.deleteFile(id, {
      requesterUserId,
    });
  }

  private resolveRequesterUserId(userId: string | string[] | undefined): string {
    const normalizedUserId = Array.isArray(userId) ? userId[0] : userId;

    if (!normalizedUserId) {
      throw new StorageAccessContextRequiredException();
    }

    return normalizedUserId;
  }

  private toResponseDto(file: StorageFile): StorageFileResponseDto {
    return {
      id: file.id,
      name: file.originalName,
      mimeType: file.mimeType,
      size: file.size,
    };
  }
}
