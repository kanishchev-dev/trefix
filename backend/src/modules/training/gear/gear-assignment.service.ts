import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Op } from 'sequelize';

import { DomainBadRequestException, DomainNotFoundException } from '@/common/exceptions/domain-exceptions';
import { AthletesService } from '@/modules/training/athletes/athletes.service';

import { Athlete } from '../entities/athlete.entity';
import { Gear } from '../entities/gear.entity';
import { Workout } from '../entities/workout.entity';
import type { GearDataSource, WorkoutType } from '../training.constants';
import { GearService } from './gear.service';

/** Which shoes and device a workout used: manual choice and automatic assignment of completed workouts. */
@Injectable()
export class GearAssignmentService {
  constructor(
    @InjectModel(Gear)
    private readonly gearModel: typeof Gear,
    @InjectModel(Workout)
    private readonly workoutModel: typeof Workout,
    @InjectModel(Athlete)
    private readonly athleteModel: typeof Athlete,
    private readonly athletesService: AthletesService,
    private readonly gearService: GearService,
  ) {}

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
    if (gearId && (await this.gearService.loadOwned(userId, gearId)).type !== 'shoes') {
      throw new DomainBadRequestException('GEAR_TYPE_MISMATCH', 'Only shoes can be set as workout gear');
    }
    workout.gearId = gearId;
    await workout.save();
    this.gearService.emitUpdated(userId, athlete.id, gearId);
    if (gearId) {
      await this.gearService.checkReplaceSoon(gearId, userId);
    }
    return { workoutId: workout.id, gearId };
  }

  /** Manually sets or clears the watch or sensor a workout was recorded with. */
  async assignDeviceToWorkout(
    userId: string,
    workoutId: string,
    deviceId: string | null,
  ): Promise<{ workoutId: string; deviceId: string | null }> {
    const athlete = await this.athletesService.getOrCreateAthlete(userId);
    const workout = await this.workoutModel.findOne({ where: { id: workoutId, athleteId: athlete.id } });
    if (!workout) {
      throw new DomainNotFoundException('WORKOUT_NOT_FOUND', 'Workout not found');
    }
    if (deviceId && (await this.gearService.loadOwned(userId, deviceId)).type === 'shoes') {
      throw new DomainBadRequestException('GEAR_TYPE_MISMATCH', 'Only a watch or a sensor can record a workout');
    }
    workout.deviceId = deviceId;
    await workout.save();
    this.gearService.emitUpdated(userId, athlete.id, deviceId);
    return { workoutId: workout.id, deviceId };
  }

  /** Service of the primary device, or null; dedup prefers its records. */
  async primaryDataSource(athleteId: string): Promise<GearDataSource | null> {
    const device = await this.gearModel.findOne({
      where: { athleteId, isPrimary: true, retiredAt: null },
      attributes: ['dataSource'],
    });
    return device?.dataSource ?? null;
  }

  /**
   * Fills shoes and the device of a completed workout. Shoes: a pair matching
   * the external gear id wins, then the default for the workout type, then the
   * default pair, then the most recently added one. Device: an active device
   * fed by the workout's service, the primary one first.
   */
  async autoAssign(workoutId: string, externalGearId?: string | null): Promise<void> {
    const workout = await this.workoutModel.findByPk(workoutId);
    if (!workout || workout.status !== 'completed') {
      return;
    }
    const shoes = await this.pickShoes(workout, externalGearId ?? null);
    const device = workout.deviceId ? null : await this.pickDevice(workout);
    if (!shoes && !device) {
      return;
    }
    if (shoes) {
      workout.gearId = shoes.id;
    }
    if (device) {
      workout.deviceId = device.id;
    }
    await workout.save();
    const athlete = await this.athleteModel.findByPk(workout.athleteId, { attributes: ['id', 'userId'] });
    if (athlete) {
      this.gearService.emitUpdated(athlete.userId, athlete.id, shoes?.id ?? device?.id ?? null);
      if (shoes) {
        await this.gearService.checkReplaceSoon(shoes.id, athlete.userId);
      }
    }
  }

  private async pickShoes(workout: Workout, externalGearId: string | null): Promise<Gear | null> {
    let gear: Gear | null = null;
    if (externalGearId) {
      gear = await this.gearModel.findOne({
        where: { athleteId: workout.athleteId, source: 'strava', externalId: externalGearId },
      });
    }
    if (!gear && workout.gearId) {
      return null;
    }
    if (!gear) {
      const active = await this.gearModel.findAll({
        where: { athleteId: workout.athleteId, type: 'shoes', retiredAt: null },
        order: [['createdAt', 'DESC']],
      });
      gear =
        active.find((entry) => entry.defaultWorkoutTypes.includes(workout.type as WorkoutType)) ??
        active.find((entry) => entry.isDefault) ??
        active[0] ??
        null;
    }
    return gear && workout.gearId !== gear.id ? gear : null;
  }

  private async pickDevice(workout: Workout): Promise<Gear | null> {
    if (!workout.sourceProvider) {
      return null;
    }
    const devices = await this.gearModel.findAll({
      where: {
        athleteId: workout.athleteId,
        type: { [Op.ne]: 'shoes' },
        dataSource: workout.sourceProvider,
        retiredAt: null,
      },
      order: [
        ['isPrimary', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });
    return devices[0] ?? null;
  }
}
