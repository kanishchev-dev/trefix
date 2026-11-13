import { Controller, Get, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';

import {
  ANALYTICS_ATTENTION_CACHE_TTL_MS,
  ANALYTICS_DEFAULT_TIMEZONE,
  ANALYTICS_PERIOD_DEFAULT,
  type AnalyticsPeriod,
} from './analytics.constants';
import { AnalyticsActivityQueryDto, AnalyticsAttentionQueryDto, AnalyticsQueryDto } from './dto/analytics-query.dto';
import {
  AnalyticsActivityResponseDto,
  AnalyticsAttentionResponseDto,
  AnalyticsAudienceResponseDto,
  AnalyticsCoachResponseDto,
  AnalyticsEngagementResponseDto,
  AnalyticsOutcomesResponseDto,
  AnalyticsPlansResponseDto,
  AnalyticsSummaryResponseDto,
} from './dto/analytics-response.dto';
import { type AnalyticsScope, resolveScope } from './lib/analytics-period';
import { ActivitySeriesService } from './services/activity-series.service';
import { AnalyticsCacheService } from './services/analytics-cache.service';
import { AttentionService } from './services/attention.service';
import { AudienceService } from './services/audience.service';
import { CoachAnalyticsService } from './services/coach-analytics.service';
import { EngagementService } from './services/engagement.service';
import { OutcomesService } from './services/outcomes.service';
import { PlansAnalyticsService } from './services/plans-analytics.service';
import { SummaryService } from './services/summary.service';

@ApiTags('Analytics')
@ApiBearerAuth()
@AdminEndpoint()
@RequirePermissions('analytics.read')
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(
    private readonly configService: ConfigService,
    private readonly cache: AnalyticsCacheService,
    private readonly summaryService: SummaryService,
    private readonly activityService: ActivitySeriesService,
    private readonly engagementService: EngagementService,
    private readonly outcomesService: OutcomesService,
    private readonly plansService: PlansAnalyticsService,
    private readonly coachService: CoachAnalyticsService,
    private readonly audienceService: AudienceService,
    private readonly attentionService: AttentionService,
  ) {}

  @Get('summary')
  @ApiOperation({
    summary: 'KPI cards: runners, plan adherence, goals, sign-ups, stickiness, records, distance, coach',
  })
  @ApiOkResponse({ type: AnalyticsSummaryResponseDto })
  summary(@Query() query: AnalyticsQueryDto): Promise<AnalyticsSummaryResponseDto> {
    const scope = this.scope(query);
    return this.cache.wrap('summary', this.key(scope), query, () => this.summaryService.summary(scope));
  }

  @Get('activity')
  @ApiOperation({ summary: 'Daily active users, runners, workouts and distance for the main chart' })
  @ApiOkResponse({ type: AnalyticsActivityResponseDto })
  activity(@Query() query: AnalyticsActivityQueryDto): Promise<AnalyticsActivityResponseDto> {
    const range = query.range ?? '90d';
    const scope = this.scope({ ...query, period: range });
    return this.cache.wrap('activity', this.key(scope), query, async () => ({
      range,
      ...(await this.activityService.series(scope)),
    }));
  }

  @Get('engagement')
  @ApiOperation({ summary: 'Regularity, habit formation, cohorts, sources and when people run' })
  @ApiOkResponse({ type: AnalyticsEngagementResponseDto })
  engagement(@Query() query: AnalyticsQueryDto): Promise<AnalyticsEngagementResponseDto> {
    const scope = this.scope(query);
    return this.cache.wrap('engagement', this.key(scope), query, () => this.engagementService.engagement(scope));
  }

  @Get('outcomes')
  @ApiOperation({ summary: 'Goals, form growth, records, races against the target, safe load' })
  @ApiOkResponse({ type: AnalyticsOutcomesResponseDto })
  outcomes(@Query() query: AnalyticsQueryDto): Promise<AnalyticsOutcomesResponseDto> {
    const scope = this.scope(query);
    return this.cache.wrap('outcomes', this.key(scope), query, () => this.outcomesService.outcomes(scope));
  }

  @Get('plans')
  @ApiOperation({ summary: 'Plans created, finished and abandoned, adherence by plan week, goals and races' })
  @ApiOkResponse({ type: AnalyticsPlansResponseDto })
  plans(@Query() query: AnalyticsQueryDto): Promise<AnalyticsPlansResponseDto> {
    const scope = this.scope(query);
    return this.cache.wrap('plans', this.key(scope), query, () => this.plansService.plans(scope));
  }

  @Get('coach')
  @ApiOperation({ summary: 'AI coach usage, proactive replies, correlation with results and LLM cost' })
  @ApiOkResponse({ type: AnalyticsCoachResponseDto })
  coach(@Query() query: AnalyticsQueryDto): Promise<AnalyticsCoachResponseDto> {
    const scope = this.scope(query);
    return this.cache.wrap('coach', this.key(scope), query, () => this.coachService.coach(scope));
  }

  @Get('audience')
  @ApiOperation({ summary: 'Sign-ups, activation funnel, platforms, integrations, experience, languages' })
  @ApiOkResponse({ type: AnalyticsAudienceResponseDto })
  audience(@Query() query: AnalyticsQueryDto): Promise<AnalyticsAudienceResponseDto> {
    const scope = this.scope(query);
    return this.cache.wrap('audience', this.key(scope), query, () => this.audienceService.audience(scope));
  }

  @Get('attention-items')
  @ApiOperation({ summary: 'Users that need an administrator, by kind of problem' })
  @ApiOkResponse({ type: AnalyticsAttentionResponseDto })
  attention(@Query() query: AnalyticsAttentionQueryDto): Promise<AnalyticsAttentionResponseDto> {
    const scope = this.scope(query);
    const filter = {
      types: query.type,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
      sortBy: query.sortBy ?? 'severity',
    };
    return this.cache.wrap(
      'attention',
      { ...this.key(scope), ...filter },
      { refresh: query.refresh, ttlMs: ANALYTICS_ATTENTION_CACHE_TTL_MS },
      () => this.attentionService.items(scope, filter),
    );
  }

  private scope(query: AnalyticsQueryDto & { period?: AnalyticsPeriod }): AnalyticsScope {
    const timezone =
      query.timezone ?? this.configService.get<string>('analytics.defaultTimezone') ?? ANALYTICS_DEFAULT_TIMEZONE;
    return resolveScope(query.period ?? ANALYTICS_PERIOD_DEFAULT, timezone, query.includeStaff ?? false);
  }

  /** Cache key parts: the resolved day matters, so blocks roll over at midnight. */
  private key(scope: AnalyticsScope): Record<string, unknown> {
    return { period: scope.period, tz: scope.timezone, staff: scope.includeStaff, today: scope.today };
  }
}
