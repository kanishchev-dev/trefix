import { INestApplication, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';

import { PlanEditingService } from '@/modules/training/plans/plan-editing.service';
import { PlanLifecycleService } from '@/modules/training/plans/plan-lifecycle.service';
import { PlanListService } from '@/modules/training/plans/plan-list.service';
import { PlanRebuildService } from '@/modules/training/plans/plan-rebuild.service';
import { PlansController } from '@/modules/training/plans/plans.controller';
import { TrainingController } from '@/modules/training/training.controller';
import { TrainingService } from '@/modules/training/training.service';

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
  const trainingService = { getPlanOverview: jest.fn().mockResolvedValue({ plan: { id: 'plan-1' } }) };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [PlansController, TrainingController],
      providers: [
        { provide: PlanListService, useValue: planListService },
        { provide: PlanEditingService, useValue: {} },
        { provide: PlanLifecycleService, useValue: {} },
        { provide: PlanRebuildService, useValue: {} },
        { provide: TrainingService, useValue: trainingService },
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
    expect(trainingService.getPlanOverview).toHaveBeenCalledWith('current', 'user-1');
  });
});
