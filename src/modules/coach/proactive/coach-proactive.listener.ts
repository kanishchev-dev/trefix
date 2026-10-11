import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { GearReplaceSoonEvent } from '@/modules/training/events/gear.events';
import { PlanAdaptationProposedEvent } from '@/modules/training/events/plan-adapted.event';
import { TRAINING_EVENTS } from '@/modules/training/training.events';

import { CoachMessageTexts } from './coach-message-texts';
import { type ProactiveMessage } from './coach-proactive.constants';
import { CoachProactiveService } from './coach-proactive.service';

@Injectable()
export class CoachProactiveListener {
  private readonly logger = new Logger(CoachProactiveListener.name);

  constructor(
    private readonly proactiveService: CoachProactiveService,
    private readonly texts: CoachMessageTexts,
  ) {}

  @OnEvent(TRAINING_EVENTS.GEAR_REPLACE_SOON, { async: true })
  async handleGearReplaceSoon(event: GearReplaceSoonEvent): Promise<void> {
    const distance = Math.round(event.distanceKm);
    await this.safely(async () => ({
      userId: event.userId,
      athleteId: event.athleteId,
      kind: 'gear_replace_soon',
      content: await this.texts.gearReplaceSoon(event.userId, {
        gearName: event.gearName,
        distanceKm: distance,
        limitKm: event.limitKm,
      }),
      params: { gearId: event.gearId, gearName: event.gearName, distanceKm: distance, limitKm: event.limitKm },
    }));
  }

  @OnEvent(TRAINING_EVENTS.PLAN_ADAPTATION_PROPOSED, { async: true })
  async handleAdaptationProposed(event: PlanAdaptationProposedEvent): Promise<void> {
    const proposed = event.status === 'proposed';
    await this.safely(async () => ({
      userId: event.userId,
      athleteId: event.athleteId,
      kind: proposed ? 'adaptation_proposed' : 'adaptation_suggested',
      content: await this.texts.adaptation(event.userId, event.action, proposed),
      params: {
        adaptationId: event.adaptationId,
        planId: event.planId,
        action: event.action,
        changesCount: event.changesCount,
      },
    }));
  }

  /** Proactive messages are a nicety: a failure is logged and never breaks the flow that triggered it. */
  private async safely(build: () => Promise<ProactiveMessage>): Promise<void> {
    try {
      await this.proactiveService.deliver(await build());
    } catch (error) {
      this.logger.warn(`Proactive message failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
