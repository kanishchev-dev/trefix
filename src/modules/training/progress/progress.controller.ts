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
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { DomainBadRequestException } from '@/common/exceptions/domain-exceptions';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { PROGRESS_METRICS, type ProgressMetric, RECORD_DISTANCES, type RecordDistance } from '../training.constants';
import { CreateResultDto, ProgressPeriodQueryDto, RecordsExclusionDto } from './dto/progress.dto';
import {
  ProgressMetricResponseDto,
  ProgressOverviewResponseDto,
  ProgressRecordsResponseDto,
  RaceResultResponseDto,
  RecordHistoryResponseDto,
  RecordsExclusionResponseDto,
} from './dto/progress-response.dto';
import { ProgressService } from './progress.service';
import {
  type ProgressMetricView,
  type ProgressOverviewView,
  type RaceResultView,
  type RecordHistoryView,
  type RecordsExclusionView,
  type RecordView,
} from './progress.views';

const OVERVIEW_EXAMPLE = {
  period: { key: '3M', from: '2026-07-09', to: '2026-10-09' },
  metricsUnlock: { required: 6, completed: 9, unlocked: true },
  goal: {
    id: '01929b5e-…',
    type: 'improve_race_result',
    date: '2026-11-22',
    weeksLeft: 6,
    distanceKm: 21.1,
    targetSeconds: 6000,
    forecastSeconds: 6155,
    status: 'on_track',
    series: [{ date: '2026-07-16', seconds: 6540 }],
    projection: [{ date: '2026-11-22', seconds: 5990 }],
    planName: 'Полумарафон осенью',
  },
  predictions: [{ distance: '5k', seconds: 1318 }],
  form: { fitness: 48, fatigue: 52, form: -4, fitnessChange: 6, changeWeeks: 13 },
  metrics: {
    thresholdPace: { value: 275, change: -8 },
    vo2max: { value: 51, change: 2 },
    thresholdHeartRate: { value: 172, estimated: true },
  },
  capabilities: [{ type: 'endurance', value: 72, trend: 'up' }],
  records: [{ distance: '10k', best: { seconds: 2835, date: '2026-08-03', source: 'workout', isNew: true } }],
  dynamics: {
    bucket: 'week',
    metrics: { distance: { average: 34, changePercent: 12, points: [] } },
    profileVolumeHint: null,
  },
  achievements: [{ kind: 'longest_run', value: 21.4, date: '2026-09-20' }],
};

@ApiTags('Progress')
@ApiBearerAuth()
@Controller({ path: '', version: '1' })
export class ProgressController {
  constructor(private readonly progressService: ProgressService) {}

  @Get('progress/overview')
  @RequirePermissions('training.progress.read')
  @ApiOperation({
    summary: 'Computed progress: goal forecast, form, metrics, capabilities, records, dynamics, achievements',
  })
  @ApiOkResponse({ type: ProgressOverviewResponseDto, schema: { example: OVERVIEW_EXAMPLE } })
  overview(
    @CurrentUser() user: AuthUserContext,
    @Query() query: ProgressPeriodQueryDto,
  ): Promise<ProgressOverviewView> {
    return this.progressService.overview(user.id, query.period ?? '3M');
  }

  @Get('progress/metrics/:metric')
  @RequirePermissions('training.progress.read')
  @ApiOperation({
    summary: 'One computed metric (threshold pace or VO2max): history, accuracy, training paces, key workouts',
  })
  @ApiOkResponse({ type: ProgressMetricResponseDto })
  metric(
    @CurrentUser() user: AuthUserContext,
    @Param('metric') metric: string,
    @Query() query: ProgressPeriodQueryDto,
  ): Promise<ProgressMetricView> {
    if (!(PROGRESS_METRICS as readonly string[]).includes(metric)) {
      throw new DomainBadRequestException('PROGRESS_METRIC_UNKNOWN', 'Unknown progress metric');
    }
    return this.progressService.metric(user.id, metric as ProgressMetric, query.period ?? '6M');
  }

  @Get('progress/records')
  @RequirePermissions('training.progress.read')
  @ApiOperation({ summary: 'Best results per distance with the VDOT prediction' })
  @ApiOkResponse({ type: ProgressRecordsResponseDto })
  records(@CurrentUser() user: AuthUserContext): Promise<{ items: RecordView[] }> {
    return this.progressService.records(user.id);
  }

  @Get('progress/records/:distance')
  @RequirePermissions('training.progress.read')
  @ApiOperation({ summary: 'Every attempt on a record distance, newest first' })
  @ApiOkResponse({ type: RecordHistoryResponseDto })
  recordHistory(@CurrentUser() user: AuthUserContext, @Param('distance') distance: string): Promise<RecordHistoryView> {
    if (!(distance in RECORD_DISTANCES)) {
      throw new DomainBadRequestException('PROGRESS_DISTANCE_UNKNOWN', 'Unknown record distance');
    }
    return this.progressService.recordHistory(user.id, distance as RecordDistance);
  }

  @Post('progress/results')
  @RequirePermissions('training.progress.manage')
  @ApiOperation({
    summary: 'Add a result by hand (race, test or a workout without a track)',
    description: 'Errors: RESULT_INVALID',
  })
  @ApiCreatedResponse({ type: RaceResultResponseDto })
  addResult(@CurrentUser() user: AuthUserContext, @Body() dto: CreateResultDto): Promise<RaceResultView> {
    return this.progressService.addResult(user.id, dto);
  }

  @Delete('progress/results/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('training.progress.manage')
  @ApiOperation({ summary: 'Delete a result added by hand', description: 'Errors: RESULT_NOT_FOUND' })
  @ApiNoContentResponse()
  async deleteResult(@CurrentUser() user: AuthUserContext, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.progressService.deleteResult(user.id, id);
  }

  @Patch('workouts/:id/records')
  @RequirePermissions('training.progress.manage')
  @ApiOperation({ summary: 'Exclude a workout (e.g. a broken track) from records and VDOT, or include it back' })
  @ApiOkResponse({ type: RecordsExclusionResponseDto })
  setRecordsExcluded(
    @CurrentUser() user: AuthUserContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordsExclusionDto,
  ): Promise<RecordsExclusionView> {
    return this.progressService.setRecordsExcluded(user.id, id, dto.excluded);
  }
}
