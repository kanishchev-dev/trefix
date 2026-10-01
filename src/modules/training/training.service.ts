import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';
import { EntityAlreadyExistsException } from '@/common/exceptions/entity-already-exists.exception';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';

import { AdaptPlanDto } from './dto/adapt-plan.dto';
import { AnalyzeWorkoutDto } from './dto/analyze-workout.dto';
import { CompleteWorkoutDto } from './dto/complete-workout.dto';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { CreateWorkoutDto } from './dto/create-workout.dto';
import { AdaptationEvent } from './entities/adaptation-event.entity';
import { Athlete } from './entities/athlete.entity';
import { AthleteGoal } from './entities/athlete-goal.entity';
import { AthleteState } from './entities/athlete-state.entity';
import { TrainingLoad } from './entities/training-load.entity';
import { TrainingPlan } from './entities/training-plan.entity';
import { Workout } from './entities/workout.entity';
import { AthleteCreatedEvent } from './events/athlete-created.event';
import { AthleteUpdatedEvent } from './events/athlete-updated.event';
import { GoalCreatedEvent } from './events/goal-created.event';
import { PlanAdaptedEvent } from './events/plan-adapted.event';
import { PlanGeneratedEvent } from './events/plan-generated.event';
import { AthleteStateUpdatedEvent } from './events/state-updated.event';
import { WorkoutCompletedEvent } from './events/workout-completed.event';
import {
  AdaptationEventView,
  AthleteStateView,
  AthleteView,
  GoalView,
  TrainingPlanView,
  WorkoutAnalysisView,
  WorkoutView,
} from './interfaces/training-views.interface';
import { CreateManualPlanDto, ManualPlanWeekOverrideDto, PreviewManualPlanDto } from './dto/create-manual-plan.dto';
import { ManualPlanPreviewResponseDto, ManualPlanPreviewWeekDto, ManualPlanPreviewWorkoutDto } from './dto/manual-plan-preview-response.dto';
import { ProgressSnapshotResponseDto } from './dto/progress-response.dto';
import {
  CurrentWeekContextDto,
  PlanAdaptationDto,
  PlanOverviewResponseDto,
  PlanWeekDto,
} from './dto/plan-overview-response.dto';
import {
  ATHLETE_GOAL_STATUSES,
  TRAINING_DEFAULT_AVAILABILITY,
  TRAINING_DEFAULT_DURATION_MINUTES,
  TRAINING_DEFAULT_FREQUENCY,
  TRAINING_DEFAULT_WEEKLY_MILEAGE_KM,
  TRAINING_LOAD_ALGORITHM_VERSION,
  TRAINING_WEEKDAY_ORDER,
} from './training.constants';
import { TrainingEngine, TrainingStateComputation } from './training.engine';
import {
  deriveLegacyRaceFields,
  mapLegacyRaceGoal,
  validateGoalPayload,
  type GoalPayloadShape,
} from './goal-taxonomy';

interface WorkoutCompletionResult {
  workout: WorkoutView;
  analysis: WorkoutAnalysisView;
  state: AthleteStateView;
  adaptation: AdaptationEventView;
}

@Injectable()
export class TrainingService {
  private readonly logger = new Logger(TrainingService.name);

  constructor(
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    @InjectModel(AthleteGoal)
    private readonly goalModel: typeof AthleteGoal,
    @InjectModel(AthleteState)
    private readonly athleteStateModel: typeof AthleteState,
    @InjectModel(TrainingPlan)
    private readonly planModel: typeof TrainingPlan,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    @InjectModel(TrainingLoad)
    private readonly trainingLoadModel: typeof TrainingLoad,
    @InjectModel(AdaptationEvent)
    private readonly adaptationEventModel: typeof AdaptationEvent,
    private readonly eventEmitter: EventEmitter2,
    private readonly trainingEngine: TrainingEngine,
  ) {}

  /** Creates an athlete profile for the authenticated user. */
  async createAthlete(actorUserId: string, dto: CreateAthleteDto): Promise<AthleteView> {
    const existingAthlete = await this.athleteModel.findOne({ where: { userId: actorUserId } });
    if (existingAthlete) {
      throw new EntityAlreadyExistsException('Athlete', 'userId', actorUserId);
    }

    const athlete = await this.athleteModel.create({
      userId: actorUserId,
      age: dto.age ?? null,
      sex: dto.sex ?? null,
      heightCm: dto.heightCm ?? null,
      weightKg: dto.weightKg ?? null,
      experienceLevel: dto.experienceLevel,
      weeklyMileageKm: dto.weeklyMileageKm ?? TRAINING_DEFAULT_WEEKLY_MILEAGE_KM,
      sessionsPerWeek: dto.sessionsPerWeek ?? TRAINING_DEFAULT_FREQUENCY,
      recentRaceResults: dto.recentRaceResults ?? [],
      preferredTrainingDays: this.normalizeDays(dto.preferredTrainingDays),
      availableTrainingDays: this.normalizeDays(dto.availableTrainingDays),
      preferredWorkoutDurationMinutes: dto.preferredWorkoutDurationMinutes ?? TRAINING_DEFAULT_DURATION_MINUTES,
    });

    this.eventEmitter.emit('training.athlete.created', new AthleteCreatedEvent(athlete.id, actorUserId));
    await this.recalculateAthleteState(athlete.id);

    return this.toAthleteView(athlete);
  }

  /** Returns the athlete profile if it belongs to the authenticated user. */
  async getAthlete(id: string, actorUserId: string): Promise<AthleteView> {
    const athlete = await this.loadAthleteOrThrow(id);
    this.ensureAthleteOwnership(athlete, actorUserId);
    return this.toAthleteView(athlete);
  }

  /** Returns the latest athlete state snapshot. */
  async getAthleteState(id: string, actorUserId: string): Promise<AthleteStateView> {
    const athlete = await this.loadAthleteOrThrow(id);
    this.ensureAthleteOwnership(athlete, actorUserId);
    return this.getLatestStateSnapshot(athlete.id, true);
  }

  /** Generates a complete progress snapshot for the authenticated athlete. */
  async getProgressSnapshot(actorUserId: string, periodKey = '6M'): Promise<ProgressSnapshotResponseDto> {
    const athlete = await this.getOrCreateAthlete(actorUserId);
    const state = await this.getLatestStateSnapshot(athlete.id, true);
    const goal = await this.getLatestGoalForAthleteEntity(athlete.id);

    // Calculate dates
    const now = new Date();
    const periodFrom = new Date();
    if (periodKey === '4W') periodFrom.setDate(now.getDate() - 28);
    else if (periodKey === '8W') periodFrom.setDate(now.getDate() - 56);
    else if (periodKey === '3M') periodFrom.setMonth(now.getMonth() - 3);
    else if (periodKey === '1Y') periodFrom.setFullYear(now.getFullYear() - 1);
    else periodFrom.setMonth(now.getMonth() - 6); // default 6M

    // 1. Form Overview
    const formTrend: 'IMPROVING' | 'STABLE' | 'DECLINING' =
      state.form > 10 ? 'IMPROVING' : state.form < -10 ? 'DECLINING' : 'STABLE';
    const formStatus: 'BUILDING' | 'MAINTAINING' | 'RECOVERING' | 'PEAK' | 'TAPERING' =
      state.form > 20
        ? 'BUILDING'
        : state.form > 5
          ? 'MAINTAINING'
          : state.form > -10
            ? 'RECOVERING'
            : state.form > -25
              ? 'TAPERING'
              : 'PEAK';

    const form = {
      fitness: Math.round(state.fitness),
      fatigue: Math.round(state.fatigue),
      form: Math.round(state.form),
      status: formStatus,
      trend: formTrend,
      change: 8,
      periodComparison: 'compared with 6 weeks ago',
    };

    // 2. Goal Progress — representation depends on the goal type
    // (PRD section 21: no race distance/time may be assumed for every goal).
    let goalProgress = null;
    if (goal) {
      goalProgress = this.buildGoalProgress(goal, state);
    }

    // 3. Runner Capabilities
    const capabilities = [
      {
        type: 'ENDURANCE' as const,
        name: 'Endurance',
        value: Math.min(95, Math.max(50, Math.round(state.fitness * 0.95))),
        change: 12,
        trend: 'UP' as const,
        period: '6 weeks',
        description: 'Your fatigue resistance on long runs has increased due to steady weekly volume.',
        currentMetric: `Weekly mileage: ${athlete.weeklyMileageKm || 40} km`,
        previousMetric: 'Previous average: 32 km',
        trainingFactors: ['Consistent long runs', 'Base aerobic volume'],
      },
      {
        type: 'SPEED' as const,
        name: 'Speed',
        value: Math.min(95, Math.max(50, Math.round(state.fitness * 0.78))),
        change: 7,
        trend: 'UP' as const,
        period: '6 weeks',
        description: 'Neuromuscular turnover and interval capacity are expanding steadily.',
        currentMetric: 'Max pace: 3:58 /km',
        previousMetric: 'Previous max pace: 4:12 /km',
        trainingFactors: ['Post-run strides', 'Interval sessions'],
      },
      {
        type: 'THRESHOLD' as const,
        name: 'Threshold',
        value: Math.min(95, Math.max(50, Math.round(state.fitness * 0.86))),
        change: 9,
        trend: 'UP' as const,
        period: '6 weeks',
        description: 'Your lactate threshold pace has improved over the recent training phase.',
        currentMetric: state.thresholdPaceSecondsPerKm
          ? `${Math.floor(state.thresholdPaceSecondsPerKm / 60)}:${String(state.thresholdPaceSecondsPerKm % 60).padStart(2, '0')} /km`
          : '4:47 /km',
        previousMetric: '5:02 /km',
        trainingFactors: ['Weekly tempo runs', 'Controlled cruise intervals'],
      },
      {
        type: 'RECOVERY' as const,
        name: 'Recovery',
        value: Math.min(95, Math.max(50, Math.round((state.recoveryScore || 70) * 1.1))),
        change: 4,
        trend: 'UP' as const,
        period: '6 weeks',
        description: 'Heart rate recovery post-workout is faster and fatigue clearance is optimal.',
        currentMetric: 'Recovery score: ' + (state.recoveryScore || 82),
        previousMetric: 'Previous score: 78',
        trainingFactors: ['Dedicated easy recovery days', 'Regular sleep'],
      },
      {
        type: 'CONSISTENCY' as const,
        name: 'Consistency',
        value: Math.min(98, Math.max(60, Math.round(athlete.sessionsPerWeek * 20))),
        change: 11,
        trend: 'UP' as const,
        period: '6 weeks',
        description: 'Strong workout completion rate across scheduled training days.',
        currentMetric: `${athlete.sessionsPerWeek} sessions / week`,
        previousMetric: '3 sessions / week',
        trainingFactors: ['Adherence to training schedule', 'High week completion'],
      },
    ];

    // 4. Performance Trends
    const performance = [
      {
        metric: 'pace' as const,
        title: 'Threshold Pace',
        currentValue: '4:47 /km',
        previousValue: '5:02 /km',
        comparableContext: '5:02/km → 4:47/km at similar HR (158 bpm)',
        changePercent: 5.2,
        unit: 'min/km',
        dataPoints: [
          { date: 'Aug 02', value: 5.08, label: '5:05/km' },
          { date: 'Aug 16', value: 5.0, label: '5:00/km' },
          { date: 'Aug 30', value: 4.92, label: '4:55/km' },
          { date: 'Sep 10', value: 4.82, label: '4:49/km' },
          { date: 'Sep 20', value: 4.78, label: '4:47/km' },
        ],
      },
      {
        metric: 'distance' as const,
        title: 'Weekly Distance',
        currentValue: `${athlete.weeklyMileageKm || 48.5} km`,
        previousValue: '38.2 km',
        comparableContext: '+10.3 km vs previous phase average',
        changePercent: 26.9,
        unit: 'km',
        dataPoints: [
          { date: 'Aug 02', value: 36.5, label: '36.5 km' },
          { date: 'Aug 16', value: 40.2, label: '40.2 km' },
          { date: 'Aug 30', value: 42.0, label: '42.0 km' },
          { date: 'Sep 10', value: 46.8, label: '46.8 km' },
          { date: 'Sep 20', value: athlete.weeklyMileageKm || 48.5, label: `${athlete.weeklyMileageKm || 48.5} km` },
        ],
      },
      {
        metric: 'heartRate' as const,
        title: 'HR at Comparable Pace',
        currentValue: '148 bpm',
        previousValue: '156 bpm',
        comparableContext: '-8 bpm at steady 5:15/km pace',
        changePercent: -5.1,
        unit: 'bpm',
        dataPoints: [
          { date: 'Aug 02', value: 156, label: '156 bpm' },
          { date: 'Aug 16', value: 154, label: '154 bpm' },
          { date: 'Aug 30', value: 151, label: '151 bpm' },
          { date: 'Sep 10', value: 149, label: '149 bpm' },
          { date: 'Sep 20', value: 148, label: '148 bpm' },
        ],
      },
      {
        metric: 'trainingLoad' as const,
        title: 'Weekly Training Load',
        currentValue: `${Math.round(state.weeklyLoad || 420)} TRIMP`,
        previousValue: '340 TRIMP',
        comparableContext: 'Optimal load progression (+23%)',
        changePercent: 23.5,
        unit: 'TRIMP',
        dataPoints: [
          { date: 'Aug 02', value: 330, label: '330' },
          { date: 'Aug 16', value: 360, label: '360' },
          { date: 'Aug 30', value: 380, label: '380' },
          { date: 'Sep 10', value: 405, label: '405' },
          { date: 'Sep 20', value: Math.round(state.weeklyLoad || 420), label: `${Math.round(state.weeklyLoad || 420)}` },
        ],
      },
      {
        metric: 'elevation' as const,
        title: 'Elevation Gain',
        currentValue: '480 m',
        previousValue: '320 m',
        comparableContext: '+160 m elevation per week',
        changePercent: 50.0,
        unit: 'm',
        dataPoints: [
          { date: 'Aug 02', value: 290, label: '290 m' },
          { date: 'Aug 16', value: 340, label: '340 m' },
          { date: 'Aug 30', value: 390, label: '390 m' },
          { date: 'Sep 10', value: 430, label: '430 m' },
          { date: 'Sep 20', value: 480, label: '480 m' },
        ],
      },
    ];

    // 5. Milestones
    const milestones = [
      {
        id: 'm1',
        title: 'NEW 10K BEST',
        value: '48:37',
        date: 'September 18',
        previousBest: '50:12',
        change: '1:35',
        context: 'Achieved during your BUILD phase during a structured tempo run.',
        category: 'race',
      },
      {
        id: 'm2',
        title: 'LONGEST RUN',
        value: '18.4 km',
        date: 'September 14',
        previousBest: '16.1 km',
        change: '+2.3 km',
        context: 'Completed with strong energy finish in Zone 2.',
        category: 'distance',
      },
      {
        id: 'm3',
        title: 'THRESHOLD IMPROVEMENT',
        value: '4:47/km',
        date: 'September 10',
        previousBest: '5:02/km',
        change: '15 sec/km',
        context: 'Validated over 3 consecutive threshold sessions.',
        category: 'performance',
      },
      {
        id: 'm4',
        title: 'CONSISTENCY STREAK',
        value: '4 weeks',
        date: 'September 07',
        previousBest: '2 weeks',
        change: '+2 weeks',
        context: '100% scheduled workouts completed without skipping key sessions.',
        category: 'streak',
      },
    ];

    // 6. Training Impact
    const trainingImpact = {
      title: 'TRAINING IMPACT',
      description: 'Your threshold improved 9% over the last 6 weeks. The biggest contribution came from:',
      factors: [
        {
          name: 'Threshold sessions',
          percentage: 45,
          description: 'Weekly 20-30 min tempo intervals at controlled target pace.',
        },
        {
          name: 'Long runs',
          percentage: 35,
          description: 'Consistent progressive weekend long runs building stamina.',
        },
        {
          name: 'Easy volume',
          percentage: 20,
          description: 'Aerobic support runs keeping fatigue low and recovery high.',
        },
      ],
    };

    const validPeriodKey: '4W' | '8W' | '3M' | '6M' | '1Y' =
      periodKey === '4W' || periodKey === '8W' || periodKey === '3M' || periodKey === '1Y'
        ? periodKey
        : '6M';

    return {
      period: {
        from: periodFrom.toISOString().split('T')[0],
        to: now.toISOString().split('T')[0],
        periodKey: validPeriodKey,
      },
      form,
      goal: goalProgress,
      capabilities,
      performance,
      milestones,
      trainingImpact,
    };
  }

  /** Finds or creates an athlete profile for the user. */
  async getOrCreateAthlete(userId: string): Promise<AthleteView> {
    const athlete = await this.athleteModel.findOne({ where: { userId } });
    if (athlete) {
      return this.toAthleteView(athlete);
    }
    return this.createAthlete(userId, { experienceLevel: 'intermediate' });
  }

  /** Finds an athlete profile by owner user id. */  async findAthleteByUserId(userId: string): Promise<AthleteView | null> {
    const athlete = await this.athleteModel.findOne({ where: { userId } });
    return athlete ? this.toAthleteView(athlete) : null;
  }

  /** Returns the latest goal for the authenticated athlete, if any. */
  async getLatestGoalForAthlete(athleteId: string, actorUserId: string): Promise<GoalView | null> {
    const athlete = await this.loadAthleteOrThrow(athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);
    const goal = await this.getLatestGoalForAthleteEntity(athleteId);
    return goal ? this.toGoalView(goal) : null;
  }

  /** Returns the latest training plan for the authenticated athlete, if any. */
  async getLatestPlanForAthlete(athleteId: string, actorUserId: string): Promise<TrainingPlanView | null> {
    const athlete = await this.loadAthleteOrThrow(athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);
    const plan = await this.planModel.findOne({
      where: { athleteId },
      order: [['createdAt', 'DESC']],
    });

    if (!plan) {
      return null;
    }

    const workouts = await this.workoutModel.findAll({
      where: { planId: plan.id },
      order: [
        ['weekNumber', 'ASC'],
        ['orderInWeek', 'ASC'],
        ['scheduledAt', 'ASC'],
      ],
    });

    return this.toPlanView(plan, workouts);
  }

  /** Returns recent workouts for the authenticated athlete. */
  async listRecentWorkoutsForAthlete(athleteId: string, actorUserId: string, limit = 10): Promise<WorkoutView[]> {
    const athlete = await this.loadAthleteOrThrow(athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const workouts = await this.workoutModel.findAll({
      where: { athleteId },
      order: [
        ['scheduledAt', 'DESC'],
        ['createdAt', 'DESC'],
      ],
      limit,
    });

    return workouts.map((workout) => this.toWorkoutView(workout));
  }

  /** Returns workouts for the authenticated athlete within a date range. */
  async listWorkoutsForDateRange(actorUserId: string, fromStr?: string, toStr?: string): Promise<WorkoutView[]> {
    const athleteView = await this.getOrCreateAthlete(actorUserId);

    const whereClause: Record<string, unknown> = { athleteId: athleteView.id };
    if (fromStr || toStr) {
      const scheduledAtWhere: Record<symbol, Date> = {};
      if (fromStr) {
        const fromDate = new Date(fromStr);
        fromDate.setHours(0, 0, 0, 0);
        scheduledAtWhere[Op.gte] = fromDate;
      }
      if (toStr) {
        const toDate = new Date(toStr);
        toDate.setHours(23, 59, 59, 999);
        scheduledAtWhere[Op.lte] = toDate;
      }
      whereClause.scheduledAt = scheduledAtWhere;
    }

    const workouts = await this.workoutModel.findAll({
      where: whereClause,
      order: [
        ['scheduledAt', 'ASC'],
        ['createdAt', 'ASC'],
      ],
    });

    return workouts.map((workout) => this.toWorkoutView(workout));
  }

  /** Creates a workout (planned or directly completed) for the authenticated athlete. */
  async createWorkout(actorUserId: string, dto: CreateWorkoutDto): Promise<WorkoutView> {
    const athleteView = await this.getOrCreateAthlete(actorUserId);
    const athlete = await this.loadAthleteOrThrow(athleteView.id);

    const scheduledDate = new Date(dto.scheduledAt);
    const isCompleted = dto.status === 'completed' || dto.actualDistanceKm !== undefined;
    const status = isCompleted ? 'completed' : dto.status || 'planned';

    if (status === 'planned') {
      const now = new Date();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      if (scheduledDate <= todayEnd) {
        throw new DomainException(
          'INVALID_DATE',
          'Плановую тренировку можно добавить только на будущую дату.',
        );
      }
    }

    const workoutType = dto.type || 'easy';
    const durationMinutes = dto.durationMinutes ?? (dto.actualDurationMinutes || 30);
    const distanceKm = dto.distanceKm ?? (dto.actualDistanceKm || 5);

    const target = {
      title: dto.title || `${workoutType.charAt(0).toUpperCase() + workoutType.slice(1)} Run`,
      description: dto.description || `${distanceKm} km at target pace`,
      source: dto.source || 'manual',
    };

    const workout = await this.workoutModel.create({
      athleteId: athlete.id,
      goalId: null,
      planId: null,
      weekNumber: 1,
      scheduledAt: scheduledDate,
      type: workoutType,
      phase: 'adhoc',
      status,
      orderInWeek: 1,
      durationMinutes,
      distanceKm,
      target,
      steps: [],
      actual: null,
      analysis: null,
      completedAt: isCompleted ? new Date() : null,
      sourceProvider: dto.source || 'manual',
    });

    if (isCompleted) {
      const actualDurationMinutes = dto.actualDurationMinutes ?? durationMinutes;
      const actualDistanceKm = dto.actualDistanceKm ?? distanceKm;

      const analysisResult = this.trainingEngine.analyzeWorkout({
        plannedWorkout: this.toWorkoutView(workout),
        actualDurationMinutes,
        actualDistanceKm,
        actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm,
        actualAverageHeartRate: dto.actualAverageHeartRate,
        rpe: dto.rpe,
      });

      workout.actual = {
        actualDurationMinutes,
        actualDistanceKm,
        actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm ?? null,
        actualAverageHeartRate: dto.actualAverageHeartRate ?? null,
        rpe: dto.rpe ?? null,
        notes: dto.notes ?? null,
      };
      workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
      await workout.save();

      const loadRecord = await this.trainingLoadModel.create({
        athleteId: athlete.id,
        workoutId: workout.id,
        occurredAt: workout.completedAt ?? workout.scheduledAt,
        load: analysisResult.trainingLoad,
        intensityFactor: analysisResult.intensityFactor,
        algorithmVersion: TRAINING_LOAD_ALGORITHM_VERSION,
      });

      await this.recalculateAthleteState(athlete.id);

      this.eventEmitter.emit(
        'training.workout.completed',
        new WorkoutCompletedEvent(athlete.id, workout.id, loadRecord.load),
      );
    }

    return this.toWorkoutView(workout);
  }

  /**
   * Creates a goal linked to the authenticated athlete from the universal
   * polymorphic payload (PRD sections 9, 19). Validation is schema-aware and
   * authoritative (PRD section 14).
   */
  async createGoal(actorUserId: string, dto: CreateGoalDto & { athleteId: string }): Promise<GoalView> {
    const athlete = await this.loadAthleteOrThrow(dto.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const payload = dto.goal;
    this.ensureGoalPayloadValid({
      type: payload.type,
      current: payload.current,
      target: payload.target,
      description: payload.description,
    });
    const legacyFields = deriveLegacyRaceFields({
      type: payload.type,
      current: payload.current,
      target: payload.target,
    });

    const goal = await this.goalModel.create({
      athleteId: athlete.id,
      type: payload.type,
      payload: {
        current: payload.current,
        target: payload.target ?? {},
        description: payload.description,
      },
      raceDistance: legacyFields.raceDistance,
      targetTimeSeconds: legacyFields.targetTimeSeconds,
      targetDate: payload.targetDate ?? null,
      priority: payload.priority ?? 5,
      status: ATHLETE_GOAL_STATUSES[0],
      notes: dto.notes ?? null,
    });

    this.eventEmitter.emit('training.goal.created', new GoalCreatedEvent(athlete.id, goal.id));
    return this.toGoalView(goal);
  }

  /** Returns a goal if it belongs to the authenticated user. */
  async getGoal(id: string, actorUserId: string): Promise<GoalView> {
    const goal = await this.loadGoalOrThrow(id);
    const athlete = await this.loadAthleteOrThrow(goal.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);
    return this.toGoalView(goal);
  }

  /** Generates a training plan for the athlete's active goal. */
  async createPlan(actorUserId: string, dto: CreatePlanDto): Promise<TrainingPlanView> {
    const athlete = await this.loadAthleteOrThrow(dto.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const goal = await this.loadGoalOrThrow(dto.goalId);
    if (goal.athleteId !== athlete.id) {
      throw new EntityNotFoundException('Goal', dto.goalId);
    }

    const state = await this.getLatestStateSnapshot(athlete.id, true);
    const athleteView = {
      ...this.toAthleteView(athlete),
      sessionsPerWeek: dto.targetTrainingFrequency ?? athlete.sessionsPerWeek,
    };
    const generatedPlan = this.trainingEngine.generatePlan(
      athleteView,
      this.toGoalView(goal),
      this.toStateComputation(state),
      dto.startDate ? new Date(dto.startDate) : new Date(),
    );

    const plan = await this.planModel.create({
      athleteId: athlete.id,
      goalId: goal.id,
      startDate: generatedPlan.startDate,
      endDate: generatedPlan.endDate,
      trainingFrequency: dto.targetTrainingFrequency ?? generatedPlan.trainingFrequency,
      weeklyTargetKm: generatedPlan.weeklyTargetKm,
      status: 'active',
      algorithmVersion: TRAINING_LOAD_ALGORITHM_VERSION,
      weeks: generatedPlan.weeks,
    });

    const workouts = await this.persistGeneratedWorkouts(plan, athlete, goal, generatedPlan.workouts);
    await this.updatePlanWeeksWithWorkoutIds(plan, generatedPlan.weeks, workouts);

    this.eventEmitter.emit('training.plan.generated', new PlanGeneratedEvent(athlete.id, plan.id));
    return this.toPlanView(plan, workouts);
  }

  /** Builds a non-persisted manual plan preview from the user configuration. */
  async previewManualPlan(actorUserId: string, dto: PreviewManualPlanDto): Promise<ManualPlanPreviewResponseDto> {
    const athlete = await this.loadAthleteOrThrow((await this.getOrCreateAthlete(actorUserId)).id);
    this.ensureAthleteOwnership(athlete, actorUserId);

    this.ensureManualScheduleConsistency(dto);

    const goal = this.buildManualGoalView(athlete.id, dto);
    const athleteView = this.applyManualScheduleToAthlete(athlete, dto);
    const state = await this.getLatestStateSnapshot(athlete.id, true);

    const generatedPlan = this.trainingEngine.generatePlan(
      athleteView,
      goal,
      this.toStateComputation(state),
      dto.startDate ? new Date(dto.startDate) : new Date(),
      {
        totalWeeks: dto.structure.totalWeeks,
        preferredLongRunDay: dto.schedule.preferredLongRunDay,
        focus: dto.structure.focus,
      },
    );

    return this.toManualPreview(generatedPlan);
  }

  /** Creates a persisted training plan from the manual configuration and optional workout overrides. */
  async createManualPlan(actorUserId: string, dto: CreateManualPlanDto): Promise<TrainingPlanView> {
    const athlete = await this.loadAthleteOrThrow((await this.getOrCreateAthlete(actorUserId)).id);
    this.ensureAthleteOwnership(athlete, actorUserId);

    // Authoritative validation: the client must send a configuration the engine accepts.
    await this.previewManualPlan(actorUserId, dto);

    const goalPayload = this.normalizeManualGoalPayload(dto.goal);
    this.ensureGoalPayloadValid(goalPayload);
    const legacyFields = deriveLegacyRaceFields(goalPayload);

    const goalEntity = await this.goalModel.create({
      athleteId: athlete.id,
      type: goalPayload.type,
      payload: {
        current: goalPayload.current,
        target: goalPayload.target ?? {},
        description: goalPayload.description,
      },
      raceDistance: legacyFields.raceDistance,
      targetTimeSeconds: legacyFields.targetTimeSeconds,
      targetDate: dto.goal.targetDate ?? null,
      priority: 5,
      status: ATHLETE_GOAL_STATUSES[0],
      notes: 'Created via manual plan flow',
    });
    this.eventEmitter.emit('training.goal.created', new GoalCreatedEvent(athlete.id, goalEntity.id));

    const athleteView = this.applyManualScheduleToAthlete(athlete, dto);
    const state = await this.getLatestStateSnapshot(athlete.id, true);
    const goalView = this.toGoalView(goalEntity);

    const generatedPlan = this.trainingEngine.generatePlan(
      athleteView,
      goalView,
      this.toStateComputation(state),
      dto.startDate ? new Date(dto.startDate) : new Date(),
      {
        totalWeeks: dto.structure.totalWeeks,
        preferredLongRunDay: dto.schedule.preferredLongRunDay,
        focus: dto.structure.focus,
      },
    );

    const plan = await this.planModel.create({
      athleteId: athlete.id,
      goalId: goalEntity.id,
      startDate: generatedPlan.startDate,
      endDate: generatedPlan.endDate,
      trainingFrequency: generatedPlan.trainingFrequency,
      weeklyTargetKm: generatedPlan.weeklyTargetKm,
      status: 'active',
      creationSource: 'manual',
      algorithmVersion: TRAINING_LOAD_ALGORITHM_VERSION,
      weeks: generatedPlan.weeks,
    });

    const workouts = await this.persistGeneratedWorkouts(plan, athlete, goalEntity, generatedPlan.workouts);
    const validatedWorkouts = await this.applyManualWorkoutOverrides(
      plan,
      athlete,
      goalEntity,
      generatedPlan.startDate,
      dto.weekOverrides ?? [],
      workouts,
    );
    await this.updatePlanWeeksWithWorkoutIds(plan, generatedPlan.weeks, validatedWorkouts);

    // Persist the user-schedule preferences so future regenerations respect them.
    athlete.availableTrainingDays = this.normalizeDays(
      dto.schedule.trainingDays.map((dayIndex) => TRAINING_WEEKDAY_ORDER[dayIndex]).filter(Boolean),
    );
    if (dto.schedule.workoutDurationMinutes) {
      athlete.preferredWorkoutDurationMinutes = dto.schedule.workoutDurationMinutes;
    }
    athlete.sessionsPerWeek = dto.structure.sessionsPerWeek;
    await athlete.save();
    this.eventEmitter.emit('training.athlete.updated', new AthleteUpdatedEvent(athlete.id, actorUserId));

    this.eventEmitter.emit(
      'training.plan.generated',
      new PlanGeneratedEvent(athlete.id, plan.id, 'manual'),
    );
    return this.toPlanView(plan, validatedWorkouts);
  }

  /** Applies validated client-side workout overrides to freshly generated planned workouts. */
  /**
   * Guards the PRD section 11 rule: sessions per week must stay consistent with
   * the selected training days. Both preview and create go through this check.
   */
  private ensureManualScheduleConsistency(dto: PreviewManualPlanDto): void {
    if (dto.structure.sessionsPerWeek > dto.schedule.trainingDays.length) {
      throw new DomainException(
        'MANUAL_PLAN_CONFIG_INVALID',
        `sessionsPerWeek (${dto.structure.sessionsPerWeek}) cannot exceed the number of training days (${dto.schedule.trainingDays.length})`,
        400,
      );
    }
  }

  /**
   * Applies validated client-side changes (edit / remove / add) to freshly
   * generated planned workouts. Every change passes Training Engine validation
   * before persistence (PRD sections 14-16).
   */
  private async applyManualWorkoutOverrides(
    plan: TrainingPlan,
    athlete: Athlete,
    goal: AthleteGoal,
    planStartDate: string,
    weekOverrides: ManualPlanWeekOverrideDto[],
    workouts: Workout[],
  ): Promise<Workout[]> {
    if (weekOverrides.length === 0) {
      return workouts;
    }

    const result = [...workouts];
    const athleteView = this.toAthleteView(athlete);
    const goalView = this.toGoalView(goal);
    const state = this.toStateComputation(await this.getLatestStateSnapshot(athlete.id, true));

    for (const weekOverride of weekOverrides) {
      let maxOrderInWeek = result
        .filter((workout) => workout.weekNumber === weekOverride.weekNumber)
        .reduce((max, workout) => Math.max(max, workout.orderInWeek), 0);

      // --- Removals (PRD section 15: remove workout) ---
      for (const removedId of weekOverride.removedWorkoutIds ?? []) {
        const [weekRaw, orderRaw] = removedId.split('-');
        const removedWeekNumber = Number(weekRaw);
        const removedOrder = Number(orderRaw);
        const target = result.find(
          (workout) =>
            workout.weekNumber === removedWeekNumber &&
            workout.orderInWeek === removedOrder &&
            workout.planId === plan.id,
        );
        if (!target) {
          throw new DomainException(
            'MANUAL_PLAN_WORKOUT_NOT_FOUND',
            `Workout ${removedId} not found in the generated plan`,
            400,
          );
        }
        await target.destroy();
        const targetIndex = result.indexOf(target);
        if (targetIndex >= 0) {
          result.splice(targetIndex, 1);
        }
      }

      // --- Edits (PRD section 14: user change → engine validation) ---
      const workoutByKey = new Map<string, Workout>();
      for (const workout of result) {
        workoutByKey.set(`${workout.weekNumber}-${workout.orderInWeek}`, workout);
      }

      for (const override of weekOverride.workoutOverrides ?? []) {
        const target = workoutByKey.get(override.id);
        if (!target) {
          throw new DomainException(
            'MANUAL_PLAN_WORKOUT_NOT_FOUND',
            `Workout ${override.id} not found in the generated plan`,
            400,
          );
        }

        // Merge override over the existing workout, then validate the combined result.
        const mergedType = override.type ?? target.type;
        const mergedDistanceKm = override.distanceKm ?? Number(target.distanceKm);
        const mergedDurationMinutes = override.durationMinutes ?? target.durationMinutes;
        const validation = this.trainingEngine.validateWorkoutOverride({
          type: mergedType,
          dayOfWeek: override.dayOfWeek,
          distanceKm: mergedDistanceKm,
          durationMinutes: mergedDurationMinutes,
        });
        if (!validation.valid) {
          throw new DomainException('MANUAL_PLAN_WORKOUT_INVALID', validation.reason, 400);
        }

        const typeChanged = override.type !== undefined && override.type !== target.type;
        if (override.type) {
          target.type = override.type as Workout['type'];
        }
        if (override.dayOfWeek !== undefined) {
          target.scheduledAt = this.trainingEngine.resolveWeekdayDate(
            new Date(planStartDate),
            target.weekNumber,
            override.dayOfWeek,
          );
        }

        // A changed type or metrics rebuild target/steps from the engine blueprint
        // so intensity zones stay consistent with the new workout shape.
        if (typeChanged || override.distanceKm !== undefined || override.durationMinutes !== undefined) {
          const planWeek = this.toPlanWeeks(plan.weeks).find((week) => week.weekNumber === target.weekNumber);
          const weekLoadTarget = planWeek?.weeklyLoadTarget ?? Math.round(plan.weeklyTargetKm);
          const rebuilt = this.trainingEngine.createWorkoutBlueprint({
            athlete: athleteView,
            goal: goalView,
            state,
            phase: target.phase,
            weekNumber: target.weekNumber,
            workoutType: target.type,
            scheduledAt: target.scheduledAt,
            orderInWeek: target.orderInWeek,
            weekLoadTarget,
          });
          target.durationMinutes = override.durationMinutes ?? rebuilt.durationMinutes;
          target.distanceKm = override.distanceKm ?? rebuilt.distanceKm;
          target.target = rebuilt.target;
          target.steps = rebuilt.steps;
        }
        await target.save();
      }

      // --- Additions (PRD section 15: add workout) ---
      for (const newWorkout of weekOverride.newWorkouts ?? []) {
        // Validate only the fields the client actually provided: distance is
        // optional for additions (e.g. a recovery jog), so it must not be
        // coerced to 0 and fail the engine distance rule.
        const validation = this.trainingEngine.validateWorkoutOverride({
          type: newWorkout.type,
          dayOfWeek: newWorkout.dayOfWeek,
          ...(newWorkout.distanceKm !== undefined ? { distanceKm: newWorkout.distanceKm } : {}),
          durationMinutes: newWorkout.durationMinutes,
        });
        if (!validation.valid) {
          throw new DomainException('MANUAL_PLAN_WORKOUT_INVALID', validation.reason, 400);
        }

        const scheduledAt = this.trainingEngine.resolveWeekdayDate(
          new Date(planStartDate),
          weekOverride.weekNumber,
          newWorkout.dayOfWeek,
        );
        const nextOrder = maxOrderInWeek + 1;
        maxOrderInWeek += 1;

        const planWeek = this.toPlanWeeks(plan.weeks).find((week) => week.weekNumber === weekOverride.weekNumber);
        const weekLoadTarget = planWeek?.weeklyLoadTarget ?? Math.round(plan.weeklyTargetKm);
        const blueprint = this.trainingEngine.createWorkoutBlueprint({
          athlete: athleteView,
          goal: goalView,
          state,
          phase: (planWeek?.phase as string) ?? 'base',
          weekNumber: weekOverride.weekNumber,
          workoutType: newWorkout.type as Workout['type'],
          scheduledAt,
          orderInWeek: nextOrder,
          weekLoadTarget,
        });

        const created = await this.workoutModel.create({
          athleteId: athlete.id,
          goalId: goal.id,
          planId: plan.id,
          weekNumber: weekOverride.weekNumber,
          scheduledAt,
          type: newWorkout.type as Workout['type'],
          phase: blueprint.phase,
          status: 'planned',
          orderInWeek: nextOrder,
          durationMinutes: newWorkout.durationMinutes,
          distanceKm: newWorkout.distanceKm ?? blueprint.distanceKm,
          target: blueprint.target,
          steps: blueprint.steps,
          actual: null,
          analysis: null,
          completedAt: null,
        });
        result.push(created);
      }
    }

    return result;
  }

  /**
   * Normalises a manual plan goal DTO into the universal payload shape.
   * Legacy flat race fields (raceDistance / targetTimeSeconds) are mapped onto
   * the universal model; universal fields win when both are provided.
   */
  private normalizeManualGoalPayload(dtoGoal: PreviewManualPlanDto['goal']): GoalPayloadShape & {
    targetDate?: string;
  } {
    const hasUniversalType = Boolean(dtoGoal.type);
    if (hasUniversalType) {
      return {
        type: dtoGoal.type!,
        current: dtoGoal.current ?? undefined,
        target: dtoGoal.target ?? undefined,
        description: dtoGoal.description ?? undefined,
        targetDate: dtoGoal.targetDate,
      };
    }

    // Legacy flat race payload (PRD section 26 backward compatibility).
    const legacy = mapLegacyRaceGoal(
      dtoGoal.raceDistance ?? 'just_running',
      dtoGoal.targetTimeSeconds ?? null,
    );
    return {
      type: legacy.type,
      target: legacy.target,
      targetDate: dtoGoal.targetDate,
    };
  }

  /** Validates the universal goal payload authoritatively (PRD section 14). */
  private ensureGoalPayloadValid(goal: GoalPayloadShape): void {
    const result = validateGoalPayload(goal);
    if (result.valid) {
      return;
    }

    throw new DomainException(
      `GOAL_${result.code}`,
      `Goal configuration invalid: ${result.code}${result.field ? ` (${result.field})` : ''}`,
      400,
    );
  }

  /** Builds an in-memory goal view for preview without persisting anything. */
  private buildManualGoalView(athleteId: string, dto: PreviewManualPlanDto): GoalView {
    const payload = this.normalizeManualGoalPayload(dto.goal);
    this.ensureGoalPayloadValid(payload);

    const legacyFields = deriveLegacyRaceFields(payload);

    return {
      id: 'preview-goal',
      athleteId,
      type: payload.type,
      payload: {
        current: payload.current ?? undefined,
        target: payload.target ?? {},
        description: payload.description ?? undefined,
      },
      raceDistance: legacyFields.raceDistance,
      targetTimeSeconds: legacyFields.targetTimeSeconds,
      targetDate: dto.goal.targetDate ?? this.addDaysToIsoDate(new Date(), 84),
      priority: 5,
      status: ATHLETE_GOAL_STATUSES[0],
      notes: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }

  /** Derives the athlete view used by the engine from the user's manual schedule. */
  private applyManualScheduleToAthlete(athlete: Athlete, dto: PreviewManualPlanDto): AthleteView {
    const trainingDays = dto.schedule.trainingDays.length > 0
      ? dto.schedule.trainingDays
          .map((dayIndex) => TRAINING_WEEKDAY_ORDER[dayIndex])
          .filter((day): day is (typeof TRAINING_WEEKDAY_ORDER)[number] => Boolean(day))
      : [...TRAINING_DEFAULT_AVAILABILITY];

    return {
      ...this.toAthleteView(athlete),
      sessionsPerWeek: dto.structure.sessionsPerWeek,
      availableTrainingDays: trainingDays,
      preferredWorkoutDurationMinutes: dto.schedule.workoutDurationMinutes ?? athlete.preferredWorkoutDurationMinutes,
    }; 
  }

  /** Maps an engine build result into the preview DTO. */
  private toManualPreview(generatedPlan: {
    startDate: string;
    endDate: string;
    trainingFrequency: number;
    weeklyTargetKm: number;
    weeks: Array<Record<string, unknown>>;
    workouts: Array<{
      type: Workout['type'];
      phase: string;
      weekNumber: number;
      scheduledAt: Date;
      orderInWeek: number;
      durationMinutes: number;
      distanceKm: number;
      target: Record<string, unknown>;
      steps: Array<Record<string, unknown>>;
    }>;
  }): ManualPlanPreviewResponseDto {
    const weeks: ManualPlanPreviewWeekDto[] = generatedPlan.weeks.map((week) => {
      const weekNumber = Number(week.weekNumber);
      const phase = String(week.phase || 'base');
      const weekWorkouts = generatedPlan.workouts.filter((workout) => workout.weekNumber === weekNumber);

      const workoutDtos: ManualPlanPreviewWorkoutDto[] = weekWorkouts.map((workout) => ({
        id: `${workout.weekNumber}-${workout.orderInWeek}`,
        type: workout.type,
        phase: workout.phase,
        weekNumber: workout.weekNumber,
        dayOfWeek: this.resolveDayOfWeekIndex(workout.scheduledAt),
        scheduledAt: this.toIsoDate(workout.scheduledAt),
        orderInWeek: workout.orderInWeek,
        durationMinutes: workout.durationMinutes,
        distanceKm: workout.distanceKm,
        target: workout.target,
        steps: workout.steps,
      }));

      return {
        weekNumber,
        phase: phase.toUpperCase(),
        title: this.getWeekTitle(phase, weekNumber),
        plannedWorkoutsCount: weekWorkouts.length,
        plannedDistance: Math.round(weekWorkouts.reduce((sum, workout) => sum + workout.distanceKm, 0)),
        plannedLoad: Math.round(Number(week.weeklyLoadTarget || 0)),
        workouts: workoutDtos,
      };
    });

    return {
      startDate: generatedPlan.startDate,
      endDate: generatedPlan.endDate,
      totalWeeks: generatedPlan.weeks.length,
      trainingFrequency: generatedPlan.trainingFrequency,
      weeklyTargetKm: generatedPlan.weeklyTargetKm,
      weeks,
    };
  }

  private resolveDayOfWeekIndex(date: Date): number {
    // Convert JS Sunday-first getDay() into the Monday-first index used by the app.
    return (date.getUTCDay() + 6) % 7;
  }

  private toIsoDate(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private addDaysToIsoDate(date: Date, days: number): string {
    const result = new Date(date);
    result.setUTCDate(result.getUTCDate() + days);
    return result.toISOString().slice(0, 10);
  }

  /** Returns a training plan with its scheduled workouts. */
  async getPlan(id: string, actorUserId: string): Promise<TrainingPlanView> {
    const plan = await this.loadPlanOrThrow(id);
    const athlete = await this.loadAthleteOrThrow(plan.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const workouts = await this.workoutModel.findAll({
      where: { planId: plan.id },
      order: [
        ['weekNumber', 'ASC'],
        ['orderInWeek', 'ASC'],
        ['scheduledAt', 'ASC'],
      ],
    });

    return this.toPlanView(plan, workouts);
  }

  /** Returns a complete overview of the training plan for the screen. */
  async getPlanOverview(id: string, actorUserId: string): Promise<PlanOverviewResponseDto> {
    let plan: TrainingPlan | null = null;
    if (id === 'current') {
      // Find the most relevant plan: active, then not_started, then most recent completed
      plan = await this.planModel.findOne({
        where: { athleteId: (await this.getOrCreateAthlete(actorUserId)).id, status: 'active' },
        order: [['createdAt', 'DESC']],
      });

      if (!plan) {
        plan = await this.planModel.findOne({
          where: { athleteId: (await this.getOrCreateAthlete(actorUserId)).id, status: 'draft' },
          order: [['createdAt', 'DESC']],
        });
      }

      if (!plan) {
        plan = await this.planModel.findOne({
          where: { athleteId: (await this.getOrCreateAthlete(actorUserId)).id },
          order: [['createdAt', 'DESC']],
        });
      }
    } else {
      plan = await this.loadPlanOrThrow(id);
    }

    if (!plan) {
      throw new EntityNotFoundException('TrainingPlan', id);
    }

    const athlete = await this.loadAthleteOrThrow(plan.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    // Auto-completion logic
    const now = new Date();
    const endDate = new Date(plan.endDate);
    if (plan.status === 'active' && endDate < now) {
      plan.status = 'completed';
      await plan.save();
    }

    const goal = plan.goalId ? await this.loadGoalOrThrow(plan.goalId) : null;
    const workouts = await this.workoutModel.findAll({
      where: { planId: plan.id },
      order: [
        ['weekNumber', 'ASC'],
        ['orderInWeek', 'ASC'],
      ],
    });

    const adaptations = await this.adaptationEventModel.findAll({
      where: { planId: plan.id },
      order: [['createdAt', 'DESC']],
      limit: 10,
    });

    const startDate = new Date(plan.startDate);
    let currentWeekNumber = 0;

    if (now >= startDate) {
      const diffTime = now.getTime() - startDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      currentWeekNumber = Math.max(1, Math.min(plan.weeks.length, Math.floor(diffDays / 7) + 1));
    }

    const weeks: PlanWeekDto[] = plan.weeks.map((week: any) => {
      const weekNumber = Number(week.weekNumber);
      const weekWorkouts = workouts.filter((w) => w.weekNumber === weekNumber);
      const totalDistance = weekWorkouts.reduce((sum, w) => sum + w.distanceKm, 0);

      let status: 'completed' | 'current' | 'upcoming';
      if (currentWeekNumber === 0) {
        status = 'upcoming';
      } else if (weekNumber < currentWeekNumber) {
        status = 'completed';
      } else if (weekNumber === currentWeekNumber) {
        status = 'current';
      } else {
        status = 'upcoming';
      }

      return {
        id: `week-${plan.id}-${weekNumber}`,
        weekNumber,
        phase: (week.phase || 'BASE').toUpperCase(),
        title: this.getWeekTitle(week.phase, weekNumber),
        status,
        plannedWorkoutsCount: weekWorkouts.length,
        plannedDistance: Math.round(totalDistance),
        plannedLoad: Math.round(week.weeklyLoadTarget || 0),
        summaryText: `${weekWorkouts.length} workouts · ${Math.round(totalDistance)} km`,
        intent: this.getWeekIntent(week.phase, weekNumber),
        keySessions: weekWorkouts
          .filter((w) => ['interval', 'threshold', 'tempo', 'long_run'].includes(w.type))
          .map((w) => `${w.type.charAt(0).toUpperCase() + w.type.slice(1)} ${Math.round(w.distanceKm)}km`),
      };
    });

    const currentPhase = weeks.find((w) => w.status === 'current')?.phase || weeks[0]?.phase || 'BASE';
    const currentWeekContext: CurrentWeekContextDto | undefined =
      currentWeekNumber > 0 && currentWeekNumber <= weeks.length
        ? {
            title: weeks[currentWeekNumber - 1].title,
            description: weeks[currentWeekNumber - 1].intent,
            focusItems: weeks[currentWeekNumber - 1].keySessions,
          }
        : undefined;

    const planStatusMap: Record<string, 'not_started' | 'active' | 'completed'> = {
      draft: 'not_started',
      active: 'active',
      completed: 'completed',
      paused: 'active',
    };

    // Universal goals must not assume race distance/time (PRD section 23):
    // the summary derives from the goal type, custom goals keep user text.
    const goalTitle = goal ? this.resolveGoalSummaryTitle(goal) : undefined;

    return {
      plan: {
        id: plan.id,
        name: goalTitle ?? 'Training Plan',
        goal: {
          title: goalTitle,
          distance: goal?.raceDistance || 'Unknown',
          targetTime: goal?.targetTimeSeconds
            ? `${Math.floor(goal.targetTimeSeconds / 3600)}h ${Math.floor((goal.targetTimeSeconds % 3600) / 60)}m`
            : undefined,
          targetDate: goal?.targetDate ?? undefined,
        },
        status: planStatusMap[plan.status] || 'active',
        currentWeek: currentWeekNumber,
        totalWeeks: plan.weeks.length,
        progress: currentWeekNumber > 0 ? currentWeekNumber / plan.weeks.length : 0,
        currentPhase,
        startDate: plan.startDate,
      },
      weeks,
      currentWeekContext,
      adaptations: adaptations.map((a) => ({
        id: a.id,
        weekNumber: workouts.find((w) => w.id === a.workoutId)?.weekNumber,
        type: a.type,
        title: this.getAdaptationTitle(a.type),
        description: a.reason,
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }

  /**
   * Builds the type-aware goal progress for the Progress snapshot.
   * Types without a reliable numeric target produce no invented percentages
   * (PRD section 21).
   */
  private buildGoalProgress(
    goal: GoalView | AthleteGoal,
    state: AthleteStateView,
  ): ProgressSnapshotResponseDto['goal'] {
    const formatTime = (secs: number) => {
      const mins = Math.floor(secs / 60);
      const s = Math.abs(secs % 60);
      return `${mins}:${String(s).padStart(2, '0')}`;
    };

    const target = goal.payload?.target ?? {};
    const current = goal.payload?.current ?? {};
    const statusOf = (ratio: number): 'ON_TRACK' | 'IMPROVING' | 'BEHIND' | 'ACHIEVED' | 'NO_LONGER_ACTIVE' =>
      ratio >= 1 ? 'ACHIEVED' : ratio >= 0.6 ? 'ON_TRACK' : 'BEHIND';

    // Race-family goals: target finish time over a distance.
    const distanceMeters = typeof target.distanceMeters === 'number' ? target.distanceMeters : null;
    const finishTimeSec = typeof target.finishTimeSec === 'number' ? target.finishTimeSec : null;
    if (distanceMeters && finishTimeSec) {
      const raceDistanceKm = distanceMeters / 1000;
      const targetSeconds = finishTimeSec;
      const estimatedSeconds = state.thresholdPaceSecondsPerKm
        ? Math.round(state.thresholdPaceSecondsPerKm * raceDistanceKm)
        : targetSeconds + 138;

      const deltaSeconds = estimatedSeconds - targetSeconds;
      const deltaText = deltaSeconds <= 0 ? 'Goal reached' : formatTime(deltaSeconds);

      return {
        type: 'RACE_TIME' as const,
        title: `${Math.round(raceDistanceKm)}K Race Goal`,
        distance: `${Math.round(raceDistanceKm)}k`,
        target: formatTime(targetSeconds),
        currentEstimate: formatTime(estimatedSeconds),
        delta: deltaText,
        progress: Math.min(Math.round((targetSeconds / estimatedSeconds) * 100), 100),
        status: estimatedSeconds <= targetSeconds ? 'ACHIEVED' : 'ON_TRACK',
        targetDate: goal.targetDate,
      };
    }

    // Distance-only goals (prepare a race / run a new distance).
    if (distanceMeters) {
      const targetKm = Math.round(distanceMeters / 100) / 10;
      return {
        type: 'DISTANCE' as const,
        title: `${targetKm} km Goal`,
        distance: `${targetKm}k`,
        target: `${targetKm} km`,
        currentEstimate: '—',
        delta: 'In progress',
        status: 'ON_TRACK' as const,
        targetDate: goal.targetDate,
      };
    }

    // Consistency: runs per week.
    const runsPerWeek = typeof target.runsPerWeek === 'number' ? target.runsPerWeek : null;
    if (runsPerWeek) {
      const currentRuns = typeof current.runsPerWeek === 'number' ? current.runsPerWeek : null;
      return {
        type: 'CONSISTENCY' as const,
        title: `${runsPerWeek} runs/week`,
        target: `${runsPerWeek} runs/week`,
        currentEstimate: currentRuns ? `${currentRuns} runs/week` : '—',
        delta: currentRuns && currentRuns >= runsPerWeek ? 'Goal reached' : 'In progress',
        progress: currentRuns ? Math.min(Math.round((currentRuns / runsPerWeek) * 100), 100) : undefined,
        status: currentRuns && currentRuns >= runsPerWeek ? 'ACHIEVED' : 'ON_TRACK',
        targetDate: goal.targetDate,
      };
    }

    // Pace goals.
    const paceTarget = typeof target.paceSecondsPerKm === 'number' ? target.paceSecondsPerKm : null;
    if (paceTarget) {
      const paceCurrent =
        typeof current.paceSecondsPerKm === 'number'
          ? current.paceSecondsPerKm
          : state.thresholdPaceSecondsPerKm;
      const reached = paceCurrent !== null && paceCurrent !== undefined && paceCurrent <= paceTarget;
      return {
        type: 'PACE' as const,
        title: `Target pace ${formatTime(paceTarget)} /km`,
        target: `${formatTime(paceTarget)} /km`,
        currentEstimate: paceCurrent ? `${formatTime(paceCurrent)} /km` : '—',
        delta: reached ? 'Goal reached' : 'In progress',
        status: reached ? 'ACHIEVED' : 'ON_TRACK',
        targetDate: goal.targetDate,
      };
    }

    // Custom goal: no numeric progress unless the backend derives one.
    if (goal.type === 'custom') {
      return {
        type: 'CUSTOM' as const,
        title: goal.payload?.description ?? 'Custom goal',
        target: '—',
        currentEstimate: '—',
        delta: 'In progress',
        status: 'ON_TRACK' as const,
        targetDate: goal.targetDate,
      };
    }

    // Remaining intent-only goals keep a non-numeric representation.
    return {
      type: 'CUSTOM' as const,
      title: goal.type
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' '),
      target: '—',
      currentEstimate: '—',
      delta: 'In progress',
      status: 'ON_TRACK' as const,
      targetDate: goal.targetDate,
    };
  }

  /** Human-readable goal summary used by the plan overview (PRD section 23). */
  private resolveGoalSummaryTitle(goal: GoalView | AthleteGoal): string {
    if (goal.type === 'custom' && goal.payload?.description) {
      return goal.payload.description;
    }

    const target = goal.payload?.target ?? {};
    const formatTime = (secs: number) => {
      const mins = Math.floor(secs / 60);
      const s = Math.abs(Math.round(secs % 60));
      return `${mins}:${String(s).padStart(2, '0')}`;
    };

    const distanceMeters = typeof target.distanceMeters === 'number' ? target.distanceMeters : null;
    const finishTimeSec = typeof target.finishTimeSec === 'number' ? target.finishTimeSec : null;
    if (distanceMeters) {
      const distanceKm = Math.round(distanceMeters / 100) / 10;
      return finishTimeSec ? `${distanceKm} km · ${formatTime(finishTimeSec)}` : `${distanceKm} km goal`;
    }

    const runsPerWeek = typeof target.runsPerWeek === 'number' ? target.runsPerWeek : null;
    if (runsPerWeek) {
      return `${runsPerWeek} runs/week`;
    }

    const weightKg = typeof target.weightKg === 'number' ? target.weightKg : null;
    if (weightKg) {
      return `${weightKg} kg goal`;
    }

    return goal.type
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private getWeekTitle(phase: string, weekNumber: number): string {
    const p = phase.toLowerCase();
    if (p === 'base') return 'Building consistency';
    if (p === 'build') return 'Increasing training load';
    if (p === 'specific') return 'Race-specific work';
    if (p === 'peak') return 'Peak preparation';
    if (p === 'taper') return 'Reducing load';
    if (p === 'race') return 'Race week';
    if (p === 'recovery') return 'Volume recovery';
    return `Week ${weekNumber} focus`;
  }

  private getWeekIntent(phase: string, weekNumber: number): string {
    const p = phase.toLowerCase();
    if (p === 'base') return 'Establish steady running routine and comfortable easy effort aerobic base.';
    if (p === 'build') return 'Build aerobic strength while maintaining recovery between quality sessions.';
    if (p === 'specific') return 'Develop target race pace efficiency and rhythm.';
    if (p === 'peak') return 'Execute final key race simulation session before reducing volume.';
    if (p === 'taper') return 'Shed residual fatigue while preserving neural sharpness.';
    if (p === 'race') return 'Rest, hydrate, carb load and execute your goal race.';
    if (p === 'recovery') return 'Allow body to adapt to previous load while maintaining frequency.';
    return 'Focus on consistent training and proper recovery.';
  }

  private getAdaptationTitle(type: string): string {
    if (type === 'ADD_RECOVERY') return 'Recovery added';
    if (type === 'REDUCE_INTENSITY') return 'Intensity reduced';
    if (type === 'REDUCE_VOLUME') return 'Volume reduced';
    if (type === 'MOVE') return 'Workout moved';
    if (type === 'REPLACE') return 'Workout replaced';
    if (type === 'REGENERATE_PLAN') return 'Plan adjusted';
    return 'Plan adaptation';
  }

  /** Regenerates the future part of an existing training plan. */
  async regeneratePlan(actorUserId: string, planId: string, startDate?: string): Promise<TrainingPlanView> {
    const plan = await this.loadPlanOrThrow(planId);
    const athlete = await this.loadAthleteOrThrow(plan.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    if (!plan.goalId) {
      throw new EntityNotFoundException('Goal', plan.id);
    }

    const goal = await this.loadGoalOrThrow(plan.goalId);
    const state = await this.getLatestStateSnapshot(athlete.id, true);
    const athleteView = {
      ...this.toAthleteView(athlete),
      sessionsPerWeek: plan.trainingFrequency,
    };
    const generatedPlan = this.trainingEngine.generatePlan(
      athleteView,
      this.toGoalView(goal),
      this.toStateComputation(state),
      startDate ? new Date(startDate) : new Date(plan.startDate),
    );

    await this.workoutModel.destroy({ where: { planId: plan.id } });
    const workouts = await this.persistGeneratedWorkouts(plan, athlete, goal, generatedPlan.workouts);

    plan.startDate = generatedPlan.startDate;
    plan.endDate = generatedPlan.endDate;
    plan.trainingFrequency = generatedPlan.trainingFrequency;
    plan.weeklyTargetKm = generatedPlan.weeklyTargetKm;
    plan.status = 'active';
    plan.weeks = generatedPlan.weeks;
    await plan.save();
    await this.updatePlanWeeksWithWorkoutIds(plan, generatedPlan.weeks, workouts);

    return this.toPlanView(plan, workouts);
  }

  /** Returns a workout if it belongs to the authenticated user. */
  async getWorkout(id: string, actorUserId: string): Promise<WorkoutView> {
    const workout = await this.loadWorkoutOrThrow(id);
    const athlete = await this.loadAthleteOrThrow(workout.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);
    return this.toWorkoutView(workout);
  }

  /** Analyzes a completed workout against its planned target. */
  async analyzeWorkout(actorUserId: string, dto: AnalyzeWorkoutDto): Promise<WorkoutAnalysisView> {
    const workout = await this.loadWorkoutOrThrow(dto.workoutId);
    const athlete = await this.loadAthleteOrThrow(workout.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const analysis = this.trainingEngine.analyzeWorkout({
      plannedWorkout: this.toWorkoutView(workout),
      actualDurationMinutes: dto.actualDurationMinutes,
      actualDistanceKm: dto.actualDistanceKm,
      actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm,
      actualAverageHeartRate: dto.actualAverageHeartRate,
      rpe: dto.rpe,
    });

    return analysis.analysis;
  }

  /** Completes a workout, stores load, updates state, and adapts the plan. */
  async completeWorkout(
    actorUserId: string,
    workoutId: string,
    dto: CompleteWorkoutDto,
  ): Promise<WorkoutCompletionResult> {
    const workout = await this.loadWorkoutOrThrow(workoutId);
    const athlete = await this.loadAthleteOrThrow(workout.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    if (workout.status === 'completed' && workout.analysis) {
      const state = await this.getLatestStateSnapshot(athlete.id, true);
      const existingAnalysis = this.toWorkoutAnalysisView(workout.analysis);
      const adaptation =
        (await this.getLatestAdaptationEventForWorkout(workout.id)) ??
        this.buildNoopAdaptationView(athlete.id, workout);

      return {
        workout: this.toWorkoutView(workout),
        analysis: existingAnalysis,
        state,
        adaptation,
      };
    }

    const analysisResult = this.trainingEngine.analyzeWorkout({
      plannedWorkout: this.toWorkoutView(workout),
      actualDurationMinutes: dto.actualDurationMinutes,
      actualDistanceKm: dto.actualDistanceKm,
      actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm,
      actualAverageHeartRate: dto.actualAverageHeartRate,
      rpe: dto.rpe,
    });

    workout.status = 'completed';
    workout.actual = {
      actualDurationMinutes: dto.actualDurationMinutes,
      actualDistanceKm: dto.actualDistanceKm,
      actualAveragePaceSecondsPerKm: dto.actualAveragePaceSecondsPerKm ?? null,
      actualAverageHeartRate: dto.actualAverageHeartRate ?? null,
      rpe: dto.rpe ?? null,
      notes: dto.notes ?? null,
    };
    workout.analysis = analysisResult.analysis as unknown as Record<string, unknown>;
    workout.completedAt = new Date();
    await workout.save();

    const loadRecord = await this.trainingLoadModel.create({
      athleteId: athlete.id,
      workoutId: workout.id,
      occurredAt: workout.completedAt,
      load: analysisResult.trainingLoad,
      intensityFactor: analysisResult.intensityFactor,
      algorithmVersion: TRAINING_LOAD_ALGORITHM_VERSION,
    });

    const state = await this.recalculateAthleteState(athlete.id);
    const adaptation = await this.applyAdaptationDecision(athlete, workout, analysisResult.analysis, state);

    this.eventEmitter.emit(
      'training.workout.completed',
      new WorkoutCompletedEvent(athlete.id, workout.id, loadRecord.load),
    );

    return {
      workout: this.toWorkoutView(workout),
      analysis: analysisResult.analysis,
      state,
      adaptation,
    };
  }

  /** Applies an explicit or implicit adaptation decision to a plan. */
  async adaptPlan(actorUserId: string, dto: AdaptPlanDto): Promise<AdaptationEventView> {
    const plan = await this.loadPlanOrThrow(dto.planId);
    const athlete = await this.loadAthleteOrThrow(plan.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const state = await this.getLatestStateSnapshot(athlete.id, true);
    const workouts = await this.workoutModel.findAll({
      where: { planId: plan.id },
      order: [
        ['weekNumber', 'ASC'],
        ['orderInWeek', 'ASC'],
      ],
    });

    const workout = dto.workoutId
      ? await this.loadWorkoutOrThrow(dto.workoutId)
      : (workouts.find((entry) => entry.status === 'completed') ?? workouts[0]);
    if (!workout) {
      throw new EntityNotFoundException('Workout', dto.workoutId ?? plan.id);
    }

    const fallbackAnalysis = this.trainingEngine.analyzeWorkout({
      plannedWorkout: this.toWorkoutView(workout),
      actualDurationMinutes: workout.durationMinutes,
      actualDistanceKm: workout.distanceKm,
    }).analysis;

    const analysis = this.toWorkoutAnalysisView(
      workout.analysis ? this.toRecord(workout.analysis) : this.toRecord(fallbackAnalysis),
    );

    return this.applyAdaptationDecision(athlete, workout, analysis, state, dto.forcedAction, dto.reason);
  }

  private async applyAdaptationDecision(
    athlete: Athlete,
    workout: Workout,
    analysis: WorkoutAnalysisView,
    state: AthleteStateView,
    forcedAction?: string,
    reasonOverride?: string,
  ): Promise<AdaptationEventView> {
    const plan = workout.planId ? await this.loadPlanOrThrow(workout.planId) : null;
    const upcomingWorkouts = plan
      ? await this.workoutModel.findAll({
          where: {
            planId: plan.id,
            status: 'planned',
            [Op.or]: [
              {
                weekNumber: {
                  [Op.gt]: workout.weekNumber,
                },
              },
              {
                weekNumber: workout.weekNumber,
                orderInWeek: {
                  [Op.gt]: workout.orderInWeek,
                },
              },
            ],
          },
          order: [
            ['weekNumber', 'ASC'],
            ['orderInWeek', 'ASC'],
          ],
        })
      : [];

    const planWeeks = plan ? this.toPlanWeeks(plan.weeks) : [];
    const decision = this.trainingEngine.adaptPlan(
      planWeeks,
      upcomingWorkouts.map((entry) => this.toWorkoutView(entry)),
      this.toStateComputation(state),
      analysis,
      forcedAction,
    );

    await this.applyWorkoutChanges(upcomingWorkouts, athlete, plan, state, decision.changes);

    const adaptationEvent = await this.adaptationEventModel.create({
      athleteId: athlete.id,
      planId: plan?.id ?? null,
      workoutId: workout.id,
      type: decision.action,
      input: {
        state,
        analysis,
      },
      decision: {
        action: decision.action,
        changes: decision.changes,
      },
      reason: reasonOverride ?? decision.reason,
      confidence: decision.confidence,
    });

    this.eventEmitter.emit(
      'training.plan.adapted',
      new PlanAdaptedEvent(athlete.id, plan?.id ?? workout.id, adaptationEvent.reason),
    );
    return this.toAdaptationEventView(adaptationEvent);
  }

  private async getLatestAdaptationEventForWorkout(workoutId: string): Promise<AdaptationEventView | null> {
    const adaptation = await this.adaptationEventModel.findOne({
      where: { workoutId },
      order: [['createdAt', 'DESC']],
    });

    return adaptation ? this.toAdaptationEventView(adaptation) : null;
  }

  private buildNoopAdaptationView(athleteId: string, workout: Workout): AdaptationEventView {
    return {
      id: `${workout.id}:noop`,
      athleteId,
      planId: workout.planId,
      workoutId: workout.id,
      type: 'KEEP',
      input: {},
      decision: {
        action: 'KEEP',
        changes: [],
      },
      reason: 'already_completed',
      confidence: 1,
      createdAt: new Date(),
    };
  }

  private async applyWorkoutChanges(
    workouts: Workout[],
    athlete: Athlete,
    plan: TrainingPlan | null,
    state: AthleteStateView,
    changes: Array<Record<string, unknown>>,
  ): Promise<void> {
    if (!plan || changes.length === 0) {
      return;
    }

    const goal = plan.goalId ? await this.loadGoalOrThrow(plan.goalId) : null;
    const athleteView = this.toAthleteView(athlete);
    const goalView = goal ? this.toGoalView(goal) : null;
    const stateComputation = this.toStateComputation(state);
    const planWeeks = this.toPlanWeeks(plan.weeks);

    for (const change of changes) {
      const workoutId = typeof change.workoutId === 'string' ? change.workoutId : null;
      if (!workoutId) {
        continue;
      }

      const targetWorkout = workouts.find((entry) => entry.id === workoutId);
      if (!targetWorkout) {
        continue;
      }

      if (typeof change.scheduledAt === 'string') {
        targetWorkout.scheduledAt = new Date(change.scheduledAt);
      }
      if (typeof change.type === 'string') {
        targetWorkout.type = change.type as Workout['type'];
      }
      if (typeof change.durationMinutes === 'number') {
        targetWorkout.durationMinutes = change.durationMinutes;
      }
      if (typeof change.distanceKm === 'number') {
        targetWorkout.distanceKm = change.distanceKm;
      }

      if (goalView) {
        const weekPlan = planWeeks.find((entry) => entry.weekNumber === targetWorkout.weekNumber);
        const weekLoadTarget = weekPlan?.weeklyLoadTarget ?? Math.round(plan.weeklyTargetKm);
        const rebuilt = this.trainingEngine.createWorkoutBlueprint({
          athlete: athleteView,
          goal: goalView,
          state: stateComputation,
          phase: targetWorkout.phase,
          weekNumber: targetWorkout.weekNumber,
          workoutType: targetWorkout.type,
          scheduledAt: targetWorkout.scheduledAt,
          orderInWeek: targetWorkout.orderInWeek,
          weekLoadTarget,
        });

        targetWorkout.durationMinutes = rebuilt.durationMinutes;
        targetWorkout.distanceKm = rebuilt.distanceKm;
        targetWorkout.target = rebuilt.target;
        targetWorkout.steps = rebuilt.steps;
      }

      await targetWorkout.save();
    }
  }

  private async persistGeneratedWorkouts(
    plan: TrainingPlan,
    athlete: Athlete,
    goal: AthleteGoal,
    workouts: Array<{
      type: Workout['type'];
      phase: string;
      weekNumber: number;
      scheduledAt: Date;
      orderInWeek: number;
      durationMinutes: number;
      distanceKm: number;
      target: Record<string, unknown>;
      steps: Array<Record<string, unknown>>;
    }>,
  ): Promise<Workout[]> {
    const persisted: Workout[] = [];
    const athleteView = this.toAthleteView(athlete);
    const goalView = this.toGoalView(goal);
    const state = this.toStateComputation(await this.getLatestStateSnapshot(athlete.id, true));

    for (const workout of workouts) {
      const blueprint = this.trainingEngine.createWorkoutBlueprint({
        athlete: athleteView,
        goal: goalView,
        state,
        phase: workout.phase,
        weekNumber: workout.weekNumber,
        workoutType: workout.type,
        scheduledAt: workout.scheduledAt,
        orderInWeek: workout.orderInWeek,
        weekLoadTarget: plan.weeklyTargetKm,
      });

      const created = await this.workoutModel.create({
        athleteId: athlete.id,
        goalId: goal.id,
        planId: plan.id,
        weekNumber: blueprint.weekNumber,
        scheduledAt: blueprint.scheduledAt,
        type: blueprint.type,
        phase: blueprint.phase,
        status: 'planned',
        orderInWeek: blueprint.orderInWeek,
        durationMinutes: blueprint.durationMinutes,
        distanceKm: blueprint.distanceKm,
        target: blueprint.target,
        steps: blueprint.steps,
        actual: null,
        analysis: null,
        completedAt: null,
      });

      persisted.push(created);
    }

    return persisted;
  }

  private async updatePlanWeeksWithWorkoutIds(
    plan: TrainingPlan,
    weeks: Array<Record<string, unknown>>,
    workouts: Workout[],
  ): Promise<void> {
    const updatedWeeks = weeks.map((week) => {
      const weekNumber = Number(week.weekNumber);
      const ids = workouts.filter((workout) => workout.weekNumber === weekNumber).map((workout) => workout.id);
      return {
        ...week,
        workoutIds: ids,
      };
    });

    plan.weeks = updatedWeeks;
    await plan.save();
  }

  private async recalculateAthleteState(athleteId: string): Promise<AthleteStateView> {
    const athlete = await this.loadAthleteOrThrow(athleteId);
    const goal = await this.getLatestGoalForAthleteEntity(athleteId);
    const recentLoads = await this.getRecentLoads(athleteId);
    const computation = this.trainingEngine.calculateTrainingState(
      this.toAthleteView(athlete),
      recentLoads.map((load) => ({
        load: load.load,
        occurredAt: load.occurredAt,
      })),
      goal ? this.toGoalView(goal) : null,
    );

    const state = await this.athleteStateModel.create({
      athleteId: athlete.id,
      fitness: computation.fitness,
      fatigue: computation.fatigue,
      form: computation.form,
      thresholdPaceSecondsPerKm: computation.thresholdPaceSecondsPerKm,
      thresholdHeartRate: computation.thresholdHeartRate,
      vo2max: computation.vo2max,
      weeklyLoad: computation.weeklyLoad,
      acuteLoad: computation.acuteLoad,
      chronicLoad: computation.chronicLoad,
      recoveryScore: computation.recoveryScore,
      confidence: computation.confidence,
      source: computation.source,
    });

    this.eventEmitter.emit(
      'training.state.updated',
      new AthleteStateUpdatedEvent(athlete.id, state.id, state.confidence),
    );

    return this.toStateView(state);
  }

  private async getLatestStateSnapshot(athleteId: string, createIfMissing: boolean): Promise<AthleteStateView> {
    const state = await this.athleteStateModel.findOne({
      where: { athleteId },
      order: [['createdAt', 'DESC']],
    });

    if (state) {
      return this.toStateView(state);
    }

    if (!createIfMissing) {
      throw new EntityNotFoundException('AthleteState', athleteId);
    }

    return this.recalculateAthleteState(athleteId);
  }

  private async getLatestGoalForAthleteEntity(athleteId: string): Promise<AthleteGoal | null> {
    return this.goalModel.findOne({
      where: { athleteId },
      order: [['createdAt', 'DESC']],
    });
  }

  private async getRecentLoads(athleteId: string): Promise<TrainingLoad[]> {
    return this.trainingLoadModel.findAll({
      where: { athleteId },
      order: [['occurredAt', 'DESC']],
      limit: 100,
    });
  }

  private async loadAthleteOrThrow(id: string): Promise<Athlete> {
    const athlete = await this.athleteModel.findByPk(id);
    if (!athlete) {
      throw new EntityNotFoundException('Athlete', id);
    }
    return athlete;
  }

  private async loadGoalOrThrow(id: string): Promise<AthleteGoal> {
    const goal = await this.goalModel.findByPk(id);
    if (!goal) {
      throw new EntityNotFoundException('Goal', id);
    }
    return goal;
  }

  private async loadPlanOrThrow(id: string): Promise<TrainingPlan> {
    const plan = await this.planModel.findByPk(id);
    if (!plan) {
      throw new EntityNotFoundException('TrainingPlan', id);
    }
    return plan;
  }

  private async loadWorkoutOrThrow(id: string): Promise<Workout> {
    const workout = await this.workoutModel.findByPk(id);
    if (!workout) {
      throw new EntityNotFoundException('Workout', id);
    }
    return workout;
  }

  private ensureAthleteOwnership(athlete: Athlete, actorUserId: string): void {
    if (athlete.userId !== actorUserId) {
      throw new EntityNotFoundException('Athlete', athlete.id);
    }
  }

  private toAthleteView(athlete: Athlete): AthleteView {
    return {
      id: athlete.id,
      userId: athlete.userId,
      age: athlete.age,
      sex: athlete.sex,
      heightCm: athlete.heightCm,
      weightKg: athlete.weightKg,
      experienceLevel: athlete.experienceLevel,
      weeklyMileageKm: athlete.weeklyMileageKm,
      sessionsPerWeek: athlete.sessionsPerWeek,
      recentRaceResults: this.toArrayOfRecords(athlete.recentRaceResults),
      preferredTrainingDays: [...athlete.preferredTrainingDays],
      availableTrainingDays: [...athlete.availableTrainingDays],
      preferredWorkoutDurationMinutes: athlete.preferredWorkoutDurationMinutes,
      createdAt: athlete.createdAt,
      updatedAt: athlete.updatedAt,
    };
  }

  private toGoalView(goal: AthleteGoal): GoalView {
    return {
      id: goal.id,
      athleteId: goal.athleteId,
      type: goal.type ?? 'prepare_for_race',
      payload: goal.payload ?? null,
      raceDistance: goal.raceDistance,
      targetTimeSeconds: goal.targetTimeSeconds,
      targetDate: goal.targetDate ?? '',
      priority: goal.priority,
      status: goal.status,
      notes: goal.notes,
      createdAt: goal.createdAt,
      updatedAt: goal.updatedAt,
    };
  }

  private toStateView(state: AthleteState): AthleteStateView {
    return {
      id: state.id,
      athleteId: state.athleteId,
      fitness: state.fitness,
      fatigue: state.fatigue,
      form: state.form,
      thresholdPaceSecondsPerKm: state.thresholdPaceSecondsPerKm,
      thresholdHeartRate: state.thresholdHeartRate,
      vo2max: state.vo2max,
      weeklyLoad: state.weeklyLoad,
      acuteLoad: state.acuteLoad,
      chronicLoad: state.chronicLoad,
      recoveryScore: state.recoveryScore,
      confidence: state.confidence,
      source: state.source,
      createdAt: state.createdAt,
      updatedAt: state.updatedAt ?? state.createdAt,
    };
  }

  private toStateComputation(state: AthleteStateView): TrainingStateComputation {
    return {
      fitness: state.fitness,
      fatigue: state.fatigue,
      form: state.form,
      weeklyLoad: state.weeklyLoad,
      acuteLoad: state.acuteLoad,
      chronicLoad: state.chronicLoad,
      recoveryScore: state.recoveryScore ?? 50,
      thresholdPaceSecondsPerKm: state.thresholdPaceSecondsPerKm,
      thresholdHeartRate: state.thresholdHeartRate,
      vo2max: state.vo2max,
      confidence: state.confidence,
      source: state.source,
    };
  }

  private toWorkoutView(workout: Workout): WorkoutView {
    return {
      id: workout.id,
      athleteId: workout.athleteId,
      goalId: workout.goalId,
      planId: workout.planId,
      weekNumber: workout.weekNumber,
      scheduledAt: workout.scheduledAt,
      type: workout.type,
      phase: workout.phase,
      status: workout.status,
      orderInWeek: workout.orderInWeek,
      durationMinutes: workout.durationMinutes,
      distanceKm: workout.distanceKm,
      target: this.toRecord(workout.target),
      steps: this.toArrayOfRecords(workout.steps),
      actual: workout.actual ? this.toRecord(workout.actual) : null,
      analysis: workout.analysis ? this.toWorkoutAnalysisView(workout.analysis) : null,
      completedAt: workout.completedAt,
      createdAt: workout.createdAt,
      updatedAt: workout.updatedAt,
    };
  }

  private toWorkoutAnalysisView(value: Record<string, unknown>): WorkoutAnalysisView {
    return {
      completion: Number(value.completion ?? 0),
      performanceDelta: Number(value.performanceDelta ?? 0),
      load: Number(value.load ?? 0),
      expectedLoad: Number(value.expectedLoad ?? 0),
      fatigueImpact: (value.fatigueImpact as WorkoutAnalysisView['fatigueImpact']) ?? 'low',
      confidence: Number(value.confidence ?? 0),
      analysisVersion: String(value.analysisVersion ?? 'analysis-v1'),
    };
  }

  private toPlanView(plan: TrainingPlan, workouts: Workout[]): TrainingPlanView {
    const orderedWorkouts = workouts.map((workout) => this.toWorkoutView(workout));
    const planWeeks = this.toPlanWeeks(plan.weeks).map((week) => ({
      ...week,
      workoutIds: orderedWorkouts
        .filter((workout) => workout.weekNumber === week.weekNumber)
        .map((workout) => workout.id),
    }));

    return {
      id: plan.id,
      athleteId: plan.athleteId,
      goalId: plan.goalId,
      startDate: plan.startDate,
      endDate: plan.endDate,
      trainingFrequency: plan.trainingFrequency,
      weeklyTargetKm: plan.weeklyTargetKm,
      status: plan.status,
      algorithmVersion: plan.algorithmVersion,
      weeks: planWeeks,
      workouts: orderedWorkouts,
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }

  private toPlanWeeks(
    value: Array<Record<string, unknown>>,
  ): Array<{ weekNumber: number; phase: string; weeklyLoadTarget: number; workoutIds: string[] }> {
    return value.map((week) => ({
      weekNumber: Number(week.weekNumber ?? 0),
      phase: String(week.phase ?? 'base'),
      weeklyLoadTarget: Number(week.weeklyLoadTarget ?? 0),
      workoutIds: this.toArrayOfStrings(week.workoutIds),
    }));
  }

  private toAdaptationEventView(event: AdaptationEvent): AdaptationEventView {
    return {
      id: event.id,
      athleteId: event.athleteId,
      planId: event.planId,
      workoutId: event.workoutId,
      type: event.type,
      input: this.toRecord(event.input),
      decision: this.toRecord(event.decision),
      reason: event.reason,
      confidence: event.confidence,
      createdAt: event.createdAt,
    };
  }

  private normalizeDays(days?: string[]): string[] {
    if (!days || days.length === 0) {
      return [...TRAINING_DEFAULT_AVAILABILITY];
    }

    return days.map((day) => day.trim().toLowerCase()).filter(Boolean);
  }

  private toArrayOfStrings(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((entry) => String(entry));
  }

  private toArrayOfRecords(value: unknown): Array<Record<string, unknown>> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((entry) => this.toRecord(entry));
  }

  private toRecord(value: unknown): Record<string, unknown> {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return {};
    }

    return { ...(value as Record<string, unknown>) };
  }
}
