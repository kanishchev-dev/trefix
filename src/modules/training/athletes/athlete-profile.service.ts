import { HttpStatus, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, Transaction } from 'sequelize';

import { DomainException } from '@/common/exceptions/domain.exception';

import { Athlete } from '../entities/athlete.entity';
import { Workout } from '../entities/workout.entity';
import { AthleteUpdatedEvent } from '../events/athlete-updated.event';
import { AthleteZonesChangedEvent } from '../events/athlete-zones-changed.event';
import type { AthleteView } from '../interfaces/training-views.interface';
import { todayIsoInTz } from '../plans/plan-utils';
import {
  ATHLETE_MANUAL_TRACKED_FIELDS,
  ATHLETE_RANGES,
  ATHLETE_SOURCED_FIELDS,
  type AthleteFieldSources,
  type FieldSource,
  type PlanMetricsSource,
  TRAINING_WEEKDAY_ORDER,
  WEEKLY_MILEAGE_SUGGESTION_THRESHOLD,
} from '../training.constants';
import { TrainingService } from '../training.service';
import { UpdateAthleteProfileDto } from './dto/update-athlete-profile.dto';
import { calculateHrZones, estimateMaxHeartRate, type HrZone, isValidCustomZones } from './hr-zones';
import { ageFromBirthDate, calculateCompleteness, type ProfileCompleteness } from './profile-completeness';

export interface WeeklyMileageSuggestion {
  valueKm: number;
  source: PlanMetricsSource;
  windowDays: number;
}

/** The athlete profile as the client sees it: stored inputs plus values derived from them. */
export interface AthleteProfileView extends AthleteView {
  maxHeartRateEstimate: number | null;
  hrZones: HrZone[] | null;
  hrZonesUnavailableReason: string | null;
  weeklyMileageSuggestion: WeeklyMileageSuggestion | null;
  completeness: ProfileCompleteness;
}

/** Plan inputs that are written back to the profile when the user enters them while creating a plan. */
export interface PlanInputMetrics {
  restingHeartRate?: number | null;
  maxHeartRate?: number | null;
  thresholdHeartRate?: number | null;
  weeklyMileageKm?: number | null;
}

type RangedField = Exclude<keyof typeof ATHLETE_RANGES, 'ageYears' | 'runningSinceYear'>;

const UPDATABLE_FIELDS = [
  'birthDate',
  'sex',
  'heightCm',
  'weightKg',
  'restingHeartRate',
  'maxHeartRate',
  'thresholdHeartRate',
  'hrZonesMethod',
  'hrZonesCustom',
  'experienceLevel',
  'runningSinceYear',
  'limitations',
  'availableTrainingDays',
  'preferredTimeOfDay',
  'sessionsPerWeek',
  'longRunDay',
  'preferredWorkoutDurationMinutes',
  'longRunMaxDurationMinutes',
  'weeklyMileageKm',
] as const;
type UpdatableField = (typeof UPDATABLE_FIELDS)[number];

const ZONE_FIELDS: ReadonlySet<UpdatableField> = new Set([
  'restingHeartRate',
  'maxHeartRate',
  'thresholdHeartRate',
  'hrZonesMethod',
  'hrZonesCustom',
]);
const PROVENANCE_FIELDS: ReadonlySet<string> = new Set([...ATHLETE_SOURCED_FIELDS, ...ATHLETE_MANUAL_TRACKED_FIELDS]);

const VOLUME_WINDOW_DAYS = 28;
const MIN_COMPLETED_FOR_VOLUME = 4;

/**
 * Reads and edits the athlete profile: validation, field provenance (manual
 * edits win over synced values), derived heart-rate zones and completeness.
 */
@Injectable()
export class AthleteProfileService {
  constructor(
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    private readonly trainingService: TrainingService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async getMyProfile(userId: string): Promise<AthleteProfileView> {
    const athlete = await this.loadOrCreate(userId);
    return this.toProfileView(athlete);
  }

  async updateMyProfile(userId: string, dto: UpdateAthleteProfileDto): Promise<AthleteProfileView> {
    const athlete = await this.loadOrCreate(userId);
    const now = new Date().toISOString();
    const sources: AthleteFieldSources = { ...(athlete.fieldSources ?? {}) };
    const changed = new Set<UpdatableField>();

    for (const field of UPDATABLE_FIELDS) {
      const value = dto[field];
      if (value === undefined) {
        continue;
      }
      const next = field === 'availableTrainingDays' ? this.normalizeDays(value as string[]) : value;
      if (JSON.stringify(athlete.get(field) ?? null) === JSON.stringify(next ?? null)) {
        continue;
      }
      athlete.set(field, next as never);
      changed.add(field);
      if (PROVENANCE_FIELDS.has(field)) {
        sources[field] = { source: 'manual', updatedAt: now };
      }
    }

    for (const field of dto.resetSources ?? []) {
      if (sources[field]) {
        delete sources[field];
      }
    }

    this.validate(athlete);

    const sourcesChanged = JSON.stringify(sources) !== JSON.stringify(athlete.fieldSources ?? {});
    if (changed.size === 0 && !sourcesChanged) {
      return this.toProfileView(athlete);
    }

    athlete.fieldSources = sources;
    athlete.changed('fieldSources', true);
    await athlete.save();

    this.eventEmitter.emit('training.athlete.updated', new AthleteUpdatedEvent(athlete.id, userId));
    if ([...changed].some((field) => ZONE_FIELDS.has(field))) {
      this.eventEmitter.emit('training.athlete.zones_changed', new AthleteZonesChangedEvent(athlete.id, userId));
    }
    return this.toProfileView(athlete);
  }

  /**
   * Writes metrics the user typed while creating or rebuilding a plan back to
   * the profile, marking them as manual. Out-of-range values are skipped.
   */
  async applyPlanInputMetrics(athleteId: string, metrics: PlanInputMetrics, transaction?: Transaction): Promise<void> {
    const athlete = await this.athleteModel.findByPk(athleteId, { transaction });
    if (!athlete) {
      return;
    }
    const now = new Date().toISOString();
    const sources: AthleteFieldSources = { ...(athlete.fieldSources ?? {}) };
    let changed = false;
    for (const field of ATHLETE_MANUAL_TRACKED_FIELDS) {
      const value = metrics[field];
      if (typeof value !== 'number' || !this.inRange(field, value)) {
        continue;
      }
      if (athlete.get(field) !== value) {
        athlete.set(field, value);
        changed = true;
      }
      sources[field] = { source: 'manual', updatedAt: now };
    }
    if (!this.isHeartRateConsistent(athlete)) {
      // Never persist an inconsistent trio; the plan keeps its own snapshot anyway.
      await athlete.reload({ transaction });
      return;
    }
    athlete.fieldSources = sources;
    athlete.changed('fieldSources', true);
    await athlete.save({ transaction });
    if (changed) {
      this.eventEmitter.emit('training.athlete.updated', new AthleteUpdatedEvent(athlete.id, athlete.userId));
      this.eventEmitter.emit(
        'training.athlete.zones_changed',
        new AthleteZonesChangedEvent(athlete.id, athlete.userId),
      );
    }
  }

  /**
   * Sets a value that came from an external source unless the user owns the
   * field. Returns `true` when the profile changed.
   */
  async applySourcedValues(
    athleteId: string,
    source: Exclude<FieldSource, 'manual'>,
    values: Partial<Pick<Athlete, 'weightKg' | 'sex' | 'heightCm' | 'birthDate'>>,
  ): Promise<boolean> {
    const athlete = await this.athleteModel.findByPk(athleteId);
    if (!athlete) {
      return false;
    }
    const now = new Date().toISOString();
    const sources: AthleteFieldSources = { ...(athlete.fieldSources ?? {}) };
    let changed = false;
    for (const [field, value] of Object.entries(values) as Array<[keyof typeof values, unknown]>) {
      if (value === undefined || value === null || sources[field]?.source === 'manual') {
        continue;
      }
      if (field !== 'sex' && field !== 'birthDate' && !this.inRange(field, Number(value))) {
        continue;
      }
      if (JSON.stringify(athlete.get(field)) !== JSON.stringify(value)) {
        athlete.set(field, value as never);
        changed = true;
      }
      sources[field] = { source, updatedAt: now };
    }
    athlete.fieldSources = sources;
    athlete.changed('fieldSources', true);
    await athlete.save();
    if (changed) {
      this.eventEmitter.emit('training.athlete.updated', new AthleteUpdatedEvent(athlete.id, athlete.userId));
    }
    return changed;
  }

  async toProfileView(athlete: Athlete): Promise<AthleteProfileView> {
    const view = this.trainingService.toAthleteView(athlete);
    const age = ageFromBirthDate(athlete.birthDate, todayIsoInTz('UTC')) ?? athlete.age ?? null;
    const zones = calculateHrZones({
      method: athlete.hrZonesMethod,
      restingHeartRate: athlete.restingHeartRate,
      maxHeartRate: athlete.maxHeartRate,
      thresholdHeartRate: athlete.thresholdHeartRate,
      customUpperBounds: athlete.hrZonesCustom,
    });

    return {
      ...view,
      age,
      maxHeartRateEstimate: athlete.maxHeartRate ? null : estimateMaxHeartRate(age),
      hrZones: zones.zones,
      hrZonesUnavailableReason: zones.unavailableReason,
      weeklyMileageSuggestion: await this.weeklyMileageSuggestion(athlete),
      completeness: calculateCompleteness({
        birthDate: athlete.birthDate,
        sex: athlete.sex,
        heightCm: athlete.heightCm,
        weightKg: athlete.weightKg,
        restingHeartRate: athlete.restingHeartRate,
        maxHeartRate: athlete.maxHeartRate,
        thresholdHeartRate: athlete.thresholdHeartRate,
        availableTrainingDays: athlete.availableTrainingDays ?? [],
        weeklyMileageKm: athlete.weeklyMileageKm,
        limitations: athlete.limitations,
      }),
    };
  }

  private async loadOrCreate(userId: string): Promise<Athlete> {
    const view = await this.trainingService.getOrCreateAthlete(userId);
    const athlete = await this.athleteModel.findByPk(view.id);
    if (!athlete) {
      throw new DomainException('ATHLETE_NOT_FOUND', 'The user has no athlete profile yet', HttpStatus.NOT_FOUND);
    }
    return athlete;
  }

  /** Actual average weekly volume over the last 4 weeks, when it differs noticeably from the profile. */
  private async weeklyMileageSuggestion(athlete: Athlete): Promise<WeeklyMileageSuggestion | null> {
    const since = new Date(Date.now() - VOLUME_WINDOW_DAYS * 86_400_000);
    const workouts = await this.workoutModel.findAll({
      attributes: ['actual', 'distanceKm', 'sourceProvider'],
      where: { athleteId: athlete.id, status: 'completed', completedAt: { [Op.gte]: since } },
    });
    if (workouts.length < MIN_COMPLETED_FOR_VOLUME) {
      return null;
    }
    const total = workouts.reduce((sum, workout) => {
      const actual = workout.actual as Record<string, unknown> | null;
      const distance = typeof actual?.actualDistanceKm === 'number' ? actual.actualDistanceKm : workout.distanceKm;
      return sum + (Number(distance) || 0);
    }, 0);
    const valueKm = Math.round((total / (VOLUME_WINDOW_DAYS / 7)) * 10) / 10;
    const current = athlete.weeklyMileageKm;
    if (
      current !== null &&
      current > 0 &&
      Math.abs(valueKm - current) / current <= WEEKLY_MILEAGE_SUGGESTION_THRESHOLD
    ) {
      return null;
    }
    return {
      valueKm,
      source: workouts.some((workout) => workout.sourceProvider === 'strava') ? 'strava' : 'manual_workouts',
      windowDays: VOLUME_WINDOW_DAYS,
    };
  }

  private validate(athlete: Athlete): void {
    const ranged: RangedField[] = [
      'heightCm',
      'weightKg',
      'restingHeartRate',
      'maxHeartRate',
      'thresholdHeartRate',
      'sessionsPerWeek',
      'weeklyMileageKm',
      'preferredWorkoutDurationMinutes',
      'longRunMaxDurationMinutes',
    ];
    for (const field of ranged) {
      const value = athlete.get(field) as number | null;
      if (value !== null && value !== undefined && !this.inRange(field, Number(value))) {
        this.throwOutOfRange(field, ATHLETE_RANGES[field].min, ATHLETE_RANGES[field].max);
      }
    }

    const currentYear = new Date().getUTCFullYear();
    if (
      athlete.runningSinceYear !== null &&
      athlete.runningSinceYear !== undefined &&
      (athlete.runningSinceYear < ATHLETE_RANGES.runningSinceYear.min || athlete.runningSinceYear > currentYear)
    ) {
      this.throwOutOfRange('runningSinceYear', ATHLETE_RANGES.runningSinceYear.min, currentYear);
    }

    if (athlete.birthDate) {
      const age = ageFromBirthDate(athlete.birthDate, todayIsoInTz('UTC'));
      if (age === null || age < ATHLETE_RANGES.ageYears.min || age > ATHLETE_RANGES.ageYears.max) {
        this.throwOutOfRange('birthDate', ATHLETE_RANGES.ageYears.min, ATHLETE_RANGES.ageYears.max);
      }
    }

    if (!athlete.availableTrainingDays || athlete.availableTrainingDays.length === 0) {
      this.throwOutOfRange('availableTrainingDays', 1, 7);
    }

    if (!this.isHeartRateConsistent(athlete)) {
      throw new DomainException(
        'ATHLETE_HEART_RATE_INCONSISTENT',
        'Resting heart rate must be below threshold, and threshold below max',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (athlete.hrZonesMethod === 'custom' || athlete.hrZonesCustom !== null) {
      const custom = athlete.hrZonesCustom;
      if (athlete.hrZonesMethod === 'custom' && !custom) {
        throw new DomainException('ATHLETE_ZONES_INVALID', 'Custom zones are required', HttpStatus.BAD_REQUEST);
      }
      if (custom && !isValidCustomZones(custom, athlete.restingHeartRate, athlete.maxHeartRate)) {
        throw new DomainException(
          'ATHLETE_ZONES_INVALID',
          'Custom zones must be four increasing values between resting and max heart rate',
          HttpStatus.BAD_REQUEST,
        );
      }
    }
  }

  private isHeartRateConsistent(athlete: Athlete): boolean {
    const ordered = [athlete.restingHeartRate, athlete.thresholdHeartRate, athlete.maxHeartRate].filter(
      (value): value is number => typeof value === 'number',
    );
    return ordered.every((value, index) => index === 0 || value > ordered[index - 1]);
  }

  private inRange(field: string, value: number): boolean {
    const range = (ATHLETE_RANGES as Record<string, { min: number; max?: number }>)[field];
    if (!range) {
      return true;
    }
    return value >= range.min && (range.max === undefined || value <= range.max);
  }

  private throwOutOfRange(field: string, min: number, max: number): never {
    throw new DomainException(
      'ATHLETE_FIELD_OUT_OF_RANGE',
      `${field} is out of the accepted range ${min}–${max}`,
      HttpStatus.BAD_REQUEST,
      { fields: [{ field, min, max }] },
    );
  }

  private normalizeDays(days: string[]): string[] {
    const unique = new Set(days);
    return TRAINING_WEEKDAY_ORDER.filter((day) => unique.has(day));
  }
}
