import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Response } from 'express';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';
import { StorageUploadedFile } from '@/modules/storage/interfaces/storage-uploaded-file.interface';

import { AvatarService } from './avatar.service';
import { AVATAR_MAX_SIZE_BYTES } from './constants/avatar.constants';
import { AvatarUploadResponseDto } from './dto/avatar-upload-response.dto';

@ApiTags('Avatars')
@Controller({ path: 'avatars', version: '1' })
export class AvatarsController {
  constructor(private readonly avatarService: AvatarService) {}

  @Post('me')
  @RequirePermissions('account.update')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        // Hard stop at the interceptor so an oversized body is rejected before
        // it is buffered, plus a second check in the service for files that
        // arrive already truncated.
        fileSize: AVATAR_MAX_SIZE_BYTES,
      },
    }),
  )
  @ApiOperation({ summary: 'Upload the own avatar' })
  @ApiCreatedResponse({ type: AvatarUploadResponseDto })
  async uploadOwnAvatar(
    @UploadedFile() file: StorageUploadedFile | undefined,
    @CurrentUser() user: AuthUserContext,
  ): Promise<{ avatarUrl: string }> {
    const avatarUrl = await this.avatarService.uploadAvatar(user.id, file);

    return { avatarUrl };
  }

  @Delete('me')
  @RequirePermissions('account.update')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove the own avatar' })
  @ApiNoContentResponse()
  removeOwnAvatar(@CurrentUser() user: AuthUserContext): Promise<void> {
    return this.avatarService.removeAvatar(user.id);
  }

  /**
   * Same upload, but for somebody else's account: an administrator editing a
   * user sets their photo without logging in as them.
   *
   * Guarded by `users.update` rather than `account.update`, since it writes to
   * another user's record. `me` is declared first so the literal segment wins
   * over the parameterised one.
   */
  @AdminEndpoint()
  @Post(':userId')
  @RequirePermissions('users.update')
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
      },
      required: ['file'],
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: AVATAR_MAX_SIZE_BYTES,
      },
    }),
  )
  @ApiOperation({ summary: 'Upload the avatar of a user' })
  @ApiCreatedResponse({ type: AvatarUploadResponseDto })
  async uploadUserAvatar(
    @UploadedFile() file: StorageUploadedFile | undefined,
    @Param('userId', ParseUUIDPipe) userId: string,
  ): Promise<{ avatarUrl: string }> {
    const avatarUrl = await this.avatarService.uploadAvatar(userId, file);

    return { avatarUrl };
  }

  /**
   * Public on purpose: avatars are rendered by clients without a session —
   * activation emails, the mobile app on a cold start, `<img>` tags in the
   * admin panel. The URL carries the file id as a version parameter, so the
   * response can be cached forever.
   */
  @Get(':userId')
  @Public()
  @ApiOperation({ summary: 'Get the avatar of a user' })
  async getAvatar(@Param('userId', ParseUUIDPipe) userId: string, @Res() response: Response): Promise<void> {
    const source = await this.avatarService.resolveAvatarSource(userId);

    if (source.kind === 'redirect') {
      response.setHeader('Cache-Control', 'public, max-age=3600');
      response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
      response.redirect(302, source.url);
      return;
    }

    response.setHeader('Content-Type', source.mimeType);
    response.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    // `helmet` sends `Cross-Origin-Resource-Policy: same-origin` by default,
    // which makes the browser refuse the image: the admin panel and the mobile
    // app load it from another origin through a plain `<img>`, and a blocked
    // CORP response fails silently, leaving the fallback in place. Avatars are
    // public and immutable, so they may be read from anywhere.
    response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');

    if (source.etag) {
      response.setHeader('ETag', source.etag);
    }

    if (source.lastModified) {
      response.setHeader('Last-Modified', source.lastModified.toUTCString());
    }

    if (source.size) {
      response.setHeader('Content-Length', String(source.size));
    }

    source.stream.pipe(response);
  }
}
