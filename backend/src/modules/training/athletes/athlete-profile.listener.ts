import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { HeartRateTargetsService } from '@/modules/training/adaptations/heart-rate-targets.service';
import { TRAINING_EVENTS } from '@/modules/training/training.events';

import { AthleteZonesChangedEvent } from '../events/athlete-zones-changed.event';
import { PlanMetricsEnteredEvent } from '../events/plan-metrics-entered.event';
import { AthleteProfileService } from './athlete-profile.service';

@Injectable()
export class AthleteProfileListener {
  private readonly logger = new Logger(AthleteProfileListener.name);

  constructor(
    private readonly profileService: AthleteProfileService,
    private readonly heartRateTargetsService: HeartRateTargetsService,
  ) {}

  /** New zones update heart-rate targets of the active plan, as the coach mode allows. */
  @OnEvent(TRAINING_EVENTS.ATHLETE_ZONES_CHANGED, { async: true })
  async handleZonesChanged(event: AthleteZonesChangedEvent): Promise<void> {
    try {
      await this.heartRateTargetsService.recalculateHeartRateTargets(event.athleteId);
    } catch (error) {
      this.logger.warn(`Heart-rate targets update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Metrics typed in the plan wizard become the profile values, so the next plan starts from them. */
  @OnEvent(TRAINING_EVENTS.PLAN_METRICS_ENTERED, { async: true })
  async handleMetricsEntered(event: PlanMetricsEnteredEvent): Promise<void> {
    try {
      await this.profileService.applyPlanInputMetrics(event.athleteId, event.metrics);
    } catch (error) {
      this.logger.warn(`Profile write-back failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
