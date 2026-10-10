import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { RealtimeService } from '@/modules/realtime/realtime.service';

import { GearUpdatedEvent } from '../events/gear.events';
import { WorkoutCompletedEvent } from '../events/workout-completed.event';
import { GearService } from './gear.service';

/** Payload of `integrations.activity_imported` / `_updated` / `_merged` used here; declared locally to avoid a module cycle. */
interface ImportedActivity {
  workoutId: string;
  gearExternalId?: string | null;
}

@Injectable()
export class GearListener {
  private readonly logger = new Logger(GearListener.name);

  constructor(
    private readonly gearService: GearService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @OnEvent('training.workout.completed', { async: true })
  async handleWorkoutCompleted(event: WorkoutCompletedEvent): Promise<void> {
    await this.safely(() => this.gearService.autoAssign(event.workoutId));
  }

  @OnEvent('integrations.activity_imported', { async: true })
  @OnEvent('integrations.activity_updated', { async: true })
  @OnEvent('integrations.activity_merged', { async: true })
  async handleActivityImported(event: ImportedActivity): Promise<void> {
    await this.safely(() => this.gearService.autoAssign(event.workoutId, event.gearExternalId ?? null));
  }

  @OnEvent('training.gear.updated')
  handleGearUpdated(event: GearUpdatedEvent): void {
    this.realtimeService.emitToUser(event.userId, 'gear.updated', { gearId: event.gearId });
  }

  private async safely(work: () => Promise<void>): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.warn(`Gear auto-assignment failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
