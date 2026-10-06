import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';
import { AuthUserContext } from '@/modules/auth/interfaces/auth-user-context.interface';

import { PlanDetailsDto } from '../dto/plan-details.dto';
import {
  ActivePlanResponseDto,
  CancelPlanDto,
  CancelPlanResponseDto,
  PlanChangesDto,
  PlanChangesPreviewResponseDto,
  PlanCountsResponseDto,
  PlanListQueryDto,
  PlanListResponseDto,
  PlanMetaResponseDto,
  PlanVersionResponseDto,
  StartOptionsQueryDto,
  StartOptionsResponseDto,
  StartPlanDto,
  TimezoneQueryDto,
  UpdatePlanMetaDto,
  UpdatePlanStructureDto,
} from '../dto/plan-lifecycle.dto';
import {
  RebuildPrefillQueryDto,
  RebuildPrefillResponseDto,
  RebuildPreviewRequestDto,
  RebuildPreviewResponseDto,
  RebuildRequestDto,
} from '../dto/plan-rebuild.dto';
import { PLAN_CREATE_THROTTLE } from './plan-create-throttle';
import { PlanEditingService, PlanPreviewResult } from './plan-editing.service';
import { PlanLifecycleService, StartOptionsResult } from './plan-lifecycle.service';
import { PlanDetails, PlanListResult, PlanListService } from './plan-list.service';
import { PlanRebuildService, RebuildPrefillResult, RebuildPreviewResult } from './plan-rebuild.service';
import { ActivePlanSummary } from './plan-stats.service';

/** Plans library: lifecycle, editing and rebuild. Creation stays in TrainingController. */
@ApiTags('Training Plans')
@ApiBearerAuth()
@Controller({ path: 'plans', version: '1' })
export class PlansController {
  constructor(
    private readonly planListService: PlanListService,
    private readonly planEditingService: PlanEditingService,
    private readonly planLifecycleService: PlanLifecycleService,
    private readonly planRebuildService: PlanRebuildService,
  ) {}

  @Get()
  @RequirePermissions('training.plans.read')
  @ApiOperation({ summary: 'List plans of a group: draft, active or history (completed and cancelled)' })
  @ApiOkResponse({ type: PlanListResponseDto })
  list(@CurrentUser() user: AuthUserContext, @Query() query: PlanListQueryDto): Promise<PlanListResult> {
    return this.planListService.list(user.id, query.group, query.page ?? 1, query.limit ?? 20);
  }

  @Get('counts')
  @RequirePermissions('training.plans.read')
  @ApiOperation({ summary: 'Number of plans per group' })
  @ApiOkResponse({ type: PlanCountsResponseDto })
  counts(@CurrentUser() user: AuthUserContext): Promise<PlanCountsResponseDto> {
    return this.planListService.counts(user.id);
  }

  @Get('active')
  @RequirePermissions('training.plans.read')
  @ApiOperation({ summary: 'The active plan; always 200, `plan` is null when there is none' })
  @ApiOkResponse({ type: ActivePlanResponseDto })
  async getActive(
    @CurrentUser() user: AuthUserContext,
    @Query() query: TimezoneQueryDto,
  ): Promise<{ plan: ActivePlanSummary | null }> {
    return { plan: await this.planListService.getActive(user.id, query.timezone) };
  }

  @Get(':id')
  @RequirePermissions('training.plans.read')
  @ApiOperation({ summary: 'Plan details' })
  @ApiOkResponse({ type: PlanDetailsDto })
  getDetails(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<PlanDetails> {
    return this.planListService.getDetails(id, user.id);
  }

  @Patch(':id')
  @RequirePermissions('training.plans.update')
  @ApiOperation({ summary: 'Rename a plan or edit its notes (any status)' })
  @ApiOkResponse({ type: PlanMetaResponseDto })
  async updateMeta(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: UpdatePlanMetaDto,
  ): Promise<PlanMetaResponseDto> {
    const plan = await this.planEditingService.updateMeta(id, user.id, dto);
    return { id: plan.id, name: plan.name, notes: plan.notes, version: plan.version };
  }

  @Delete(':id')
  @RequirePermissions('training.plans.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a draft or history plan' })
  @ApiNoContentResponse()
  async delete(@CurrentUser() user: AuthUserContext, @Param('id') id: string): Promise<void> {
    await this.planEditingService.deletePlan(id, user.id);
  }

  @Put(':id/structure')
  @RequirePermissions('training.plans.update')
  @ApiOperation({ summary: 'Edit workouts of a draft by key' })
  @ApiOkResponse({ type: PlanVersionResponseDto })
  async updateStructure(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: UpdatePlanStructureDto,
  ): Promise<PlanVersionResponseDto> {
    const plan = await this.planEditingService.updateDraftStructure(id, user.id, dto);
    return { version: plan.version };
  }

  @Get(':id/start-options')
  @RequirePermissions('training.plans.read')
  @ApiOperation({ summary: 'Start options of a draft: today, next Monday, race aligned, active plan warning' })
  @ApiOkResponse({ type: StartOptionsResponseDto })
  async getStartOptions(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Query() query: StartOptionsQueryDto,
  ): Promise<StartOptionsResult> {
    await this.planEditingService.loadOwnedPlan(id, user.id);
    return this.planLifecycleService.getStartOptions(id, query.timezone, query.goalTargetDate);
  }

  @Post(':id/start')
  @Throttle(PLAN_CREATE_THROTTLE)
  @RequirePermissions('training.plans.create')
  @ApiOperation({ summary: 'Start a draft; replacing the active plan requires replaceActive=true' })
  @ApiOkResponse({ type: PlanDetailsDto })
  async start(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: StartPlanDto,
  ): Promise<PlanDetails> {
    await this.planEditingService.loadOwnedPlan(id, user.id);
    await this.planLifecycleService.startPlan(id, dto);
    return this.planListService.getDetails(id, user.id);
  }

  @Post(':id/cancel')
  @RequirePermissions('training.plans.update')
  @ApiOperation({ summary: 'Cancel the active plan' })
  @ApiOkResponse({ type: CancelPlanResponseDto })
  async cancel(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: CancelPlanDto,
  ): Promise<CancelPlanResponseDto> {
    await this.planEditingService.loadOwnedPlan(id, user.id);
    const result = await this.planLifecycleService.cancelActivePlan(id, 'user', dto.timezone);
    return { id: result.plan.id, status: result.plan.status, cancelledWorkouts: result.cancelledWorkouts };
  }

  @Post(':id/changes/preview')
  @RequirePermissions('training.plans.read')
  @ApiOperation({ summary: 'Diff of a change of the active plan; nothing is persisted' })
  @ApiOkResponse({ type: PlanChangesPreviewResponseDto })
  previewChanges(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: PlanChangesDto,
  ): Promise<PlanPreviewResult> {
    return this.planEditingService.previewChanges(id, user.id, dto);
  }

  @Post(':id/changes')
  @RequirePermissions('training.plans.update')
  @ApiOperation({ summary: 'Apply a change of the active plan' })
  @ApiOkResponse({ type: PlanDetailsDto })
  async applyChanges(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: PlanChangesDto,
  ): Promise<PlanDetails> {
    await this.planEditingService.applyChanges(id, user.id, dto);
    return this.planListService.getDetails(id, user.id);
  }

  @Get(':id/rebuild/prefill')
  @RequirePermissions('training.plans.read')
  @ApiOperation({ summary: 'Prefill of "prepare again": parameters, previous result and current metrics' })
  @ApiOkResponse({ type: RebuildPrefillResponseDto })
  rebuildPrefill(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Query() query: RebuildPrefillQueryDto,
  ): Promise<RebuildPrefillResult> {
    return this.planRebuildService.prefill(id, user.id, query.timezone);
  }

  @Post(':id/rebuild/preview')
  @RequirePermissions('training.plans.read')
  @ApiOperation({ summary: 'Rebuild preview with mode, diff and start options' })
  @ApiOkResponse({ type: RebuildPreviewResponseDto })
  rebuildPreview(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: RebuildPreviewRequestDto,
  ): Promise<RebuildPreviewResult> {
    return this.planRebuildService.preview(id, user.id, dto);
  }

  @Post(':id/rebuild')
  @Throttle(PLAN_CREATE_THROTTLE)
  @RequirePermissions('training.plans.create')
  @ApiOperation({ summary: 'Rebuild a history plan into a new plan, or update a draft in place' })
  @ApiOkResponse({ type: PlanDetailsDto })
  async rebuild(
    @CurrentUser() user: AuthUserContext,
    @Param('id') id: string,
    @Body() dto: RebuildRequestDto,
  ): Promise<PlanDetails> {
    const plan = await this.planRebuildService.rebuild(id, user.id, dto);
    return this.planListService.getDetails(plan.id, user.id);
  }
}
