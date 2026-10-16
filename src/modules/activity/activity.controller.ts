import { Controller, Get, Param, ParseUUIDPipe, Query, StreamableFile } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Readable } from 'stream';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import type { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { type ActivitySearch, ActivityService } from './activity.service';
import { activityCsvHeader, activityCsvRows } from './activity-csv';
import {
  ActivityFilterDto,
  ActivityLogExportQueryDto,
  ActivityLogQueryDto,
  ActivityPageQueryDto,
} from './dto/activity-query.dto';
import { ActivityPageDto } from './dto/activity-response.dto';

/** Activity history of a user and the global log of actions, for the admin panel. */
@ApiTags('Admin Activity')
@ApiBearerAuth()
@AdminEndpoint()
@Controller({ version: '1' })
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  @Get('users/:userId/activity')
  @RequirePermissions('users.activity.read')
  @ApiOperation({ summary: 'Action history of one user, newest first' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ type: ActivityPageDto })
  @ApiBadRequestResponse({ description: 'ACTIVITY_CURSOR_INVALID' })
  listForUser(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ActivityPageQueryDto,
  ): Promise<ActivityPageDto> {
    const { cursor, limit, ...filter } = query;
    return this.activityService.list({ ...filter, subjectUserId: userId }, cursor, limit);
  }

  @Get('users/:userId/activity/export')
  @RequirePermissions('users.activity.read')
  @ApiOperation({ summary: 'CSV export of the action history of one user' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiProduces('text/csv')
  exportForUser(
    @CurrentUser() actor: AuthUserContext,
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ActivityFilterDto,
  ): StreamableFile {
    return this.export(actor, { ...query, subjectUserId: userId }, `activity-${userId}.csv`);
  }

  @Get('activity')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'Global log: admin actions (default), data access or everything, newest first' })
  @ApiOkResponse({ type: ActivityPageDto })
  @ApiBadRequestResponse({ description: 'ACTIVITY_CURSOR_INVALID' })
  listLog(@Query() query: ActivityLogQueryDto): Promise<ActivityPageDto> {
    const { cursor, limit, ...filter } = query;
    return this.activityService.list({ kind: 'admin', ...filter }, cursor, limit);
  }

  @Get('activity/export')
  @RequirePermissions('audit.read')
  @ApiOperation({ summary: 'CSV export of the global log' })
  @ApiProduces('text/csv')
  exportLog(@CurrentUser() actor: AuthUserContext, @Query() query: ActivityLogExportQueryDto): StreamableFile {
    return this.export(actor, { kind: 'admin', ...query }, 'activity.csv');
  }

  /** Streams the CSV; the export itself is recorded as access to the data it contains. */
  private export(actor: AuthUserContext, search: ActivitySearch, fileName: string): StreamableFile {
    const service = this.activityService;
    async function* lines(): AsyncGenerator<string> {
      yield activityCsvHeader();
      for await (const batch of service.iterate(search)) {
        yield activityCsvRows(batch);
      }
    }
    void service.recordDataAccess({
      actorUserId: actor.id,
      subjectUserId: search.subjectUserId ?? null,
      resource: 'activity.export',
      resourceId: null,
    });
    return new StreamableFile(Readable.from(lines()), {
      type: 'text/csv; charset=utf-8',
      disposition: `attachment; filename="${fileName}"`,
    });
  }
}
