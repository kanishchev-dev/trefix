import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { AdaptationsService } from '@/modules/training/adaptations/adaptations.service';
import { AthletesService } from '@/modules/training/athletes/athletes.service';
import { GoalsService } from '@/modules/training/goals/goals.service';
import { PlanEditingService } from '@/modules/training/plans/plan-editing.service';
import { PlanGenerationService } from '@/modules/training/plans/plan-generation.service';
import { PlanLifecycleService } from '@/modules/training/plans/plan-lifecycle.service';
import { PlanListService } from '@/modules/training/plans/plan-list.service';
import { PlanQueryService } from '@/modules/training/plans/plan-query.service';
import { PlanRebuildService } from '@/modules/training/plans/plan-rebuild.service';
import { PlanRegenerationService } from '@/modules/training/plans/plan-regeneration.service';
import { PlanStartOptionsService } from '@/modules/training/plans/plan-start-options.service';
import { PlansController } from '@/modules/training/plans/plans.controller';
import { TrainingController } from '@/modules/training/training.controller';
import { WorkoutsService } from '@/modules/training/workouts/workouts.service';

/**
 * Both controllers own routes under `/v1/plans`; the static plans routes
 * must win over any parameterised one, in the same order the module registers them.
 */
describe('Plans routing (e2e)', () => {
  let app: INestApplication;
  const planListService = {
    getActive: jest.fn().mockResolvedValue(null),
    counts: jest.fn().mockResolvedValue({ draft: 1, active: 0, history: 2 }),
    getDetails: jest.fn().mockResolvedValue({ id: 'plan-1' }),
  };
  const planQueryService = { getPlanOverview: jest.fn().mockResolvedValue({ plan: { id: 'plan-1' } }) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlansController, TrainingController],
      providers: [
        { provide: PlanListService, useValue: planListService },
        { provide: PlanEditingService, useValue: {} },
        { provide: PlanLifecycleService, useValue: {} },
        { provide: PlanStartOptionsService, useValue: {} },
        { provide: PlanRebuildService, useValue: {} },
        { provide: PlanQueryService, useValue: planQueryService },
        { provide: AthletesService, useValue: {} },
        { provide: GoalsService, useValue: {} },
        { provide: PlanGenerationService, useValue: {} },
        { provide: PlanRegenerationService, useValue: {} },
        { provide: WorkoutsService, useValue: {} },
        { provide: AdaptationsService, useValue: {} },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.use((req: { user?: unknown }, _res: unknown, next: () => void) => {
      req.user = { id: 'user-1' };
      next();
    });
    app.enableVersioning({ type: VersioningType.URI });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves /plans/active from the plans library', async () => {
    const response = await request(app.getHttpServer()).get('/v1/plans/active').expect(200);
    expect(response.body).toEqual({ plan: null });
    expect(planListService.getActive).toHaveBeenCalled();
  });

  it('serves /plans/counts and /plans/:id from the plans library', async () => {
    await request(app.getHttpServer()).get('/v1/plans/counts').expect(200, { draft: 1, active: 0, history: 2 });
    await request(app.getHttpServer()).get('/v1/plans/plan-1').expect(200, { id: 'plan-1' });
    expect(planListService.getDetails).toHaveBeenCalledWith('plan-1', 'user-1');
  });

  it('keeps the overview route of the training controller', async () => {
    await request(app.getHttpServer()).get('/v1/plans/current/overview').expect(200);
    expect(planQueryService.getPlanOverview).toHaveBeenCalledWith('current', 'user-1');
  });
});
