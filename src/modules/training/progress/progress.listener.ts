import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/sequelize';

import { RealtimeService } from '@/modules/realtime/realtime.service';

import { Athlete } from '../entities/athlete.entity';
import { ProgressUpdatedEvent } from './progress.service';

/** Tells the user's clients that computed progress changed. */
@Injectable()
export class ProgressListener {
  constructor(
    private readonly realtimeService: RealtimeService,
    @InjectModel(Athlete) private readonly athleteModel: typeof Athlete,
  ) {}

  @OnEvent('progress.updated')
  handleUpdated(event: ProgressUpdatedEvent): void {
    this.realtimeService.emitToUser(event.userId, 'progress.updated', {});
  }

  @OnEvent('training.workout.completed', { async: true })
  async handleWorkoutCompleted(event: { athleteId: string }): Promise<void> {
    await this.notifyAthlete(event.athleteId);
  }

  @OnEvent('integrations.activity_imported', { async: true })
  async handleActivityImported(event: { athleteId: string }): Promise<void> {
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
