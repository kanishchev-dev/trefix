import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { GearReplaceSoonEvent } from '@/modules/training/events/gear.events';
import { PlanAdaptationProposedEvent } from '@/modules/training/events/plan-adapted.event';

import { ADAPTATION_ACTION_TEXT, type ProactiveMessage } from './coach-proactive.constants';
import { CoachProactiveService } from './coach-proactive.service';

@Injectable()
export class CoachProactiveListener {
  private readonly logger = new Logger(CoachProactiveListener.name);

  constructor(private readonly proactiveService: CoachProactiveService) {}

  @OnEvent('training.gear.replace_soon', { async: true })
  async handleGearReplaceSoon(event: GearReplaceSoonEvent): Promise<void> {
    const distance = Math.round(event.distanceKm);
    await this.safely({
      userId: event.userId,
      athleteId: event.athleteId,
      kind: 'gear_replace_soon',
      content:
        `${event.gearName || 'Ваши кроссовки'} уже пробежали ${distance} км из ${event.limitKm}. ` +
        'Пора присмотреть новую пару: изношенная амортизация повышает риск травм.',
      params: { gearId: event.gearId, gearName: event.gearName, distanceKm: distance, limitKm: event.limitKm },
    });
  }

  @OnEvent('training.plan.adaptation_proposed', { async: true })
  async handleAdaptationProposed(event: PlanAdaptationProposedEvent): Promise<void> {
    const what = ADAPTATION_ACTION_TEXT[event.action] ?? 'скорректировать план';
    const proposed = event.status === 'proposed';
    await this.safely({
      userId: event.userId,
      athleteId: event.athleteId,
      kind: proposed ? 'adaptation_proposed' : 'adaptation_suggested',
      content: proposed
        ? `Предлагаю ${what}. Подтвердите изменение в разделе «План» — без вашего «Да» план не поменяется.`
        : `Совет: стоит ${what}. План я не меняю — решите сами, нужно ли это.`,
      params: {
        adaptationId: event.adaptationId,
        planId: event.planId,
        action: event.action,
        changesCount: event.changesCount,
      },
    });
  }

  private async safely(message: ProactiveMessage): Promise<void> {
    try {
      await this.proactiveService.deliver(message);
    } catch (error) {
      this.logger.warn(
        `Proactive message ${message.kind} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
