import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes, Transaction } from 'sequelize';

import { DomainConflictException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { TRAINING_EVENTS } from '@/modules/training/training.events';

import { Athlete } from '../entities/athlete.entity';
import { Gear } from '../entities/gear.entity';
import { Workout } from '../entities/workout.entity';
import { GearReplaceSoonEvent, GearUpdatedEvent } from '../events/gear.events';
import { GEAR_REPLACE_THRESHOLD, type GearStatus, type WorkoutType } from '../training.constants';
import { CreateGearDto, GearListResponseDto, GearResponseDto, UpdateGearDto } from './dto/gear.dto';

interface GearUsage {
  distanceKm: number;
  workoutsCount: number;
}

/** A shoe as Strava reports it on the athlete. */
export interface ExternalShoe {
  externalId: string;
  brand: string;
  model: string;
  nickname: string | null;
  /** Total distance on Strava, km. */
  distanceKm: number;
  retired: boolean;
}

/**
 * Running gear: CRUD, default workout types, computed mileage and automatic
 * assignment of completed workouts.
 */
@Injectable()
export class GearService {
  private readonly logger = new Logger(GearService.name);

  constructor(
    @InjectModel(Gear)
    private readonly gearModel: typeof Gear,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    private readonly athletesService: AthletesService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async list(userId: string, status: GearStatus = 'active'): Promise<GearListResponseDto> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const items = await this.gearModel.findAll({
      where: { athleteId: athlete.id, retiredAt: status === 'active' ? null : { [Op.ne]: null } },
      order: status === 'active' ? [['createdAt', 'DESC']] : [['retiredAt', 'DESC']],
    });
    const usage = await this.usageFor(items.map((gear) => gear.id));
    return { items: items.map((gear) => this.toResponse(gear, usage.get(gear.id))) };
  }

  async get(userId: string, gearId: string): Promise<GearResponseDto> {
    const gear = await this.loadOwned(userId, gearId);
    const usage = await this.usageFor([gear.id]);
    return this.toResponse(gear, usage.get(gear.id));
  }

  async create(userId: string, dto: CreateGearDto): Promise<GearResponseDto> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const gear = await this.db.transaction(async (transaction) => {
      const created = await this.gearModel.create(
        {
          athleteId: athlete.id,
          type: dto.type ?? 'shoes',
          brand: dto.brand,
          model: dto.model,
          nickname: dto.nickname || null,
          initialDistanceKm: dto.initialDistanceKm ?? 0,
          limitKm: dto.limitKm,
          startedAt: dto.startedAt ?? null,
          defaultWorkoutTypes: dto.defaultWorkoutTypes ?? [],
          replaceReminder: dto.replaceReminder ?? true,
          source: 'manual',
        },
        { transaction },
      );
      await this.releaseDefaultTypes(athlete.id, created.id, created.defaultWorkoutTypes, transaction);
      return created;
    });
    this.emitUpdated(userId, athlete.id, gear.id);
    return this.get(userId, gear.id);
  }

  async update(userId: string, gearId: string, dto: UpdateGearDto): Promise<GearResponseDto> {
    const gear = await this.loadOwned(userId, gearId);
    if (gear.retiredAt && dto.defaultWorkoutTypes && dto.defaultWorkoutTypes.length > 0) {
      throw new DomainConflictException('GEAR_RETIRED', 'Retired gear cannot be a default for workouts');
    }
    await this.db.transaction(async (transaction) => {
      if (dto.type !== undefined) gear.type = dto.type;
      if (dto.brand !== undefined) gear.brand = dto.brand;
      if (dto.model !== undefined) gear.model = dto.model;
      if (dto.nickname !== undefined) gear.nickname = dto.nickname || null;
      if (dto.initialDistanceKm !== undefined) gear.initialDistanceKm = dto.initialDistanceKm;
      if (dto.limitKm !== undefined) {
        gear.limitKm = dto.limitKm;
        gear.replaceNotifiedAt = null;
      }
      if (dto.startedAt !== undefined) gear.startedAt = dto.startedAt;
      if (dto.replaceReminder !== undefined) gear.replaceReminder = dto.replaceReminder;
      if (dto.defaultWorkoutTypes !== undefined) {
        gear.defaultWorkoutTypes = dto.defaultWorkoutTypes;
        await this.releaseDefaultTypes(gear.athleteId, gear.id, dto.defaultWorkoutTypes, transaction);
      }
      await gear.save({ transaction });
    });
    this.emitUpdated(userId, gear.athleteId, gear.id);
    return this.get(userId, gear.id);
  }

  async retire(userId: string, gearId: string): Promise<GearResponseDto> {
    const gear = await this.loadOwned(userId, gearId);
    if (!gear.retiredAt) {
      gear.retiredAt = new Date();
      gear.defaultWorkoutTypes = [];
      await gear.save();
      this.emitUpdated(userId, gear.athleteId, gear.id);
    }
    return this.get(userId, gear.id);
  }

  async restore(userId: string, gearId: string): Promise<GearResponseDto> {
    const gear = await this.loadOwned(userId, gearId);
    if (gear.retiredAt) {
      gear.retiredAt = null;
      await gear.save();
      this.emitUpdated(userId, gear.athleteId, gear.id);
    }
    return this.get(userId, gear.id);
  }

  async remove(userId: string, gearId: string): Promise<void> {
    const gear = await this.loadOwned(userId, gearId);
    await this.db.transaction(async (transaction) => {
      // Soft delete does not fire ON DELETE SET NULL, so unlink workouts explicitly.
      await this.workoutModel.update({ gearId: null }, { where: { gearId: gear.id }, transaction });
      await gear.destroy({ transaction });
    });
    this.emitUpdated(userId, gear.athleteId, gear.id);
  }

  /** Manually sets or clears the gear of a workout. Retired gear may be chosen explicitly. */
  async assignToWorkout(
    userId: string,
    workoutId: string,
    gearId: string | null,
  ): Promise<{ workoutId: string; gearId: string | null }> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const workout = await this.workoutModel.findOne({ where: { id: workoutId, athleteId: athlete.id } });
    if (!workout) {
      throw new DomainNotFoundException('WORKOUT_NOT_FOUND', 'Workout not found');
    }
    if (gearId) {
      await this.loadOwned(userId, gearId);
    }
    workout.gearId = gearId;
    await workout.save();
    this.emitUpdated(userId, athlete.id, gearId);
    if (gearId) {
      await this.checkReplaceSoon(gearId, userId);
    }
    return { workoutId: workout.id, gearId };
  }

  /**
   * Picks shoes for a completed workout that has none: a pair matching the
   * external gear id wins, then the pair that is default for the workout type,
   * then the most recently added active pair.
   */
  async autoAssign(workoutId: string, externalGearId?: string | null): Promise<void> {
    const workout = await this.workoutModel.findByPk(workoutId);
    if (!workout || workout.status !== 'completed') {
      return;
    }
    let gear: Gear | null = null;
    if (externalGearId) {
      gear = await this.gearModel.findOne({
        where: { athleteId: workout.athleteId, source: 'strava', externalId: externalGearId },
      });
    }
    if (!gear && workout.gearId) {
      return;
    }
    if (!gear) {
      const active = await this.gearModel.findAll({
        where: { athleteId: workout.athleteId, retiredAt: null },
        order: [['createdAt', 'DESC']],
      });
      gear =
        active.find((entry) => entry.defaultWorkoutTypes.includes(workout.type as WorkoutType)) ?? active[0] ?? null;
    }
    if (!gear || workout.gearId === gear.id) {
      return;
    }
    workout.gearId = gear.id;
    await workout.save();
    const athlete = await this.athleteModel.findByPk(workout.athleteId, { attributes: ['id', 'userId'] });
    if (athlete) {
      this.emitUpdated(athlete.userId, athlete.id, gear.id);
      await this.checkReplaceSoon(gear.id, athlete.userId);
    }
  }

  /**
   * Upserts shoes reported by Strava. `initialDistanceKm` covers the distance
   * Strava knows that is not explained by workouts already linked to the pair.
   */
  async upsertExternalShoes(athleteId: string, shoes: ExternalShoe[]): Promise<number> {
    let changed = 0;
    for (const shoe of shoes) {
      const existing = await this.gearModel.findOne({
        where: { athleteId, source: 'strava', externalId: shoe.externalId },
      });
      if (existing) {
        const usage = (await this.usageFor([existing.id])).get(existing.id);
        const linked = usage ? usage.distanceKm - existing.initialDistanceKm : 0;
        const initial = Math.max(0, Math.round((shoe.distanceKm - linked) * 10) / 10);
        const retiredAt = shoe.retired ? (existing.retiredAt ?? new Date()) : existing.retiredAt;
        if (existing.initialDistanceKm !== initial || retiredAt !== existing.retiredAt) {
          existing.initialDistanceKm = initial;
          existing.retiredAt = retiredAt;
          await existing.save();
          changed += 1;
        }
        continue;
      }
      await this.gearModel.create({
        athleteId,
        type: 'shoes',
        brand: shoe.brand.slice(0, 60) || 'Strava',
        model: shoe.model.slice(0, 80) || shoe.nickname?.slice(0, 80) || 'Shoes',
        nickname: shoe.nickname?.slice(0, 60) ?? null,
        initialDistanceKm: Math.max(0, Math.round(shoe.distanceKm * 10) / 10),
        retiredAt: shoe.retired ? new Date() : null,
        defaultWorkoutTypes: [],
        source: 'strava',
        externalId: shoe.externalId,
      });
      changed += 1;
    }
    if (changed > 0) {
      const athlete = await this.athleteModel.findByPk(athleteId, { attributes: ['id', 'userId'] });
      if (athlete) {
        this.emitUpdated(athlete.userId, athleteId, null);
      }
    }
    return changed;
  }

  private get db(): NonNullable<typeof Gear.sequelize> {
    return this.gearModel.sequelize!;
  }

  private async checkReplaceSoon(gearId: string, userId: string): Promise<void> {
    const gear = await this.gearModel.findByPk(gearId);
    if (!gear || gear.retiredAt || gear.replaceNotifiedAt) {
      return;
    }
    const usage = (await this.usageFor([gear.id])).get(gear.id);
    const distanceKm = usage?.distanceKm ?? gear.initialDistanceKm;
    if (distanceKm < gear.limitKm * (1 - GEAR_REPLACE_THRESHOLD)) {
      return;
    }
    gear.replaceNotifiedAt = new Date();
    await gear.save();
    if (!gear.replaceReminder) {
      return;
    }
    this.eventEmitter.emit(
      TRAINING_EVENTS.GEAR_REPLACE_SOON,
      new GearReplaceSoonEvent(
        userId,
        gear.athleteId,
        gear.id,
        distanceKm,
        gear.limitKm,
        `${gear.brand} ${gear.model}`.trim(),
      ),
    );
  }

  /** A workout type is the default of at most one active pair. */
  private async releaseDefaultTypes(
    athleteId: string,
    keepGearId: string,
    types: WorkoutType[],
    transaction: Transaction,
  ): Promise<void> {
    if (types.length === 0) {
      return;
    }
    const others = await this.gearModel.findAll({
      where: { athleteId, id: { [Op.ne]: keepGearId }, retiredAt: null },
      transaction,
    });
    for (const other of others) {
      const remaining = other.defaultWorkoutTypes.filter((type) => !types.includes(type));
      if (remaining.length !== other.defaultWorkoutTypes.length) {
        other.defaultWorkoutTypes = remaining;
        await other.save({ transaction });
      }
    }
  }

  /** Distance and count of completed workouts per pair, in one query. */
  private async usageFor(gearIds: string[]): Promise<Map<string, GearUsage>> {
    const result = new Map<string, GearUsage>();
    if (gearIds.length === 0) {
      return result;
    }
    const rows = await this.db.query<{ gear_id: string; distance_km: string | null; workouts_count: string }>(
      `SELECT g.id AS gear_id,
              g.initial_distance_km + COALESCE(SUM(
                COALESCE(NULLIF(w.actual->>'actualDistanceKm', '')::numeric, w.distance_km::numeric)
              ), 0) AS distance_km,
              COUNT(w.id) AS workouts_count
         FROM gear g
         LEFT JOIN workouts w
           ON w.gear_id = g.id AND w.status = 'completed' AND w.deleted_at IS NULL
        WHERE g.id IN (:gearIds)
        GROUP BY g.id`,
      { replacements: { gearIds }, type: QueryTypes.SELECT },
    );
    for (const row of rows) {
      result.set(row.gear_id, {
        distanceKm: Math.round(Number(row.distance_km ?? 0) * 10) / 10,
        workoutsCount: Number(row.workouts_count ?? 0),
      });
    }
    return result;
  }

  private async loadOwned(userId: string, gearId: string): Promise<Gear> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const gear = await this.gearModel.findOne({ where: { id: gearId, athleteId: athlete.id } });
    if (!gear) {
      throw new DomainNotFoundException('GEAR_NOT_FOUND', 'Gear not found');
    }
    return gear;
  }

  private emitUpdated(userId: string, athleteId: string, gearId: string | null): void {
    this.eventEmitter.emit(TRAINING_EVENTS.GEAR_UPDATED, new GearUpdatedEvent(userId, athleteId, gearId));
  }

  private toResponse(gear: Gear, usage?: GearUsage): GearResponseDto {
    const distanceKm = usage?.distanceKm ?? gear.initialDistanceKm;
    const remainingKm = Math.max(0, Math.round((gear.limitKm - distanceKm) * 10) / 10);
    return {
      id: gear.id,
      type: gear.type,
      brand: gear.brand,
      model: gear.model,
      nickname: gear.nickname,
      initialDistanceKm: gear.initialDistanceKm,
      limitKm: gear.limitKm,
      startedAt: gear.startedAt,
      retiredAt: gear.retiredAt,
      status: gear.retiredAt ? 'retired' : 'active',
      defaultWorkoutTypes: [...gear.defaultWorkoutTypes],
      replaceReminder: gear.replaceReminder,
      source: gear.source,
      distanceKm,
      workoutsCount: usage?.workoutsCount ?? 0,
      remainingKm,
      wearPercent: Math.min(100, Math.round((distanceKm / gear.limitKm) * 100)),
      replaceSoon: !gear.retiredAt && distanceKm >= gear.limitKm * (1 - GEAR_REPLACE_THRESHOLD),
      createdAt: gear.createdAt,
      updatedAt: gear.updatedAt,
    };
  }
}
