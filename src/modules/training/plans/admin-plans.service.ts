import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';

import { DomainException } from '@/common/exceptions/domain.exception';
import { UsersService } from '@/modules/users/users.service';

import { CreateManualPlanDto, PreviewManualPlanDto } from '../dto/create-manual-plan.dto';
import { ManualPlanPreviewResponseDto } from '../dto/manual-plan-preview-response.dto';
import {
  PlanChangesDto,
  PlanCountsResponseDto,
  StartPlanDto,
  UpdatePlanMetaDto,
  UpdatePlanStructureDto,
} from '../dto/plan-lifecycle.dto';
import { RebuildPreviewRequestDto, RebuildRequestDto } from '../dto/plan-rebuild.dto';
import { TrainingPlan } from '../entities/training-plan.entity';
import { AdminPlanAction, AdminPlanActionEvent } from '../events/admin-plan-action.event';
import { PlanListGroup } from '../training.constants';
import { TrainingService } from '../training.service';
import { CurrentMetrics } from './athlete-metrics.service';
import { PlanEditingService, PlanPreviewResult } from './plan-editing.service';
import { PlanLifecycleService, StartOptionsResult } from './plan-lifecycle.service';
import { PlanDetails, PlanListResult, PlanListService } from './plan-list.service';
import { PlanRebuildService, RebuildPrefillResult, RebuildPreviewResult } from './plan-rebuild.service';

/** Event name of the admin audit trail for plans. */
export const ADMIN_PLAN_ACTION_EVENT = 'training.plan.admin_action';

/**
 * Admin-panel management of any user's training plans.
 *
 * The plan services are keyed by the owner's user id, so the admin flow runs
 * the very same rules the athlete gets in the app — only with the target
 * user's id instead of the caller's. On top of that it checks the user and
 * athlete profile exist (an admin must not silently create a profile) and
 * records every mutation in the admin audit trail.
 */
@Injectable()
export class AdminPlansService {
  constructor(
    private readonly usersService: UsersService,
    private readonly trainingService: TrainingService,
    private readonly listService: PlanListService,
    private readonly editingService: PlanEditingService,
    private readonly lifecycleService: PlanLifecycleService,
    private readonly rebuildService: PlanRebuildService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // ------------------------------------------------------------------ reads

  /** Paginated plans of one group; empty for a user without an athlete profile. */
  async list(userId: string, group: PlanListGroup, page: number, limit: number): Promise<PlanListResult> {
    await this.usersService.findOne(userId);
    return this.listService.list(userId, group, page, limit);
  }

  async counts(userId: string): Promise<PlanCountsResponseDto> {
    await this.usersService.findOne(userId);
    return this.listService.counts(userId);
  }

  async getDetails(userId: string, planId: string): Promise<PlanDetails> {
    await this.usersService.findOne(userId);
    return this.listService.getDetails(planId, userId);
  }

  /** Current metrics estimate used to prefill the creation wizard. */
  async currentMetrics(userId: string): Promise<CurrentMetrics> {
    await this.ensureAthlete(userId);
    return this.trainingService.getCurrentMetrics(userId);
  }

  async startOptions(
    userId: string,
    planId: string,
    timezone?: string,
    goalTargetDate?: string,
  ): Promise<StartOptionsResult> {
    await this.usersService.findOne(userId);
    await this.editingService.loadOwnedPlan(planId, userId);
    return this.lifecycleService.getStartOptions(planId, timezone, goalTargetDate);
  }

  async previewChanges(userId: string, planId: string, dto: PlanChangesDto): Promise<PlanPreviewResult> {
    await this.usersService.findOne(userId);
    return this.editingService.previewChanges(planId, userId, dto);
  }

  async rebuildPrefill(userId: string, planId: string, timezone?: string): Promise<RebuildPrefillResult> {
    await this.usersService.findOne(userId);
    return this.rebuildService.prefill(planId, userId, timezone);
  }

  async rebuildPreview(userId: string, planId: string, dto: RebuildPreviewRequestDto): Promise<RebuildPreviewResult> {
    await this.usersService.findOne(userId);
    return this.rebuildService.preview(planId, userId, dto);
  }

  async previewManualPlan(userId: string, dto: PreviewManualPlanDto): Promise<ManualPlanPreviewResponseDto> {
    await this.ensureAthlete(userId);
    return this.trainingService.previewManualPlan(userId, dto);
  }

  // ------------------------------------------------------------------ writes

  /** Creates a plan for the user from the manual wizard; a draft unless a start block is given. */
  async createManualPlan(actorUserId: string, userId: string, dto: CreateManualPlanDto): Promise<PlanDetails> {
    await this.ensureAthlete(userId);
    const created = await this.trainingService.createManualPlan(userId, dto);
    this.audit(actorUserId, userId, created.id, 'created');
    return this.listService.getDetails(created.id, userId);
  }

  async updateMeta(actorUserId: string, userId: string, planId: string, dto: UpdatePlanMetaDto): Promise<TrainingPlan> {
    await this.usersService.findOne(userId);
    const plan = await this.editingService.updateMeta(planId, userId, dto);
    this.audit(actorUserId, userId, plan.id, 'meta_updated');
    return plan;
  }

  async updateStructure(
    actorUserId: string,
    userId: string,
    planId: string,
    dto: UpdatePlanStructureDto,
  ): Promise<TrainingPlan> {
    await this.usersService.findOne(userId);
    const plan = await this.editingService.updateDraftStructure(planId, userId, dto);
    this.audit(actorUserId, userId, plan.id, 'structure_updated');
    return plan;
  }

  async applyChanges(actorUserId: string, userId: string, planId: string, dto: PlanChangesDto): Promise<PlanDetails> {
    await this.usersService.findOne(userId);
    await this.editingService.applyChanges(planId, userId, dto);
    this.audit(actorUserId, userId, planId, 'changes_applied');
    return this.listService.getDetails(planId, userId);
  }

  /** Starts a draft; replacing the user's active plan still requires `replaceActive`. */
  async start(actorUserId: string, userId: string, planId: string, dto: StartPlanDto): Promise<PlanDetails> {
    await this.usersService.findOne(userId);
    await this.editingService.loadOwnedPlan(planId, userId);
    await this.lifecycleService.startPlan(planId, dto);
    this.audit(actorUserId, userId, planId, 'started');
    return this.listService.getDetails(planId, userId);
  }

  /** Cancels the active plan with the `admin` reason, so the history tells it apart from the athlete's own cancel. */
  async cancel(
    actorUserId: string,
    userId: string,
    planId: string,
    timezone?: string,
  ): Promise<{ plan: TrainingPlan; cancelledWorkouts: number }> {
    await this.usersService.findOne(userId);
    await this.editingService.loadOwnedPlan(planId, userId);
    const result = await this.lifecycleService.cancelActivePlan(planId, 'admin', timezone);
    this.audit(actorUserId, userId, planId, 'cancelled');
    return result;
  }

  async delete(actorUserId: string, userId: string, planId: string): Promise<void> {
    await this.usersService.findOne(userId);
    await this.editingService.deletePlan(planId, userId);
    this.audit(actorUserId, userId, planId, 'deleted');
  }

  /** "Prepare again": a history plan becomes a new plan, a draft is rebuilt in place. */
  async rebuild(actorUserId: string, userId: string, planId: string, dto: RebuildRequestDto): Promise<PlanDetails> {
    await this.usersService.findOne(userId);
    const plan = await this.rebuildService.rebuild(planId, userId, dto);
    this.audit(actorUserId, userId, plan.id, 'rebuilt');
    return this.listService.getDetails(plan.id, userId);
  }

  // ------------------------------------------------------------------ internals

  /**
   * Plan creation in the app creates a missing athlete profile on the fly;
   * from the admin panel that would invent profile data, so it is refused.
   */
  private async ensureAthlete(userId: string): Promise<void> {
    await this.usersService.findOne(userId);
    const athlete = await this.editingService.loadAthleteByUserId(userId);
    if (!athlete) {
      throw new DomainException(
        'ATHLETE_NOT_FOUND',
        `Athlete profile of user ${userId} not found`,
        HttpStatus.NOT_FOUND,
      );
    }
  }

  private audit(actorUserId: string, userId: string, planId: string, action: AdminPlanAction): void {
    this.eventEmitter.emit(ADMIN_PLAN_ACTION_EVENT, new AdminPlanActionEvent(actorUserId, userId, planId, action));
  }
}
