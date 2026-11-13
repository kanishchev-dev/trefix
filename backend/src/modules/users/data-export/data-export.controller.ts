import { Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Response } from 'express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { DataExportDownloadQueryDto, DataExportResponseDto, DataExportStatusResponseDto } from './data-export.dto';
import { DataExportService } from './data-export.service';

@ApiTags('Account')
@Controller({ version: '1' })
export class DataExportController {
  constructor(private readonly dataExportService: DataExportService) {}

  @Get('me/data-export')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'The latest data export request' })
  @ApiResponse({ status: 200, type: DataExportStatusResponseDto })
  async latest(@CurrentUser() user: AuthUserContext): Promise<DataExportStatusResponseDto> {
    return { latest: await this.dataExportService.latest(user.id) };
  }

  @Post('me/data-export')
  @ApiBearerAuth()
  @RequirePermissions('account.update')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary: 'Request an archive of my data; a link is emailed when it is ready',
    description: 'Errors: DATA_EXPORT_RATE_LIMITED (429, `details.availableAt`)',
  })
  @ApiResponse({ status: 202, type: DataExportResponseDto })
  request(@CurrentUser() user: AuthUserContext): Promise<DataExportResponseDto> {
    return this.dataExportService.request(user.id);
  }

  @Get('data-exports/:id/download')
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Download the archive from the emailed link', description: 'Errors: DATA_EXPORT_NOT_FOUND' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: DataExportDownloadQueryDto,
    @Res() response: Response,
  ): Promise<void> {
    const { stream, fileName } = await this.dataExportService.openDownload(id, query.token);
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    response.setHeader('Cache-Control', 'no-store');
    stream.pipe(response);
  }
}
