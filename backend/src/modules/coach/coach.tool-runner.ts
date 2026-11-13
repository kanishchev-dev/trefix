import { Injectable } from '@nestjs/common';

import { AdaptationsService } from '@/modules/training/adaptations/adaptations.service';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { GoalsService } from '@/modules/training/goals/goals.service';
import { PlanQueryService } from '@/modules/training/plans/plan-query.service';
import type { AdaptationAction } from '@/modules/training/training.constants';
import { WorkoutsService } from '@/modules/training/workouts/workouts.service';

import { CoachToolExecutionResult, CoachToolRequest } from './coach.interfaces';

@Injectable()
export class CoachToolRunner {
  constructor(
    private readonly adaptationsService: AdaptationsService,
    private readonly athletesService: AthletesService,
    private readonly goalsService: GoalsService,
    private readonly planQueryService: PlanQueryService,
    private readonly workoutsService: WorkoutsService,
  ) {}

  async runTools(userId: string, athleteId: string, requests: CoachToolRequest[]): Promise<CoachToolExecutionResult[]> {
    const results: CoachToolExecutionResult[] = [];

    for (const request of requests) {
      switch (request.name) {
        case 'getAthleteState':
          results.push({
            name: request.name,
            input: request.arguments,
            output: {
              state: await this.athletesService.getAthleteState(athleteId, userId),
            },
          });
          break;
        case 'getCurrentPlan':
          // Only the plan in work is exposed to the coach.
          results.push({
            name: request.name,
            input: request.arguments,
            output: {
              plan: await this.planQueryService.getActivePlanForAthlete(athleteId, userId),
            },
          });
          break;
        case 'getRecentWorkouts':
          results.push({
            name: request.name,
            input: request.arguments,
            output: {
              recentWorkouts: await this.workoutsService.listRecentWorkoutsForAthlete(
                athleteId,
                userId,
                this.getRequestedLimit(request.arguments),
              ),
            },
          });
          break;
        case 'getGoal':
          results.push({
            name: request.name,
            input: request.arguments,
            output: {
              goal: await this.goalsService.getLatestGoalForAthlete(athleteId, userId),
            },
          });
          break;
        case 'getWorkout':
          results.push({
            name: request.name,
            input: request.arguments,
            output: await this.getWorkout(userId, request.arguments),
          });
          break;
        case 'analyzeWorkout':
          results.push({
            name: request.name,
            input: request.arguments,
            output: await this.analyzeWorkout(userId, request.arguments),
          });
          break;
        case 'moveWorkout':
          results.push({
            name: request.name,
            input: request.arguments,
            output: await this.adjustPlan(userId, athleteId, {
              ...request.arguments,
              forcedAction: 'MOVE',
            }),
          });
          break;
        case 'replaceWorkout':
          results.push({
            name: request.name,
            input: request.arguments,
            output: await this.adjustPlan(userId, athleteId, {
              ...request.arguments,
              forcedAction: 'REPLACE',
            }),
          });
          break;
        case 'adjustPlan':
          results.push({
            name: request.name,
            input: request.arguments,
            output: await this.adjustPlan(userId, athleteId, request.arguments),
          });
          break;
        default:
          results.push({
            name: request.name,
            input: request.arguments,
            output: {
              error: 'unsupported_tool',
              message: `Tool "${request.name}" is not supported.`,
            },
          });
          break;
      }
    }

    return results;
  }

  private async adjustPlan(
    userId: string,
    athleteId: string,
    args: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const planId = typeof args.planId === 'string' ? args.planId : null;
    if (!planId) {
      return {
        error: 'missing_plan',
        message: 'A planId is required to adjust a plan.',
      };
    }

    const adaptation = await this.adaptationsService.adaptPlan(userId, {
      planId,
      workoutId: typeof args.workoutId === 'string' ? args.workoutId : undefined,
      forcedAction: typeof args.forcedAction === 'string' ? (args.forcedAction as AdaptationAction) : undefined,
      reason: typeof args.reason === 'string' ? args.reason : undefined,
    });

    return {
      athleteId,
      adaptation,
    };
  }

  private async getWorkout(userId: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const workoutId = typeof args.workoutId === 'string' ? args.workoutId : null;
    if (!workoutId) {
      return {
        error: 'missing_workout',
        message: 'A workoutId is required to load a workout.',
      };
    }

    return {
      workout: await this.workoutsService.getWorkout(workoutId, userId),
    };
  }

  private async analyzeWorkout(userId: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const workoutId = typeof args.workoutId === 'string' ? args.workoutId : null;
    if (!workoutId) {
      return {
        error: 'missing_workout',
        message: 'A workoutId is required to analyze a workout.',
      };
    }

    const analysis = await this.workoutsService.analyzeWorkout(userId, {
      workoutId,
      actualDurationMinutes: Number(args.actualDurationMinutes),
      actualDistanceKm: Number(args.actualDistanceKm),
      actualAveragePaceSecondsPerKm:
        typeof args.actualAveragePaceSecondsPerKm === 'number' ? args.actualAveragePaceSecondsPerKm : undefined,
      actualAverageHeartRate: typeof args.actualAverageHeartRate === 'number' ? args.actualAverageHeartRate : undefined,
      rpe: typeof args.rpe === 'number' ? args.rpe : undefined,
      notes: typeof args.notes === 'string' ? args.notes : undefined,
    });

    return { analysis };
  }

  private getRequestedLimit(args: Record<string, unknown>): number {
    const limit = typeof args.limit === 'number' ? args.limit : 10;
    return Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 20) : 10;
  }
}
