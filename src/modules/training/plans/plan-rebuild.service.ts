import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { DomainBadRequestException, DomainConflictException } from '@/common/exceptions/domain-exceptions';
import { PlanGenerationService } from '@/modules/training/plans/plan-generation.service';
import { TRAINING_EVENTS } from '@/modules/training/training.events';

import type { ManualPlanGoalDto, ManualPlanScheduleDto, ManualPlanStructureDto } from '../dto/create-manual-plan.dto';
import type { PlanStartBlockDto } from '../dto/plan-metrics.dto';
import { TrainingPlan, TrainingPlanConfig, TrainingPlanMetricsSnapshot } from '../entities/training-plan.entity';
import { Workout } from '../entities/workout.entity';
import { PlanMetricsEnteredEvent } from '../events/plan-metrics-entered.event';
import { PlanUpdatedEvent } from '../events/plan-updated.event';
import { type AthleteMetrics, type PlanDiff, type RelativeWeek, TrainingEngine } from '../training.engine';
import { AthleteMetricsService, CurrentMetrics } from './athlete-metrics.service';
import { PlanEditingService } from './plan-editing.service';
import { PlanLifecycleService } from './plan-lifecycle.service';
import type { StartOptionsResult } from './plan-lifecycle.types';
import { PlanStartOptionsService } from './plan-start-options.service';
import {
  applyRelativeOverrides,
  asRelativeWeeks,
  averageFirstWeeksVolume,
  DatedPreview,
  relativeToPreview,
  RelativeWeekOverride,
} from './plan-structure';
import { todayIsoInTz } from './plan-utils';

export interface RebuildPreviewInput {
  goal: ManualPlanGoalDto;
  schedule: ManualPlanScheduleDto;
  structure: ManualPlanStructureDto;
  metrics: AthleteMetrics;
  target: 'new_draft' | 'in_place';
  timezone?: string;
}

export interface RebuildInput extends RebuildPreviewInput {
  weekOverrides?: RelativeWeekOverride[];
  expectedVersion?: number;
  name?: string;
  notes?: string | null;
  saveAsDraft?: boolean;
  start?: PlanStartBlockDto;
}

export interface RebuildPrefillResult {
  config: TrainingPlanConfig;
  goalSuggestion: {
    targetDate: string | null;
    previousTargetDate: string | null;
    previousResult: { timeSeconds: number; workoutId: string } | null;
  };
  metrics: {
    previous: TrainingPlanMetricsSnapshot | null;
    current: CurrentMetrics;
  };
}

export interface RebuildPreviewResult {
  mode: 'rebased' | 'regenerated';
  weeks: RelativeWeek[];
  preview: DatedPreview;
  diff: PlanDiff;
  warnings: string[];
  startOptions: StartOptionsResult;
}

const REBUILD_SOURCE_STATUSES = ['completed', 'cancelled', 'draft'];

/**
 * "Prepare again": builds a plan from the final version of a history plan
 * (or updates a draft) with the user's current metrics. When the structure
 * is unchanged the source workouts are kept and only re-targeted (paces) and
 * re-scaled (volumes); a structure change regenerates the plan. The source
 * plan is never modified when a new plan is created.
 */
@Injectable()
export class PlanRebuildService {
  constructor(
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly engine: TrainingEngine,
    private readonly planGenerationService: PlanGenerationService,
    private readonly lifecycleService: PlanLifecycleService,
    private readonly startOptions: PlanStartOptionsService,
    private readonly editingService: PlanEditingService,
    private readonly metricsService: AthleteMetricsService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /** Prefill of the rebuild steps: previous parameters, result and metrics. */
  async prefill(planId: string, actorUserId: string, timezone?: string): Promise<RebuildPrefillResult> {
    const plan = await this.loadSource(planId, actorUserId);
    const previousTargetDate = (plan.config?.goal?.targetDate as string | null | undefined) ?? null;
    const today = todayIsoInTz(timezone);

    const raceWorkout = await this.workoutModel.findOne({
      where: { planId: plan.id, type: 'race', status: 'completed', completedAt: { [Op.ne]: null } },
      order: [['completedAt', 'DESC']],
    });
    const raceDurationMinutes = Number(
      (raceWorkout?.actual as Record<string, unknown> | null)?.actualDurationMinutes ?? 0,
    );

    return {
      config: {
        goal: { ...(plan.config?.goal ?? {}) },
        schedule: { ...(plan.config?.schedule ?? {}) },
        structure: { ...(plan.config?.structure ?? {}) },
      },
      goalSuggestion: {
        // A past target date is dropped so the user picks the next race date.
        targetDate: previousTargetDate && previousTargetDate >= today ? previousTargetDate : null,
        previousTargetDate,
        previousResult:
          raceWorkout && raceDurationMinutes > 0
            ? { timeSeconds: Math.round(raceDurationMinutes * 60), workoutId: raceWorkout.id }
            : null,
      },
      metrics: {
        previous: plan.metricsSnapshot,
        current: await this.metricsService.currentMetrics(plan.athleteId),
      },
    };
  }

  /** Deterministic preview: same computation as the rebuild itself. */
  async preview(planId: string, actorUserId: string, input: RebuildPreviewInput): Promise<RebuildPreviewResult> {
    const plan = await this.loadSource(planId, actorUserId);
    this.ensureTargetAllowed(plan, input.target);
    this.ensureMetricsValid(input.metrics);

    const base = await this.baseWeeks(plan);
    const structureChanged = this.structureChanged(plan, input.structure);
    const warnings: string[] = [];
    let weeks: RelativeWeek[];
    let adjustments: PlanDiff['summary']['adjustments'] = [];

    if (structureChanged) {
      // Manual edits of the source cannot survive a regeneration; the client warns the user.
      warnings.push('STRUCTURE_CHANGED_REGENERATED');
      const generated = await this.planGenerationService.generateFromConfig(plan.athleteId, {
        goal: input.goal,
        schedule: input.schedule,
        structure: input.structure,
        metrics: input.metrics,
      });
      weeks = this.engine.toRelativeWeeks(generated);
      adjustments = [{ code: 'STRUCTURE_REGENERATED' }];
    } else {
      weeks = JSON.parse(JSON.stringify(base)) as RelativeWeek[];

      if (this.scheduleChanged(plan, input.schedule)) {
        const remap = this.engine.remapSchedule(weeks, input.schedule, 1);
        weeks = remap.weeks;
        if (remap.removed.length > 0) {
          warnings.push('WORKOUTS_REMOVED_NOT_ENOUGH_DAYS');
        }
      }

      const scaled = this.engine.scaleVolume(weeks, this.volumeScale(plan, base, input.metrics), input.metrics);
      weeks = this.engine.retargetIntensity(scaled.weeks, input.metrics);
      adjustments = scaled.adjustments;
    }

    const startOptions = await this.startOptions.buildStartOptions({
      athleteId: plan.athleteId,
      totalWeeks: weeks.length,
      targetDate: input.goal.targetDate ?? null,
      timezone: input.timezone,
      metricsStale: false,
    });
    const recommendedStart =
      startOptions.options.find((option) => option.kind === startOptions.recommended)?.startDate ?? startOptions.today;

    return {
      mode: structureChanged ? 'regenerated' : 'rebased',
      weeks,
      preview: relativeToPreview(this.engine, weeks, recommendedStart),
      diff: this.engine.diffPlans(base, weeks, plan.metricsSnapshot ?? undefined, input.metrics, adjustments),
      warnings,
      startOptions,
    };
  }

  /** Applies a rebuild: a new plan from a history plan, or an in-place draft update. */
  async rebuild(planId: string, actorUserId: string, input: RebuildInput): Promise<TrainingPlan> {
    const source = await this.loadSource(planId, actorUserId);
    const preview = await this.preview(planId, actorUserId, input);

    const weeks = applyRelativeOverrides(this.engine, preview.weeks, input.weekOverrides ?? [], {
      errorCode: 'PLAN_CHANGE_INVALID',
      thresholdPaceSecondsPerKm: input.metrics.thresholdPaceSecondsPerKm ?? null,
    });
    const metricsSnapshot: TrainingPlanMetricsSnapshot = {
      ...input.metrics,
      capturedAt: input.metrics.capturedAt ?? new Date().toISOString(),
      source: input.metrics.source ?? 'user_input',
    };
    if (metricsSnapshot.source === 'user_input') {
      this.eventEmitter.emit(
        TRAINING_EVENTS.PLAN_METRICS_ENTERED,
        new PlanMetricsEnteredEvent(source.athleteId, input.metrics),
      );
    }
    const config: TrainingPlanConfig = {
      goal: { ...input.goal } as Record<string, unknown>,
      schedule: { ...input.schedule } as Record<string, unknown>,
      structure: { ...input.structure } as Record<string, unknown>,
    };

    if (input.target === 'in_place') {
      return this.updateDraftInPlace(source, actorUserId, input, weeks, config, metricsSnapshot);
    }

    const startYear = (input.start?.startDate ?? new Date().toISOString()).slice(0, 4);
    return this.lifecycleService.createPlan(
      {
        athleteId: source.athleteId,
        name: input.name ?? `${source.name} ${startYear}`,
        notes: input.notes ?? null,
        config,
        creationSource: source.creationSource,
        trainingFrequency: input.structure.sessionsPerWeek,
        weeklyTargetKm: input.metrics.weeklyMileageKm ?? source.weeklyTargetKm,
        weeks,
        metricsSnapshot,
        sourcePlanId: source.id,
      },
      input.saveAsDraft ? null : (input.start ?? null),
      { metrics: metricsSnapshot },
    );
  }

  // ------------------------------------------------------------------ helpers

  private async updateDraftInPlace(
    source: TrainingPlan,
    actorUserId: string,
    input: RebuildInput,
    weeks: RelativeWeek[],
    config: TrainingPlanConfig,
    metricsSnapshot: TrainingPlanMetricsSnapshot,
  ): Promise<TrainingPlan> {
    return this.lifecycleService.inTransaction(async (transaction) => {
      const draft = await this.editingService.loadOwnedPlan(source.id, actorUserId, transaction);
      if (input.expectedVersion === undefined || draft.version !== input.expectedVersion) {
        throw new DomainConflictException(
          'PLAN_VERSION_CONFLICT',
          'The draft was modified concurrently; reload it and try again',
        );
      }

      draft.weeks = weeks as unknown as Array<Record<string, unknown>>;
      draft.config = config;
      draft.metricsSnapshot = metricsSnapshot;
      draft.trainingFrequency = input.structure.sessionsPerWeek;
      if (input.name) {
        draft.name = input.name;
      }
      if (input.notes !== undefined) {
        draft.notes = input.notes;
      }
      await draft.save({ transaction });

      transaction.afterCommit(() => {
        this.eventEmitter.emit(
          TRAINING_EVENTS.PLAN_UPDATED,
          new PlanUpdatedEvent(draft.athleteId, draft.id, 'rebuild'),
        );
      });
      return draft;
    });
  }

  private async loadSource(planId: string, actorUserId: string): Promise<TrainingPlan> {
    const plan = await this.editingService.loadOwnedPlan(planId, actorUserId);
    if (!REBUILD_SOURCE_STATUSES.includes(plan.status)) {
      throw new DomainConflictException('PLAN_INVALID_STATUS', 'Only history plans and drafts support rebuild');
    }
    return plan;
  }

  private ensureTargetAllowed(plan: TrainingPlan, target: RebuildPreviewInput['target']): void {
    if (target === 'in_place' && plan.status !== 'draft') {
      throw new DomainConflictException(
        'PLAN_INVALID_STATUS',
        'Only a draft can be updated in place; history plans are rebuilt into a new plan',
      );
    }
  }

  private ensureMetricsValid(metrics: AthleteMetrics): void {
    const violations = this.metricsService.validateMetrics(metrics);
    if (violations.length > 0) {
      throw new DomainBadRequestException('PLAN_METRICS_INVALID', `Invalid metrics: ${violations.join(', ')}`);
    }
  }

  /** Relative weeks the rebuild starts from: the draft itself or the final version of a history plan. */
  private async baseWeeks(plan: TrainingPlan): Promise<RelativeWeek[]> {
    if (plan.status === 'draft') {
      return asRelativeWeeks(plan.weeks);
    }

    const workouts = await this.workoutModel.findAll({ where: { planId: plan.id } });
    return this.engine.extractFinalVersion(
      { startDate: plan.startDate, endDate: plan.endDate },
      workouts.map((workout) => ({
        weekNumber: workout.weekNumber,
        orderInWeek: workout.orderInWeek,
        scheduledAt: workout.scheduledAt,
        type: workout.type,
        phase: workout.phase,
        durationMinutes: workout.durationMinutes,
        distanceKm: workout.distanceKm,
        target: (workout.target as Record<string, unknown>) ?? {},
        steps: (workout.steps as Array<Record<string, unknown>>) ?? [],
      })),
    );
  }

  private structureChanged(plan: TrainingPlan, structure: ManualPlanStructureDto): boolean {
    const current = (plan.config?.structure ?? {}) as {
      totalWeeks?: number;
      sessionsPerWeek?: number;
      focus?: string[];
    };
    const sameFocus =
      JSON.stringify([...(current.focus ?? [])].sort()) === JSON.stringify([...(structure.focus ?? [])].sort());
    return (
      Number(current.totalWeeks) !== structure.totalWeeks ||
      Number(current.sessionsPerWeek) !== structure.sessionsPerWeek ||
      !sameFocus
    );
  }

  private scheduleChanged(plan: TrainingPlan, schedule: ManualPlanScheduleDto): boolean {
    const current = (plan.config?.schedule ?? {}) as { trainingDays?: number[]; preferredLongRunDay?: number | null };
    const sameDays =
      JSON.stringify([...(current.trainingDays ?? [])].sort()) === JSON.stringify([...schedule.trainingDays].sort());
    return !sameDays || (current.preferredLongRunDay ?? null) !== (schedule.preferredLongRunDay ?? null);
  }

  /**
   * Volume scale = current weekly volume / volume at the source start. When
   * the source has no snapshot, the average of its first two weeks is the
   * baseline. Without a current volume nothing is scaled.
   */
  private volumeScale(plan: TrainingPlan, base: RelativeWeek[], metrics: AthleteMetrics): number {
    const snapshotBaseline = plan.metricsSnapshot?.weeklyMileageKm ?? null;
    const baseline = snapshotBaseline && snapshotBaseline > 0 ? snapshotBaseline : averageFirstWeeksVolume(base);
    const current = metrics.weeklyMileageKm ?? null;
    if (!baseline || !current || current <= 0) {
      return 1;
    }
    return current / baseline;
  }
}
