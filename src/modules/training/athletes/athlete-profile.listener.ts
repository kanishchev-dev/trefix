import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { AthleteZonesChangedEvent } from '../events/athlete-zones-changed.event';
import { PlanMetricsEnteredEvent } from '../events/plan-metrics-entered.event';
import { TrainingService } from '../training.service';
import { AthleteProfileService } from './athlete-profile.service';

@Injectable()
export class AthleteProfileListener {
  private readonly logger = new Logger(AthleteProfileListener.name);

  constructor(
    private readonly profileService: AthleteProfileService,
    private readonly trainingService: TrainingService,
  ) {}

  /** New zones update heart-rate targets of the active plan, as the coach mode allows. */
  @OnEvent('training.athlete.zones_changed', { async: true })
  async handleZonesChanged(event: AthleteZonesChangedEvent): Promise<void> {
    try {
      await this.trainingService.recalculateHeartRateTargets(event.athleteId);
    } catch (error) {
      this.logger.warn(`Heart-rate targets update failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /** Metrics typed in the plan wizard become the profile values, so the next plan starts from them. */
  @OnEvent('training.plan.metrics_entered', { async: true })
  async handleMetricsEntered(event: PlanMetricsEnteredEvent): Promise<void> {
    try {
      await this.profileService.applyPlanInputMetrics(event.athleteId, event.metrics);
    } catch (error) {
      this.logger.warn(`Profile write-back failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}
