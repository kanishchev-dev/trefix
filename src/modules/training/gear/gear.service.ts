import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';
import { Op, QueryTypes, Transaction } from 'sequelize';

import {
  DomainBadRequestException,
  DomainConflictException,
  DomainNotFoundException,
} from '@/common/exceptions/domain-exceptions';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { TRAINING_EVENTS } from '@/modules/training/training.events';

import { Athlete } from '../entities/athlete.entity';
import { Gear } from '../entities/gear.entity';
import { Workout } from '../entities/workout.entity';
import { GearReplaceSoonEvent, GearUpdatedEvent } from '../events/gear.events';
import {
  GEAR_LIMIT_KM_DEFAULT,
  GEAR_REPLACE_THRESHOLD,
  type GearStatus,
  type GearType,
  type WorkoutType,
} from '../training.constants';
import { CreateGearDto, GearListResponseDto, GearResponseDto, UpdateGearDto } from './dto/gear.dto';

export interface ExternalShoesImport {
  created: string[];
  updated: string[];
  unchanged: number;
}

const SHOE_ONLY_FIELDS = ['limitKm', 'defaultWorkoutTypes', 'replaceReminder', 'isDefault'] as const;
const DEVICE_ONLY_FIELDS = ['isPrimary', 'dataSource'] as const;

interface GearUsage {
  distanceKm: number;
  workoutsCount: number;
  averagePaceSecondsPerKm: number | null;
  /** Average weekly distance over the last four weeks; drives the wear forecast. */
  weeklyKm: number;
}

const USAGE_WINDOW_DAYS = 28;

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
 * Shoes, watches and sensors: CRUD, default shoes, the primary device, computed
 * mileage and automatic assignment of completed workouts.
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

  async list(userId: string, status: GearStatus = 'active', type?: GearType): Promise<GearListResponseDto> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const items = await this.gearModel.findAll({
      where: {
        athleteId: athlete.id,
        retiredAt: status === 'active' ? null : { [Op.ne]: null },
        ...(type ? { type } : {}),
      },
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
    const type = dto.type ?? 'shoes';
    this.assertFieldsApply(type, dto);
    const isShoes = type === 'shoes';
    const gear = await this.db.transaction(async (transaction) => {
      const created = await this.gearModel.create(
        {
          athleteId: athlete.id,
          type,
          brand: dto.brand,
          model: dto.model,
          nickname: dto.nickname || null,
          initialDistanceKm: dto.initialDistanceKm ?? 0,
          limitKm: isShoes ? (dto.limitKm ?? GEAR_LIMIT_KM_DEFAULT) : null,
          startedAt: dto.startedAt ?? null,
          defaultWorkoutTypes: isShoes ? (dto.defaultWorkoutTypes ?? []) : [],
          replaceReminder: isShoes ? (dto.replaceReminder ?? true) : false,
          isDefault: isShoes && (dto.isDefault ?? false),
          isPrimary: !isShoes && (dto.isPrimary ?? false),
          dataSource: isShoes ? null : (dto.dataSource ?? null),
          source: 'manual',
        },
        { transaction },
      );
      await this.releaseDefaultTypes(athlete.id, created.id, created.defaultWorkoutTypes, transaction);
      await this.releaseFlags(created, transaction);
      return created;
    });
    this.emitUpdated(userId, athlete.id, gear.id);
    return this.get(userId, gear.id);
  }

  async update(userId: string, gearId: string, dto: UpdateGearDto): Promise<GearResponseDto> {
    const gear = await this.loadOwned(userId, gearId);
    this.assertFieldsApply(gear.type, dto);
    if (gear.retiredAt && (dto.defaultWorkoutTypes?.length || dto.isDefault || dto.isPrimary)) {
      throw new DomainConflictException('GEAR_RETIRED', 'Retired gear cannot be a default for workouts');
    }
    await this.db.transaction(async (transaction) => {
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
      if (dto.isDefault !== undefined) gear.isDefault = dto.isDefault;
      if (dto.isPrimary !== undefined) gear.isPrimary = dto.isPrimary;
      if (dto.dataSource !== undefined) gear.dataSource = dto.dataSource;
      if (dto.defaultWorkoutTypes !== undefined) {
        gear.defaultWorkoutTypes = dto.defaultWorkoutTypes;
        await this.releaseDefaultTypes(gear.athleteId, gear.id, dto.defaultWorkoutTypes, transaction);
      }
      await this.releaseFlags(gear, transaction);
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
      gear.isDefault = false;
      gear.isPrimary = false;
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
      await this.workoutModel.update({ deviceId: null }, { where: { deviceId: gear.id }, transaction });
      await gear.destroy({ transaction });
    });
    this.emitUpdated(userId, gear.athleteId, gear.id);
  }

  /**
   * Upserts shoes reported by Strava. `initialDistanceKm` covers the distance
   * Strava knows that is not explained by workouts already linked to the pair.
   */
  async upsertExternalShoes(athleteId: string, shoes: ExternalShoe[]): Promise<ExternalShoesImport> {
    const result: ExternalShoesImport = { created: [], updated: [], unchanged: 0 };
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
          result.updated.push(existing.id);
        } else {
          result.unchanged += 1;
        }
        continue;
      }
      const created = await this.gearModel.create({
        athleteId,
        type: 'shoes',
        brand: shoe.brand.slice(0, 60) || 'Strava',
        model: shoe.model.slice(0, 80) || shoe.nickname?.slice(0, 80) || 'Shoes',
        nickname: shoe.nickname?.slice(0, 60) ?? null,
        initialDistanceKm: Math.max(0, Math.round(shoe.distanceKm * 10) / 10),
        retiredAt: shoe.retired ? new Date() : null,
        limitKm: GEAR_LIMIT_KM_DEFAULT,
        defaultWorkoutTypes: [],
        source: 'strava',
        externalId: shoe.externalId,
      });
      result.created.push(created.id);
    }
    if (result.created.length + result.updated.length > 0) {
      const athlete = await this.athleteModel.findByPk(athleteId, { attributes: ['id', 'userId'] });
      if (athlete) {
        this.emitUpdated(athlete.userId, athleteId, null);
      }
    }
    return result;
  }

  /** Responses for gear ids, keeping the order of `ids`. */
  async getMany(athleteId: string, ids: string[]): Promise<GearResponseDto[]> {
    if (ids.length === 0) {
      return [];
    }
    const items = await this.gearModel.findAll({ where: { athleteId, id: ids } });
    const usage = await this.usageFor(items.map((gear) => gear.id));
    const byId = new Map(items.map((gear) => [gear.id, gear]));
    return ids.flatMap((id) => {
      const gear = byId.get(id);
      return gear ? [this.toResponse(gear, usage.get(gear.id))] : [];
    });
  }

  private get db(): NonNullable<typeof Gear.sequelize> {
    return this.gearModel.sequelize!;
  }

  /** Emits the replace-soon reminder once when a pair crosses 90% of its limit. */
  async checkReplaceSoon(gearId: string, userId: string): Promise<void> {
    const gear = await this.gearModel.findByPk(gearId);
    if (!gear || gear.limitKm === null || gear.retiredAt || gear.replaceNotifiedAt) {
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

  /** Shoe fields on a device or device fields on shoes are a client error, not something to drop silently. */
  private assertFieldsApply(type: GearType, dto: UpdateGearDto): void {
    const foreign = type === 'shoes' ? DEVICE_ONLY_FIELDS : SHOE_ONLY_FIELDS;
    const fields = foreign.filter((field) => dto[field] !== undefined);
    if (fields.length > 0) {
      throw new DomainBadRequestException('GEAR_FIELD_NOT_APPLICABLE', `${fields.join(', ')} do not apply to ${type}`, {
        fields,
      });
    }
  }

  /** Only one default pair and one primary device per athlete. */
  private async releaseFlags(gear: Gear, transaction: Transaction): Promise<void> {
    for (const flag of ['isDefault', 'isPrimary'] as const) {
      if (gear[flag]) {
        await this.gearModel.update(
          { [flag]: false },
          { where: { athleteId: gear.athleteId, id: { [Op.ne]: gear.id }, [flag]: true }, transaction },
        );
      }
    }
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
      where: { athleteId, id: { [Op.ne]: keepGearId }, type: 'shoes', retiredAt: null },
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

  /** Distance and count of completed workouts per item (shoes by `gear_id`, devices by `device_id`), in one query. */
  private async usageFor(gearIds: string[]): Promise<Map<string, GearUsage>> {
    const result = new Map<string, GearUsage>();
    if (gearIds.length === 0) {
      return result;
    }
    const rows = await this.db.query<{
      gear_id: string;
      distance_km: string | null;
      workouts_count: string;
      paced_km: string | null;
      paced_minutes: string | null;
      recent_km: string | null;
    }>(
      `WITH w AS (
         SELECT w.*,
                COALESCE(NULLIF(w.actual->>'actualDistanceKm', '')::numeric, w.distance_km::numeric) AS km,
                NULLIF(w.actual->>'actualDurationMinutes', '')::numeric AS minutes
           FROM workouts w
          WHERE w.status = 'completed'
            AND w.deleted_at IS NULL
            AND (w.gear_id IN (:gearIds) OR w.device_id IN (:gearIds))
       )
       SELECT g.id AS gear_id,
              g.initial_distance_km + COALESCE(SUM(w.km), 0) AS distance_km,
              COUNT(w.id) AS workouts_count,
              SUM(w.km) FILTER (WHERE w.minutes > 0 AND w.km > 0) AS paced_km,
              SUM(w.minutes) FILTER (WHERE w.minutes > 0 AND w.km > 0) AS paced_minutes,
              SUM(w.km) FILTER (WHERE w.completed_at >= NOW() - INTERVAL '${USAGE_WINDOW_DAYS} days') AS recent_km
         FROM gear g
         LEFT JOIN w
           ON (CASE WHEN g.type = 'shoes' THEN w.gear_id ELSE w.device_id END) = g.id
        WHERE g.id IN (:gearIds)
        GROUP BY g.id`,
      { replacements: { gearIds }, type: QueryTypes.SELECT },
    );
    for (const row of rows) {
      const pacedKm = Number(row.paced_km ?? 0);
      result.set(row.gear_id, {
        distanceKm: Math.round(Number(row.distance_km ?? 0) * 10) / 10,
        workoutsCount: Number(row.workouts_count ?? 0),
        averagePaceSecondsPerKm:
          pacedKm > 0 ? Math.round((Number(row.paced_minutes ?? 0) * 60) / pacedKm) : null,
        weeklyKm: Math.round((Number(row.recent_km ?? 0) / (USAGE_WINDOW_DAYS / 7)) * 10) / 10,
      });
    }
    return result;
  }

  async loadOwned(userId: string, gearId: string): Promise<Gear> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const gear = await this.gearModel.findOne({ where: { id: gearId, athleteId: athlete.id } });
    if (!gear) {
      throw new DomainNotFoundException('GEAR_NOT_FOUND', 'Gear not found');
    }
    return gear;
  }

  emitUpdated(userId: string, athleteId: string, gearId: string | null): void {
    this.eventEmitter.emit(TRAINING_EVENTS.GEAR_UPDATED, new GearUpdatedEvent(userId, athleteId, gearId));
  }

  private toResponse(gear: Gear, usage?: GearUsage): GearResponseDto {
    const distanceKm = usage?.distanceKm ?? gear.initialDistanceKm;
    const limitKm = gear.limitKm;
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
      isDefault: gear.isDefault,
      isPrimary: gear.isPrimary,
      dataSource: gear.dataSource,
      distanceKm,
      workoutsCount: usage?.workoutsCount ?? 0,
      averagePaceSecondsPerKm: usage?.averagePaceSecondsPerKm ?? null,
      weeklyKm: usage?.weeklyKm ?? 0,
      remainingKm: limitKm === null ? null : Math.max(0, Math.round((limitKm - distanceKm) * 10) / 10),
      wearPercent: limitKm === null ? null : Math.min(100, Math.round((distanceKm / limitKm) * 100)),
      replaceSoon: limitKm !== null && !gear.retiredAt && distanceKm >= limitKm * (1 - GEAR_REPLACE_THRESHOLD),
      createdAt: gear.createdAt,
      updatedAt: gear.updatedAt,
    };
  }
}
