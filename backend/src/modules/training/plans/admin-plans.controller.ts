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
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { AdminEndpoint } from '@/common/decorators/admin-endpoint.decorator';
import { RequirePermissions } from '@/common/decorators/require-permissions.decorator';

import { CreateManualPlanDto, PreviewManualPlanDto } from '../dto/create-manual-plan.dto';
import { ManualPlanPreviewResponseDto } from '../dto/manual-plan-preview-response.dto';
import { PlanDetailsDto } from '../dto/plan-details.dto';
import {
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
import { CurrentMetricsDto } from '../dto/plan-shapes.dto';
import { AdminPlansService } from './admin-plans.service';
import { CurrentMetrics } from './athlete-metrics.service';
import { PLAN_CREATE_THROTTLE } from './plan-create-throttle';
import { PlanPreviewResult } from './plan-editing.service';
import type { StartOptionsResult } from './plan-lifecycle.types';
import { PlanDetails, PlanListResult } from './plan-list.service';
import { RebuildPrefillResult, RebuildPreviewResult } from './plan-rebuild.service';

const DEFAULT_PAGE_LIMIT = 20;

/**
 * Admin-panel management of any user's training plans: the plans library,
 * the creation wizard, editing, lifecycle and "prepare again". Static routes
 * (`counts`, `manual`) are declared before the parameterised `:planId` ones.
 */
@ApiTags('Admin Training Plans')
@ApiBearerAuth()
@ApiParam({ name: 'userId', format: 'uuid', description: 'Owner of the plans' })
@ApiNotFoundResponse({ description: 'USER_NOT_FOUND, ATHLETE_NOT_FOUND, TRAINING_PLAN_NOT_FOUND' })
@AdminEndpoint()
@Controller({ path: 'users/:userId/training', version: '1' })
export class AdminPlansController {
  constructor(private readonly adminPlansService: AdminPlansService) {}

  // ------------------------------------------------------------------ library

  @Get('plans/counts')
  @RequirePermissions('training.userplans.read')
  @ApiOperation({ summary: 'Number of plans per group' })
  @ApiOkResponse({ type: PlanCountsResponseDto })
  counts(@Param('userId', ParseUUIDPipe) userId: string): Promise<PlanCountsResponseDto> {
    return this.adminPlansService.counts(userId);
  }

  @Get('plans')
  @RequirePermissions('training.userplans.read')
  @ApiOperation({ summary: 'Plans of a group: draft, active or history' })
  @ApiOkResponse({ type: PlanListResponseDto })
  list(@Param('userId', ParseUUIDPipe) userId: string, @Query() query: PlanListQueryDto): Promise<PlanListResult> {
    return this.adminPlansService.list(userId, query.group, query.page ?? 1, query.limit ?? DEFAULT_PAGE_LIMIT);
  }

  @Get('current-metrics')
  @RequirePermissions('training.userplans.read')
  @ApiOperation({ summary: 'Current metrics estimate of the athlete, for the creation wizard prefill' })
  @ApiOkResponse({ type: CurrentMetricsDto })
  currentMetrics(@Param('userId', ParseUUIDPipe) userId: string): Promise<CurrentMetrics> {
    return this.adminPlansService.currentMetrics(userId);
  }

  // ------------------------------------------------------------------ creation

  @Post('plans/manual/preview')
  @RequirePermissions('training.userplans.manage')
  @ApiOperation({ summary: 'Preview a manually configured plan for the user (not persisted)' })
  @ApiOkResponse({ type: ManualPlanPreviewResponseDto })
  previewManualPlan(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: PreviewManualPlanDto,
  ): Promise<ManualPlanPreviewResponseDto> {
    return this.adminPlansService.previewManualPlan(userId, dto);
  }

  @Post('plans/manual')
  @Throttle(PLAN_CREATE_THROTTLE)
  @RequirePermissions('training.userplans.manage')
  @ApiOperation({ summary: 'Create a plan for the user: a draft, or started with a start block' })
  @ApiCreatedResponse({ type: PlanDetailsDto })
  @ApiConflictResponse({ description: 'ACTIVE_PLAN_EXISTS, PLANS_LIMIT_REACHED' })
  createManualPlan(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreateManualPlanDto,
  ): Promise<PlanDetails> {
    return this.adminPlansService.createManualPlan(userId, dto);
  }

  // ------------------------------------------------------------------ single plan

  @Get('plans/:planId')
  @RequirePermissions('training.userplans.read')
  @ApiOperation({ summary: 'Plan details with weeks and dated workouts' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: PlanDetailsDto })
  getDetails(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
  ): Promise<PlanDetails> {
    return this.adminPlansService.getDetails(userId, planId);
  }

  @Patch('plans/:planId')
  @RequirePermissions('training.userplans.manage')
  @ApiOperation({ summary: 'Rename a plan or edit its notes (any status)' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: PlanMetaResponseDto })
  @ApiConflictResponse({ description: 'PLAN_VERSION_CONFLICT' })
  async updateMeta(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePlanMetaDto,
  ): Promise<PlanMetaResponseDto> {
    const plan = await this.adminPlansService.updateMeta(userId, planId, dto);
    return { id: plan.id, name: plan.name, notes: plan.notes, version: plan.version };
  }

  @Delete('plans/:planId')
  @RequirePermissions('training.userplans.manage')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a draft or history plan' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiNoContentResponse()
  @ApiConflictResponse({ description: 'PLAN_ACTIVE_CANNOT_DELETE' })
  async delete(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
  ): Promise<void> {
    await this.adminPlansService.delete(userId, planId);
  }

  @Put('plans/:planId/structure')
  @RequirePermissions('training.userplans.manage')
  @ApiOperation({ summary: 'Edit workouts of a draft by key' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: PlanVersionResponseDto })
  async updateStructure(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: UpdatePlanStructureDto,
  ): Promise<PlanVersionResponseDto> {
    const plan = await this.adminPlansService.updateStructure(userId, planId, dto);
    return { version: plan.version };
  }

  // ------------------------------------------------------------------ lifecycle

  @Get('plans/:planId/start-options')
  @RequirePermissions('training.userplans.read')
  @ApiOperation({ summary: 'Start options of a draft and the active plan warning' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: StartOptionsResponseDto })
  startOptions(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Query() query: StartOptionsQueryDto,
  ): Promise<StartOptionsResult> {
    return this.adminPlansService.startOptions(userId, planId, query.timezone, query.goalTargetDate);
  }

  @Post('plans/:planId/start')
  @Throttle(PLAN_CREATE_THROTTLE)
  @RequirePermissions('training.userplans.manage')
  @ApiOperation({ summary: 'Start a draft; replacing the active plan requires replaceActive=true' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: PlanDetailsDto })
  @ApiConflictResponse({ description: 'ACTIVE_PLAN_EXISTS, PLAN_INVALID_STATUS' })
  start(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: StartPlanDto,
  ): Promise<PlanDetails> {
    return this.adminPlansService.start(userId, planId, dto);
  }

  @Post('plans/:planId/cancel')
  @RequirePermissions('training.userplans.manage')
  @ApiOperation({ summary: 'Cancel the active plan; future workouts are cancelled, history stays' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: CancelPlanResponseDto })
  async cancel(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: CancelPlanDto,
  ): Promise<CancelPlanResponseDto> {
    const result = await this.adminPlansService.cancel(userId, planId, dto.timezone);
    return { id: result.plan.id, status: result.plan.status, cancelledWorkouts: result.cancelledWorkouts };
  }

  @Post('plans/:planId/changes/preview')
  @RequirePermissions('training.userplans.read')
  @ApiOperation({ summary: 'Diff of a change of the active plan; nothing is persisted' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: PlanChangesPreviewResponseDto })
  previewChanges(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: PlanChangesDto,
  ): Promise<PlanPreviewResult> {
    return this.adminPlansService.previewChanges(userId, planId, dto);
  }

  @Post('plans/:planId/changes')
  @RequirePermissions('training.userplans.manage')
  @ApiOperation({ summary: 'Apply a change of the active plan' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: PlanDetailsDto })
  @ApiConflictResponse({ description: 'PLAN_VERSION_CONFLICT, PLAN_CHANGE_INVALID, WORKOUT_LOCKED' })
  applyChanges(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: PlanChangesDto,
  ): Promise<PlanDetails> {
    return this.adminPlansService.applyChanges(userId, planId, dto);
  }

  // ------------------------------------------------------------------ rebuild

  @Get('plans/:planId/rebuild/prefill')
  @RequirePermissions('training.userplans.read')
  @ApiOperation({ summary: 'Prefill of "prepare again": parameters, previous result and current metrics' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: RebuildPrefillResponseDto })
  rebuildPrefill(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Query() query: RebuildPrefillQueryDto,
  ): Promise<RebuildPrefillResult> {
    return this.adminPlansService.rebuildPrefill(userId, planId, query.timezone);
  }

  @Post('plans/:planId/rebuild/preview')
  @RequirePermissions('training.userplans.read')
  @ApiOperation({ summary: 'Rebuild preview with mode, diff and start options' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: RebuildPreviewResponseDto })
  rebuildPreview(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: RebuildPreviewRequestDto,
  ): Promise<RebuildPreviewResult> {
    return this.adminPlansService.rebuildPreview(userId, planId, dto);
  }

  @Post('plans/:planId/rebuild')
  @Throttle(PLAN_CREATE_THROTTLE)
  @RequirePermissions('training.userplans.manage')
  @ApiOperation({ summary: 'Rebuild a history plan into a new plan, or update a draft in place' })
  @ApiParam({ name: 'planId', format: 'uuid' })
  @ApiOkResponse({ type: PlanDetailsDto })
  rebuild(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('planId', ParseUUIDPipe) planId: string,
    @Body() dto: RebuildRequestDto,
  ): Promise<PlanDetails> {
    return this.adminPlansService.rebuild(userId, planId, dto);
  }
}
