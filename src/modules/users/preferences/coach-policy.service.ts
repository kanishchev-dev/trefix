import { Injectable } from '@nestjs/common';

import { ForbiddenActionException } from '@/common/exceptions/domain-exceptions';

import {
  type CoachAdaptationMode,
  type CoachProactiveTopic,
  type CoachTone,
  type QuietHours,
} from '../users.constants';
import { UserPreferencesService } from './user-preferences.service';

/**
 * What happens to an automatic plan adaptation:
 * - `apply` — change the plan right away;
 * - `propose` — keep the change as a proposal until the user confirms it;
 * - `suggest` — leave the plan as is, the change is only a recommendation;
 * - `skip` — the coach is off, nothing is adapted automatically.
 */
export type AdaptationPolicy = 'apply' | 'propose' | 'suggest' | 'skip';

const MODE_TO_POLICY: Record<CoachAdaptationMode, AdaptationPolicy> = {
  auto: 'apply',
  confirm: 'propose',
  suggest: 'suggest',
};

/**
 * The single place that interprets the user's coach settings. Plan adaptation,
 * the chat and proactive messages ask it instead of reading preferences directly.
 */
@Injectable()
export class CoachPolicyService {
  constructor(private readonly preferencesService: UserPreferencesService) {}

  async isEnabled(userId: string): Promise<boolean> {
    return (await this.preferencesService.getEntity(userId)).coachEnabled;
  }

  /** Throws `COACH_DISABLED` when the user switched the coach off. */
  async assertEnabled(userId: string): Promise<void> {
    if (!(await this.isEnabled(userId))) {
      throw new ForbiddenActionException('COACH_DISABLED', 'The AI coach is turned off');
    }
  }

  /** Policy for adaptations the system starts on its own (e.g. after a completed workout). */
  async automaticAdaptationPolicy(userId: string): Promise<AdaptationPolicy> {
    const preferences = await this.preferencesService.getEntity(userId);
    if (!preferences.coachEnabled) {
      return 'skip';
    }
    return MODE_TO_POLICY[preferences.coachAdaptationMode] ?? 'propose';
  }

  async tone(userId: string): Promise<CoachTone> {
    return (await this.preferencesService.getEntity(userId)).coachTone;
  }

  /**
   * Whether a proactive message may be sent now. Replies to the user's own
   * messages are never restricted. Returns the moment quiet hours end otherwise.
   * Messages with a `topic` are dropped when the user switched that topic off;
   * messages without one (plan proposals, gear wear) only follow quiet hours.
   */
  async proactiveMessageWindow(
    userId: string,
    now = new Date(),
    topic: CoachProactiveTopic | null = null,
  ): Promise<{ allowed: boolean; resumeAt: Date | null }> {
    const preferences = await this.preferencesService.getEntity(userId);
    if (!preferences.coachEnabled) {
      return { allowed: false, resumeAt: null };
    }
    if (topic && !this.preferencesService.coachProactive(preferences)[topic]) {
      return { allowed: false, resumeAt: null };
    }
    const resumeAt = quietHoursEnd(preferences.coachQuietHours, preferences.timezone, now);
    return { allowed: resumeAt === null, resumeAt };
  }
}

/** Minutes since local midnight of `date` in `timezone`. */
function localMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value ?? 0);
  return hour * 60 + minute;
}

function parseMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function safeTimezone(timezone: string | null): string {
  if (!timezone) {
    return 'UTC';
  }
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: timezone });
    return timezone;
  } catch {
    return 'UTC';
  }
}

/**
 * If `now` falls into quiet hours, returns when they end; otherwise `null`.
 * Intervals may cross midnight (`22:00–08:00`).
 */
export function quietHoursEnd(quietHours: QuietHours | null, timezone: string | null, now: Date): Date | null {
  if (!quietHours) {
    return null;
  }
  const from = parseMinutes(quietHours.from);
  const to = parseMinutes(quietHours.to);
  if (from === to) {
    return null;
  }
  const current = localMinutes(now, safeTimezone(timezone));
  const inside = from < to ? current >= from && current < to : current >= from || current < to;
  if (!inside) {
    return null;
  }
  const minutesLeft = (to - current + 24 * 60) % (24 * 60);
  const resumeAt = new Date(now.getTime() + minutesLeft * 60_000);
  resumeAt.setSeconds(0, 0);
  return resumeAt;
}
