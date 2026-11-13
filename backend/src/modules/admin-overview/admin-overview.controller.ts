import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNotFoundResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';

import { AdminOverviewQueryDto, AdminOverviewResponseDto } from './admin-overview.dto';
import { AdminOverviewService } from './admin-overview.service';

@ApiTags('Admin Overview')
@ApiBearerAuth()
@AdminEndpoint()
@Controller({ path: 'users/:userId/overview', version: '1' })
export class AdminOverviewController {
  constructor(private readonly overviewService: AdminOverviewService) {}

  @Get()
  @RequirePermissions('users.read')
  @ApiOperation({ summary: 'Summary of the user for the first screen of the admin card' })
  @ApiParam({ name: 'userId', format: 'uuid' })
  @ApiOkResponse({ type: AdminOverviewResponseDto })
  @ApiNotFoundResponse({ description: 'USER_NOT_FOUND' })
  getOverview(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: AdminOverviewQueryDto,
  ): Promise<AdminOverviewResponseDto> {
    return this.overviewService.getOverview(userId, query.timezone);
  }
}
