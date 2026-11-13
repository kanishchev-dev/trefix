import { Provider } from '@nestjs/common';

import { AdaptationsService } from '../adaptations/adaptations.service';
import { AthletesService } from '../athletes/athletes.service';
import { GoalsService } from '../goals/goals.service';
import { PlanGenerationService } from '../plans/plan-generation.service';
import { PlanQueryService } from '../plans/plan-query.service';
import { WorkoutImportService } from '../workouts/workout-import.service';
import { WorkoutsService } from '../workouts/workouts.service';

/** Training services other modules depend on. */
export const TRAINING_PUBLIC_SERVICES = [
  AthletesService,
  GoalsService,
  PlanGenerationService,
  PlanQueryService,
  WorkoutsService,
  WorkoutImportService,
  AdaptationsService,
] as const;

/**
 * Test helper: provides one mock object under every public training service
 * token, so a spec can stub training methods without knowing which service
 * owns each of them.
 */
export function provideTrainingServicesMock(mock: object): Provider[] {
  return TRAINING_PUBLIC_SERVICES.map((token) => ({ provide: token, useValue: mock }));
}
