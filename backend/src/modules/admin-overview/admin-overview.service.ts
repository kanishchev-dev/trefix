import { Injectable } from '@nestjs/common';

import { AuthSessionService } from '@/modules/auth/services/auth-session.service';
import { IntegrationsService } from '@/modules/integrations/integrations.service';
import { AdaptationsService } from '@/modules/training/adaptations/adaptations.service';
import { addDaysToDateKey, toLocalDateKey } from '@/modules/training/admin-calendar-day.util';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { GearService } from '@/modules/training/gear/gear.service';
import type { TrainingPlanView, WorkoutView } from '@/modules/training/interfaces/training-views.interface';
import { PlanQueryService } from '@/modules/training/plans/plan-query.service';
import { WorkoutsService } from '@/modules/training/workouts/workouts.service';
import { UserPreferencesService } from '@/modules/users/preferences/user-preferences.service';
import { resolveUserStatus } from '@/modules/users/user-status';
import { UsersService } from '@/modules/users/users.service';

import {
  AdminOverviewResponseDto,
  OverviewActivePlanDto,
  OverviewAttentionDto,
  OverviewConnectionDto,
  OverviewWeekDto,
  OverviewWorkoutDto,
} from './admin-overview.dto';

/** How far back missed workouts count as a reason to look at the user. */
const MISSED_WINDOW_DAYS = 14;
const UPCOMING_LIMIT = 4;
const UPCOMING_WINDOW_DAYS = 14;
const RECENT_WORKOUTS_LIMIT = 30;
/** Integration states that need an administrator's attention. */
const INTEGRATION_PROBLEM_STATUSES: ReadonlySet<string> = new Set(['error', 'reauthorization_required']);
const DAY_MS = 24 * 60 * 60 * 1000;

const round1 = (value: number): number => Math.round(value * 10) / 10;

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Monday of the week that contains the date key (weeks start on Monday in the product). */
function mondayOf(dateKey: string): string {
  const weekday = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return addDaysToDateKey(dateKey, -((weekday + 6) % 7));
}

/**
 * The first screen of a user's card in the admin panel: what the user is
 * doing now and what may need an administrator. Read-only; every block is
 * built from the services the app itself uses.
 */
@Injectable()
export class AdminOverviewService {
  constructor(
    private readonly usersService: UsersService,
    private readonly athletesService: AthletesService,
    private readonly planQueryService: PlanQueryService,
    private readonly workoutsService: WorkoutsService,
    private readonly adaptationsService: AdaptationsService,
    private readonly gearService: GearService,
    private readonly integrationsService: IntegrationsService,
    private readonly preferencesService: UserPreferencesService,
    private readonly authSessionService: AuthSessionService,
  ) {}

  async getOverview(userId: string, timezone = 'UTC', now = new Date()): Promise<AdminOverviewResponseDto> {
    const user = await this.usersService.findOne(userId);
    const [session, preferences, athlete] = await Promise.all([
      this.authSessionService.latestSession(userId),
      this.preferencesService.get(userId),
      this.athletesService.findByUserId(userId),
    ]);

    const base: AdminOverviewResponseDto = {
      status: resolveUserStatus(user, now),
      lastSession: session
        ? {
            lastActiveAt: session.lastActiveAt,
            platform: session.platform,
            appVersion: session.appVersion,
            deviceName: session.deviceName,
          }
        : null,
      hasAthlete: Boolean(athlete),
      activePlan: null,
      week: null,
      lastWorkout: null,
      upcomingWorkouts: [],
      attention: [],
      connections: [{ key: 'coach', status: preferences.coachEnabled ? 'enabled' : 'disabled' }],
    };
    if (!athlete) {
      return base;
    }

    // Athlete-keyed services create a missing profile; they are only called once it exists.
    const today = toLocalDateKey(now, timezone);
    const [plan, recent, window, adaptations, gear, integrations] = await Promise.all([
      this.planQueryService.getActivePlanForAthlete(athlete.id, userId),
      this.workoutsService.listRecentWorkoutsForAthlete(athlete.id, userId, RECENT_WORKOUTS_LIMIT),
      this.workoutsService.listWorkoutsForDateRange(
        userId,
        addDaysToDateKey(today, -MISSED_WINDOW_DAYS - 1),
        addDaysToDateKey(today, UPCOMING_WINDOW_DAYS + 1),
      ),
      this.adaptationsService.listPendingAdaptations(userId),
      this.gearService.list(userId, 'active'),
      this.integrationsService.listIntegrations(userId),
    ]);

    const dayOf = (workout: WorkoutView): string => toLocalDateKey(workout.scheduledAt, timezone);
    const lastCompleted = recent.find((workout) => workout.status === 'completed') ?? null;
    const upcoming = window
      .filter((workout) => workout.status === 'planned' && workout.scheduledAt.getTime() >= now.getTime())
      .slice(0, UPCOMING_LIMIT);
    const missedSince = addDaysToDateKey(today, -MISSED_WINDOW_DAYS);
    const missed = window.filter(
      (workout) => workout.status === 'skipped' && dayOf(workout) >= missedSince && dayOf(workout) <= today,
    );

    const attention: OverviewAttentionDto[] = [
      ...adaptations
        .filter((adaptation) => adaptation.status === 'proposed')
        .map((adaptation) => ({ code: 'adaptation_pending' as const, entityId: adaptation.id })),
      ...(missed.length > 0
        ? [{ code: 'missed_workouts' as const, count: missed.length, days: MISSED_WINDOW_DAYS }]
        : []),
      ...gear.items
        .filter((item) => item.replaceSoon)
        .map((item) => ({
          code: 'gear_replace_soon' as const,
          entityId: item.id,
          name: item.nickname || `${item.brand} ${item.model}`.trim(),
          distanceKm: round1(item.distanceKm),
          limitKm: item.limitKm ?? undefined,
        })),
      ...integrations.items
        .filter((item) => INTEGRATION_PROBLEM_STATUSES.has(item.status))
        .map((item) => ({ code: 'integration_error' as const, provider: item.provider, status: item.status })),
    ];

    const connections: OverviewConnectionDto[] = [
      ...integrations.items
        .filter((item) => item.available !== false)
        .map((item) => ({ key: item.provider, status: item.status })),
      ...base.connections,
    ];

    return {
      ...base,
      activePlan: plan ? this.toActivePlan(plan, now) : null,
      week: this.toWeek(window, mondayOf(today), dayOf),
      lastWorkout: lastCompleted ? this.toWorkout(lastCompleted) : null,
      upcomingWorkouts: upcoming.map((workout) => this.toWorkout(workout)),
      attention,
      connections,
    };
  }

  private toActivePlan(plan: TrainingPlanView, now: Date): OverviewActivePlanDto {
    const totalWeeks = plan.weeks.length;
    const elapsedDays = plan.startDate ? Math.floor((now.getTime() - Date.parse(plan.startDate)) / DAY_MS) : 0;
    return {
      id: plan.id,
      name: plan.name,
      currentWeek: Math.min(Math.max(Math.floor(elapsedDays / 7) + 1, 1), Math.max(totalWeeks, 1)),
      totalWeeks,
      endDate: plan.endDate,
    };
  }

  private toWeek(workouts: WorkoutView[], monday: string, dayOf: (workout: WorkoutView) => string): OverviewWeekDto {
    const sunday = addDaysToDateKey(monday, 6);
    const inWeek = workouts.filter((workout) => dayOf(workout) >= monday && dayOf(workout) <= sunday);
    const done = inWeek.filter((workout) => workout.status === 'completed');
    return {
      from: monday,
      plannedKm: round1(inWeek.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0)),
      doneKm: round1(done.reduce((sum, workout) => sum + (this.actualDistance(workout) ?? 0), 0)),
      plannedWorkouts: inWeek.length,
      doneWorkouts: done.length,
    };
  }

  private actualDistance(workout: WorkoutView): number | null {
    return numberOrNull(workout.actual?.['actualDistanceKm']);
  }

  private toWorkout(workout: WorkoutView): OverviewWorkoutDto {
    const title = workout.target?.['title'];
    return {
      id: workout.id,
      scheduledAt: workout.scheduledAt,
      completedAt: workout.completedAt,
      type: workout.type,
      sport: workout.sport,
      title: typeof title === 'string' ? title : null,
      status: workout.status,
      distanceKm: workout.distanceKm,
      actualDistanceKm: this.actualDistance(workout),
      actualPaceSecondsPerKm: numberOrNull(workout.actual?.['actualAveragePaceSecondsPerKm']),
    };
  }
}
