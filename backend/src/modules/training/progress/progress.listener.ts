import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { INTEGRATIONS_EVENTS } from '@/modules/integrations/integrations.events';
import { RealtimeService } from '@/modules/realtime/realtime.service';
import { TRAINING_EVENTS } from '@/modules/training/training.events';

import { Athlete } from '../entities/athlete.entity';
import { ProgressUpdatedEvent } from './progress.service';

/** Tells the user's clients that computed progress changed. */
@Injectable()
export class ProgressListener {
  constructor(
    private readonly realtimeService: RealtimeService,
    @InjectModel(Athlete) private readonly athleteModel: typeof Athlete,
  ) {}

  @OnEvent(TRAINING_EVENTS.PROGRESS_UPDATED)
  handleUpdated(event: ProgressUpdatedEvent): void {
    this.realtimeService.emitToUser(event.userId, 'progress.updated', {});
  }

  @OnEvent(TRAINING_EVENTS.WORKOUT_COMPLETED, { async: true })
  async handleWorkoutCompleted(event: { athleteId: string }): Promise<void> {
    await this.notifyAthlete(event.athleteId);
  }

  @OnEvent(INTEGRATIONS_EVENTS.ACTIVITY_IMPORTED, { async: true })
  async handleActivityImported(event: { athleteId: string }): Promise<void> {
    await this.notifyAthlete(event.athleteId);
  }

  @OnEvent(INTEGRATIONS_EVENTS.ACTIVITY_UPDATED, { async: true })
  @OnEvent(INTEGRATIONS_EVENTS.ACTIVITY_MERGED, { async: true })
  @OnEvent(INTEGRATIONS_EVENTS.ACTIVITY_SOURCE_REMOVED, { async: true })
  async handleActivityChanged(event: { athleteId: string }): Promise<void> {
    await this.notifyAthlete(event.athleteId);
  }

  private async notifyAthlete(athleteId: string): Promise<void> {
    const event = { athleteId };
    const athlete = await this.athleteModel.findByPk(event.athleteId, { attributes: ['userId'] });
    if (athlete) {
      this.realtimeService.emitToUser(athlete.userId, 'progress.updated', {});
    }
  }
}
