import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';

import { AdminWorkoutsService } from './admin-workouts.service';
import { AthleteProfileService } from './athletes/athlete-profile.service';
import { AthleteProfileResponseDto } from './athletes/dto/athlete-profile-response.dto';
import { UpdateAthleteProfileDto } from './athletes/dto/update-athlete-profile.dto';
import {
  CreateGearDto,
  GearListQueryDto,
  GearListResponseDto,
  GearResponseDto,
  UpdateGearDto,
} from './gear/dto/gear.dto';
import { GearService } from './gear/gear.service';
import { CreateResultDto, ProgressPeriodQueryDto } from './progress/dto/progress.dto';
import {
  ProgressMetricResponseDto,
  ProgressOverviewResponseDto,
  ProgressRecordsResponseDto,
  RaceResultResponseDto,
  RecordHistoryResponseDto,
} from './progress/dto/progress-response.dto';
import { ProgressSummaryQueryDto, ProgressSummaryResponseDto } from './progress/dto/progress-summary.dto';
import { ProgressService } from './progress/progress.service';
import type {
  ProgressMetricView,
  ProgressOverviewView,
  RaceResultView,
  RecordHistoryView,
  RecordView,
} from './progress/progress.views';
import { ProgressSummaryService } from './progress/progress-summary.service';
import type { ProgressSummaryView } from './progress/progress-summary.views';
import { PROGRESS_METRICS, type ProgressMetric, RECORD_DISTANCES, type RecordDistance } from './training.constants';

/**
 * Athlete profile, progress and gear of any user for the admin panel. The
 * services are the ones the app uses, keyed by the target user; the athlete
 * profile must exist (the admin panel never creates one implicitly).
 */
@ApiTags('Admin Athlete')
@ApiBearerAuth()
@AdminEndpoint()
@ApiParam({ name: 'userId', format: 'uuid' })
@ApiNotFoundResponse({ description: 'USER_NOT_FOUND, ATHLETE_NOT_FOUND' })
@Controller({ path: 'users/:userId', version: '1' })
export class AdminAthleteController {
  constructor(
    private readonly access: AdminWorkoutsService,
    private readonly profileService: AthleteProfileService,
    private readonly progressService: ProgressService,
    private readonly summaryService: ProgressSummaryService,
    private readonly gearService: GearService,
  ) {}

  // ------------------------------------------------------------------ athlete

  @Get('athlete')
  @RequirePermissions('training.userathletes.read')
  @ApiOperation({ summary: 'Athlete profile with the source of every value, zones and completeness' })
  @ApiOkResponse({ type: AthleteProfileResponseDto })
  async getAthlete(@Param('userId', ParseUUIDPipe) userId: string): Promise<AthleteProfileResponseDto> {
    await this.access.requireAthlete(userId);
    return this.profileService.getMyProfile(userId);
  }

  @Patch('athlete')
  @RequirePermissions('training.userathletes.manage')
  @ApiOperation({
    summary: 'Change the athlete profile, zones and availability',
    description: 'Errors: ATHLETE_FIELD_OUT_OF_RANGE, ATHLETE_HEART_RATE_INCONSISTENT, ATHLETE_ZONES_INVALID',
  })
  @ApiOkResponse({ type: AthleteProfileResponseDto })
  async updateAthlete(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: UpdateAthleteProfileDto,
  ): Promise<AthleteProfileResponseDto> {
    await this.access.requireAthlete(userId);
    return this.profileService.updateMyProfile(userId, dto);
  }

  // ----------------------------------------------------------------- progress

  @Get('progress/summary')
  @RequirePermissions('training.userprogress.read')
  @ApiOperation({ summary: 'Totals by week, month, year and all time with comparisons' })
  @ApiOkResponse({ type: ProgressSummaryResponseDto })
  async progressSummary(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ProgressSummaryQueryDto,
  ): Promise<ProgressSummaryView> {
    await this.access.requireAthlete(userId);
    return this.summaryService.summary(userId, query.timezone);
  }

  @Get('progress/overview')
  @RequirePermissions('training.userprogress.read')
  @ApiOperation({ summary: 'Computed progress: form, metrics, records, achievements' })
  @ApiOkResponse({ type: ProgressOverviewResponseDto })
  async progressOverview(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: ProgressPeriodQueryDto,
  ): Promise<ProgressOverviewView> {
    await this.access.requireAthlete(userId);
    return this.progressService.overview(userId, query.period ?? '3M');
  }

  @Get('progress/metrics/:metric')
  @RequirePermissions('training.userprogress.read')
  @ApiOperation({ summary: 'One computed metric with its history' })
  @ApiOkResponse({ type: ProgressMetricResponseDto })
  async progressMetric(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('metric') metric: string,
    @Query() query: ProgressPeriodQueryDto,
  ): Promise<ProgressMetricView> {
    if (!(PROGRESS_METRICS as readonly string[]).includes(metric)) {
      throw new DomainBadRequestException('PROGRESS_METRIC_UNKNOWN', 'Unknown progress metric');
    }
    await this.access.requireAthlete(userId);
    return this.progressService.metric(userId, metric as ProgressMetric, query.period ?? '6M');
  }

  @Get('progress/records')
  @RequirePermissions('training.userprogress.read')
  @ApiOperation({ summary: 'Best results per distance' })
  @ApiOkResponse({ type: ProgressRecordsResponseDto })
  async records(@Param('userId', ParseUUIDPipe) userId: string): Promise<{ items: RecordView[] }> {
    await this.access.requireAthlete(userId);
    return this.progressService.records(userId);
  }

  @Get('progress/records/:distance')
  @RequirePermissions('training.userprogress.read')
  @ApiOperation({ summary: 'Every attempt on a record distance, including results added by hand' })
  @ApiOkResponse({ type: RecordHistoryResponseDto })
  async recordHistory(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('distance') distance: string,
  ): Promise<RecordHistoryView> {
    if (!(distance in RECORD_DISTANCES)) {
      throw new DomainBadRequestException('PROGRESS_DISTANCE_UNKNOWN', 'Unknown record distance');
    }
    await this.access.requireAthlete(userId);
    return this.progressService.recordHistory(userId, distance as RecordDistance);
  }

  @Post('progress/results')
  @RequirePermissions('training.userprogress.manage')
  @ApiOperation({ summary: 'Add a race or test result by hand', description: 'Errors: RESULT_INVALID' })
  @ApiCreatedResponse({ type: RaceResultResponseDto })
  async addResult(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateResultDto,
  ): Promise<RaceResultView> {
    await this.access.requireAthlete(userId);
    return this.progressService.addResult(userId, dto);
  }

  @Delete('progress/results/:resultId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('training.userprogress.manage')
  @ApiOperation({ summary: 'Delete a result added by hand', description: 'Errors: RESULT_NOT_FOUND' })
  @ApiParam({ name: 'resultId', format: 'uuid' })
  @ApiNoContentResponse()
  async deleteResult(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('resultId', ParseUUIDPipe) resultId: string,
  ): Promise<void> {
    await this.access.requireAthlete(userId);
    await this.progressService.deleteResult(userId, resultId);
  }

  // --------------------------------------------------------------------- gear

  @Get('gear')
  @RequirePermissions('training.usergear.read')
  @ApiOperation({ summary: 'Shoes and devices with mileage' })
  @ApiOkResponse({ type: GearListResponseDto })
  async listGear(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query() query: GearListQueryDto,
  ): Promise<GearListResponseDto> {
    await this.access.requireAthlete(userId);
    return this.gearService.list(userId, query.status, query.type);
  }

  @Post('gear')
  @RequirePermissions('training.usergear.manage')
  @ApiOperation({ summary: 'Add gear' })
  @ApiCreatedResponse({ type: GearResponseDto })
  async createGear(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateGearDto,
  ): Promise<GearResponseDto> {
    await this.access.requireAthlete(userId);
    return this.gearService.create(userId, dto);
  }

  @Patch('gear/:gearId')
  @RequirePermissions('training.usergear.manage')
  @ApiOperation({ summary: 'Edit gear', description: 'Errors: GEAR_NOT_FOUND, GEAR_RETIRED' })
  @ApiParam({ name: 'gearId', format: 'uuid' })
  @ApiOkResponse({ type: GearResponseDto })
  async updateGear(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('gearId', ParseUUIDPipe) gearId: string,
    @Body() dto: UpdateGearDto,
  ): Promise<GearResponseDto> {
    await this.access.requireAthlete(userId);
    return this.gearService.update(userId, gearId, dto);
  }

  @Post('gear/:gearId/retire')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('training.usergear.manage')
  @ApiOperation({ summary: 'Move gear to the archive' })
  @ApiParam({ name: 'gearId', format: 'uuid' })
  @ApiOkResponse({ type: GearResponseDto })
  async retireGear(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('gearId', ParseUUIDPipe) gearId: string,
  ): Promise<GearResponseDto> {
    await this.access.requireAthlete(userId);
    return this.gearService.retire(userId, gearId);
  }

  @Post('gear/:gearId/restore')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('training.usergear.manage')
  @ApiOperation({ summary: 'Return gear from the archive' })
  @ApiParam({ name: 'gearId', format: 'uuid' })
  @ApiOkResponse({ type: GearResponseDto })
  async restoreGear(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('gearId', ParseUUIDPipe) gearId: string,
  ): Promise<GearResponseDto> {
    await this.access.requireAthlete(userId);
    return this.gearService.restore(userId, gearId);
  }

  @Delete('gear/:gearId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('training.usergear.manage')
  @ApiOperation({ summary: 'Delete gear; workouts keep their history without the link' })
  @ApiParam({ name: 'gearId', format: 'uuid' })
  @ApiNoContentResponse()
  async removeGear(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('gearId', ParseUUIDPipe) gearId: string,
  ): Promise<void> {
    await this.access.requireAthlete(userId);
    await this.gearService.remove(userId, gearId);
  }
}
