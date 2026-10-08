import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';

import { EntityNotFoundException } from '@/common/exceptions/entity-not-found.exception';
import { UsersService } from '@/modules/users/users.service';

import { CreateManualPlanDto, PreviewManualPlanDto } from '../dto/create-manual-plan.dto';
import { AdminPlanActionEvent } from '../events/admin-plan-action.event';
import { TrainingService } from '../training.service';
import { ADMIN_PLAN_ACTION_EVENT, AdminPlansService } from './admin-plans.service';
import { PlanEditingService } from './plan-editing.service';
import { PlanLifecycleService } from './plan-lifecycle.service';
import { PlanListService } from './plan-list.service';
import { PlanRebuildService } from './plan-rebuild.service';

const USER_ID = '0199b0c4-0000-7000-8000-000000000001';
const ACTOR_ID = '0199b0c4-0000-7000-8000-000000000002';
const PLAN_ID = '0199b0c4-0000-7000-8000-0000000000aa';

describe('AdminPlansService', () => {
  let service: AdminPlansService;
  const usersService = { findOne: jest.fn() };
  const trainingService = { getCurrentMetrics: jest.fn(), previewManualPlan: jest.fn(), createManualPlan: jest.fn() };
  const listService = { list: jest.fn(), counts: jest.fn(), getDetails: jest.fn() };
  const editingService = {
    loadOwnedPlan: jest.fn(),
    loadAthleteByUserId: jest.fn(),
    updateMeta: jest.fn(),
    updateDraftStructure: jest.fn(),
    previewChanges: jest.fn(),
    applyChanges: jest.fn(),
    deletePlan: jest.fn(),
  };
  const lifecycleService = { startPlan: jest.fn(), cancelActivePlan: jest.fn(), getStartOptions: jest.fn() };
  const rebuildService = { prefill: jest.fn(), preview: jest.fn(), rebuild: jest.fn() };
  const eventEmitter = { emit: jest.fn() };

  const details = { id: PLAN_ID, status: 'draft' };

  beforeEach(async () => {
    jest.resetAllMocks();
    usersService.findOne.mockResolvedValue({ id: USER_ID });
    editingService.loadAthleteByUserId.mockResolvedValue({ id: 'athlete-1', userId: USER_ID });
    editingService.loadOwnedPlan.mockResolvedValue({ id: PLAN_ID });
    listService.getDetails.mockResolvedValue(details);

    const moduleRef = await Test.createTestingModule({
      providers: [
        AdminPlansService,
        { provide: UsersService, useValue: usersService },
        { provide: TrainingService, useValue: trainingService },
        { provide: PlanListService, useValue: listService },
        { provide: PlanEditingService, useValue: editingService },
        { provide: PlanLifecycleService, useValue: lifecycleService },
        { provide: PlanRebuildService, useValue: rebuildService },
        { provide: EventEmitter2, useValue: eventEmitter },
      ],
    }).compile();

    service = moduleRef.get(AdminPlansService);
  });

  const expectAudit = (action: string, planId = PLAN_ID): void =>
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      ADMIN_PLAN_ACTION_EVENT,
      new AdminPlanActionEvent(ACTOR_ID, USER_ID, planId, action as AdminPlanActionEvent['action']),
    );

  it('scopes reads to the target user', async () => {
    listService.list.mockResolvedValue({ items: [], meta: {} });

    await service.list(USER_ID, 'history', 2, 10);
    await service.getDetails(USER_ID, PLAN_ID);

    expect(listService.list).toHaveBeenCalledWith(USER_ID, 'history', 2, 10);
    expect(listService.getDetails).toHaveBeenCalledWith(PLAN_ID, USER_ID);
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('fails on a missing user before touching plans', async () => {
    usersService.findOne.mockRejectedValue(new EntityNotFoundException('User', USER_ID));

    await expect(service.counts(USER_ID)).rejects.toBeInstanceOf(EntityNotFoundException);
    expect(listService.counts).not.toHaveBeenCalled();
  });

  it('refuses creation for a user without an athlete profile instead of creating one', async () => {
    editingService.loadAthleteByUserId.mockResolvedValue(null);

    await expect(service.previewManualPlan(USER_ID, {} as PreviewManualPlanDto)).rejects.toMatchObject({
      code: 'ATHLETE_NOT_FOUND',
    });
    await expect(service.createManualPlan(ACTOR_ID, USER_ID, {} as CreateManualPlanDto)).rejects.toMatchObject({
      code: 'ATHLETE_NOT_FOUND',
    });
    expect(trainingService.previewManualPlan).not.toHaveBeenCalled();
    expect(trainingService.createManualPlan).not.toHaveBeenCalled();
  });

  it('creates a plan on behalf of the user and audits the actor', async () => {
    const dto = { name: 'Spring 10K' } as CreateManualPlanDto;
    trainingService.createManualPlan.mockResolvedValue({ id: PLAN_ID });

    const result = await service.createManualPlan(ACTOR_ID, USER_ID, dto);

    expect(trainingService.createManualPlan).toHaveBeenCalledWith(USER_ID, dto);
    expect(result).toBe(details);
    expectAudit('created');
  });

  it('checks ownership before starting a draft', async () => {
    const dto = { startDate: '2026-10-12', replaceActive: false };

    await service.start(ACTOR_ID, USER_ID, PLAN_ID, dto);

    expect(editingService.loadOwnedPlan).toHaveBeenCalledWith(PLAN_ID, USER_ID);
    expect(lifecycleService.startPlan).toHaveBeenCalledWith(PLAN_ID, dto);
    expectAudit('started');
  });

  it('does not start a plan of another user', async () => {
    editingService.loadOwnedPlan.mockRejectedValue(new Error('not found'));

    await expect(
      service.start(ACTOR_ID, USER_ID, PLAN_ID, { startDate: '2026-10-12', replaceActive: false }),
    ).rejects.toThrow('not found');
    expect(lifecycleService.startPlan).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('cancels with the admin reason', async () => {
    lifecycleService.cancelActivePlan.mockResolvedValue({ plan: { id: PLAN_ID }, cancelledWorkouts: 3 });

    const result = await service.cancel(ACTOR_ID, USER_ID, PLAN_ID, 'Europe/Moscow');

    expect(lifecycleService.cancelActivePlan).toHaveBeenCalledWith(PLAN_ID, 'admin', 'Europe/Moscow');
    expect(result.cancelledWorkouts).toBe(3);
    expectAudit('cancelled');
  });

  it('applies active plan changes and returns fresh details', async () => {
    const dto = { kind: 'goal_date', expectedVersion: 4, goalTargetDate: '2026-12-01' } as never;

    const result = await service.applyChanges(ACTOR_ID, USER_ID, PLAN_ID, dto);

    expect(editingService.applyChanges).toHaveBeenCalledWith(PLAN_ID, USER_ID, dto);
    expect(result).toBe(details);
    expectAudit('changes_applied');
  });

  it('audits the new plan produced by a rebuild', async () => {
    rebuildService.rebuild.mockResolvedValue({ id: 'new-plan' });
    listService.getDetails.mockResolvedValue({ id: 'new-plan' });

    await service.rebuild(ACTOR_ID, USER_ID, PLAN_ID, {} as never);

    expect(rebuildService.rebuild).toHaveBeenCalledWith(PLAN_ID, USER_ID, {});
    expect(listService.getDetails).toHaveBeenCalledWith('new-plan', USER_ID);
    expectAudit('rebuilt', 'new-plan');
  });

  it('does not audit a failed mutation', async () => {
    editingService.deletePlan.mockRejectedValue(new Error('PLAN_ACTIVE_CANNOT_DELETE'));

    await expect(service.delete(ACTOR_ID, USER_ID, PLAN_ID)).rejects.toThrow();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
