import { Injectable } from '@nestjs/common';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { AthletesService } from '@/modules/training/athletes/athletes.service';

import { AthleteProfileService } from '../../training/athletes/athlete-profile.service';
import { ageFromBirthDate } from '../../training/athletes/profile-completeness';
import { ATHLETE_RANGES } from '../../training/training.constants';
import {
  PROFILE_METRIC_MAX_AGE_DAYS,
  RESTING_HR_MEDIAN_DAYS,
  RESTING_HR_MIN_DAYS,
} from '../constants/integrations.constants';
import { restingHeartRateMedian } from './device-activity.rules';
import { DeviceIntegrationLookup } from './device-integration-lookup.service';
import { DAY_MS, DeviceMetadata } from './device-integrations.shared';
import {
  DeviceProfileMetricsDto,
  DeviceProfileMetricsResultDto,
  ProfileMetricField,
  SkippedProfileMetricDto,
} from './dto/device-profile-metrics.dto';

/**
 * Weight, resting and max heart rate measured on the device, applied to the athlete profile when fresher than what it holds.
 */
@Injectable()
export class DeviceProfileMetricsService {
  constructor(
    private readonly athletesService: AthletesService,
    private readonly athleteProfileService: AthleteProfileService,
    private readonly lookup: DeviceIntegrationLookup,
  ) {}

  async applyProfileMetrics(
    userId: string,
    providerParam: string,
    dto: DeviceProfileMetricsDto,
  ): Promise<DeviceProfileMetricsResultDto> {
    const provider = this.lookup.resolveProvider(providerParam);
    const integration = await this.lookup.loadConnected(userId, provider);
    const applied: DeviceProfileMetricsResultDto['applied'] = [];
    const skipped: SkippedProfileMetricDto[] = [];
    const requested: ProfileMetricField[] = [
      ...(dto.weight ? (['weightKg'] as const) : []),
      ...(dto.height ? (['heightCm'] as const) : []),
      ...(dto.sex && dto.sex !== 'other' ? (['sex'] as const) : []),
      ...(dto.birthDate ? (['birthDate'] as const) : []),
      ...(dto.restingHeartRate?.length ? (['restingHeartRate'] as const) : []),
    ];

    if ((integration.metadata as DeviceMetadata).profileSync === false) {
      return { applied, skipped: requested.map((field) => ({ field, reason: 'profile_sync_off' })) };
    }
    const athlete = await this.athletesService.findById(integration.athleteId);
    if (!athlete) {
      throw new EntityNotFoundException('Athlete', integration.athleteId);
    }

    const minMeasuredAt = Date.now() - PROFILE_METRIC_MAX_AGE_DAYS * DAY_MS;
    const candidates: Array<{ field: ProfileMetricField; value: number | string; measuredAt?: Date }> = [];

    if (dto.weight) {
      const measuredAt = new Date(dto.weight.measuredAt);
      const value = Math.round(dto.weight.valueKg * 10) / 10;
      // An old weigh-in still fills an empty profile; it only cannot replace an existing value.
      const tooOld =
        measuredAt.getTime() < minMeasuredAt && athlete.weightKg !== null && athlete.weightKg !== undefined;
      if (tooOld || measuredAt.getTime() > Date.now() + DAY_MS) {
        skipped.push({ field: 'weightKg', reason: 'stale' });
      } else if (value < ATHLETE_RANGES.weightKg.min || value > ATHLETE_RANGES.weightKg.max) {
        skipped.push({ field: 'weightKg', reason: 'out_of_range' });
      } else {
        candidates.push({ field: 'weightKg', value, measuredAt });
      }
    }

    if (dto.height) {
      // Height is measured rarely, so an old sample is still valid; only a future date is rejected.
      const measuredAt = new Date(dto.height.measuredAt);
      const value = Math.round(dto.height.valueCm);
      if (measuredAt.getTime() > Date.now() + DAY_MS) {
        skipped.push({ field: 'heightCm', reason: 'stale' });
      } else if (value < ATHLETE_RANGES.heightCm.min || value > ATHLETE_RANGES.heightCm.max) {
        skipped.push({ field: 'heightCm', reason: 'out_of_range' });
      } else {
        candidates.push({ field: 'heightCm', value, measuredAt });
      }
    }

    // Characteristics have no measurement time: they fill the profile but never replace a manual value.
    if (dto.sex && dto.sex !== 'other') {
      candidates.push({ field: 'sex', value: dto.sex });
    }
    if (dto.birthDate) {
      const age = ageFromBirthDate(dto.birthDate, new Date().toISOString().slice(0, 10));
      if (age === null || age < ATHLETE_RANGES.ageYears.min || age > ATHLETE_RANGES.ageYears.max) {
        skipped.push({ field: 'birthDate', reason: 'out_of_range' });
      } else {
        candidates.push({ field: 'birthDate', value: dto.birthDate });
      }
    }

    if (dto.restingHeartRate?.length) {
      const recent = dto.restingHeartRate.filter((sample) => Date.parse(`${sample.date}T00:00:00Z`) >= minMeasuredAt);
      const median = restingHeartRateMedian(recent, RESTING_HR_MEDIAN_DAYS, RESTING_HR_MIN_DAYS);
      const range = ATHLETE_RANGES.restingHeartRate;
      if (!median) {
        skipped.push({ field: 'restingHeartRate', reason: 'insufficient_data' });
      } else if (median.bpm < range.min || median.bpm > range.max) {
        skipped.push({ field: 'restingHeartRate', reason: 'out_of_range' });
      } else {
        candidates.push({
          field: 'restingHeartRate',
          value: median.bpm,
          measuredAt: new Date(`${median.latestDate}T00:00:00Z`),
        });
      }
    }

    for (const candidate of candidates) {
      const stored = athlete.fieldSources?.[candidate.field];
      if (!candidate.measuredAt) {
        const current: unknown = athlete[candidate.field];
        if (current === candidate.value) continue;
        if (stored?.source === 'manual' && current !== null && current !== undefined) {
          skipped.push({ field: candidate.field, reason: 'manual_source' });
          continue;
        }
        await this.athleteProfileService.applySourcedValues(athlete.id, provider, {
          [candidate.field]: candidate.value,
        });
        applied.push(candidate.field);
        continue;
      }
      // A manual value stays until Health has a measurement taken after it was entered.
      if (stored?.updatedAt && Date.parse(stored.updatedAt) >= candidate.measuredAt.getTime()) {
        skipped.push({ field: candidate.field, reason: stored.source === 'manual' ? 'manual_source' : 'stale' });
        continue;
      }
      if (stored?.source === 'manual' && !stored.updatedAt) {
        skipped.push({ field: candidate.field, reason: 'manual_source' });
        continue;
      }
      await this.athleteProfileService.applySourcedValues(
        athlete.id,
        provider,
        { [candidate.field]: candidate.value },
        { [candidate.field]: candidate.measuredAt },
      );
      applied.push(candidate.field);
    }

    if (applied.length > 0) {
      integration.lastProfileSyncAt = new Date();
      await integration.save();
    }
    return { applied, skipped };
  }
}
