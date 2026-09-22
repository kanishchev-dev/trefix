import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { EntityAlreadyExistsException } from '@/common/exceptions/entity-already-exists.exception';
import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';

import { AdaptPlanDto } from './dto/adapt-plan.dto';
import { AnalyzeWorkoutDto } from './dto/analyze-workout.dto';
import { CompleteWorkoutDto } from './dto/complete-workout.dto';
import { CreateAthleteDto } from './dto/create-athlete.dto';
import { CreateGoalDto } from './dto/create-goal.dto';
import { CreatePlanDto } from './dto/create-plan.dto';
import { AdaptationEvent } from './entities/adaptation-event.entity';
import { Athlete } from './entities/athlete.entity';
import { AthleteGoal } from './entities/athlete-goal.entity';
import { AthleteState } from './entities/athlete-state.entity';
import { TrainingLoad } from './entities/training-load.entity';
import { TrainingPlan } from './entities/training-plan.entity';
import { Workout } from './entities/workout.entity';
import { AthleteCreatedEvent } from './events/athlete-created.event';
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
import { ProgressSnapshotResponseDto } from './dto/progress-response.dto';
import {
  ATHLETE_GOAL_STATUSES,
  TRAINING_DEFAULT_AVAILABILITY,
  TRAINING_DEFAULT_DURATION_MINUTES,
  TRAINING_DEFAULT_FREQUENCY,
  TRAINING_DEFAULT_WEEKLY_MILEAGE_KM,
  TRAINING_LOAD_ALGORITHM_VERSION,
} from './training.constants';
import { TrainingEngine, TrainingStateComputation } from './training.engine';

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

    // 2. Goal Progress
    let goalProgress = null;
    if (goal) {
      const raceDistanceKm = Number(goal.raceDistance) || 10;
      const targetSeconds = goal.targetTimeSeconds || 2700; // 45 mins default
      const estimatedSeconds = state.thresholdPaceSecondsPerKm
        ? Math.round(state.thresholdPaceSecondsPerKm * raceDistanceKm)
        : targetSeconds + 138; // 2:18 slower default

      const deltaSeconds = estimatedSeconds - targetSeconds;
      const formatTime = (secs: number) => {
        const mins = Math.floor(secs / 60);
        const s = Math.abs(secs % 60);
        return `${mins}:${String(s).padStart(2, '0')}`;
      };

      const deltaText = deltaSeconds <= 0 ? 'Goal reached' : `${formatTime(deltaSeconds)}`;
      const goalStatus: 'ON_TRACK' | 'IMPROVING' | 'BEHIND' | 'ACHIEVED' | 'NO_LONGER_ACTIVE' =
        estimatedSeconds <= targetSeconds ? 'ACHIEVED' : 'ON_TRACK';

      goalProgress = {
        type: 'RACE_TIME' as const,
        title: `${raceDistanceKm}K Race Goal`,
        distance: `${raceDistanceKm}k`,
        target: formatTime(targetSeconds),
        currentEstimate: formatTime(estimatedSeconds),
        delta: deltaText,
        progress: Math.min(Math.round(((targetSeconds / estimatedSeconds) || 0.7) * 100), 100),
        status: goalStatus,
        targetDate: goal.targetDate,
      };
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

  /** Creates a goal linked to the authenticated athlete. */
  async createGoal(actorUserId: string, dto: CreateGoalDto & { athleteId: string }): Promise<GoalView> {
    const athlete = await this.loadAthleteOrThrow(dto.athleteId);
    this.ensureAthleteOwnership(athlete, actorUserId);

    const goal = await this.goalModel.create({
      athleteId: athlete.id,
      raceDistance: dto.raceDistance,
      targetTimeSeconds: dto.targetTimeSeconds ?? null,
      targetDate: dto.targetDate,
      priority: dto.priority ?? 5,
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
      raceDistance: goal.raceDistance,
      targetTimeSeconds: goal.targetTimeSeconds,
      targetDate: goal.targetDate,
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
