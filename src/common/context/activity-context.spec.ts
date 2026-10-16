import { requestContext } from '../middleware/correlation-id.middleware';
import { getActivityContext, runWithActivityContext, setActivityContext } from './activity-context';

describe('activity context', () => {
  it('is empty outside a request', () => {
    expect(getActivityContext()).toEqual({});
    setActivityContext({ actorUserId: 'ignored' });
    expect(getActivityContext()).toEqual({});
  });

  it('fills the current request context', () => {
    requestContext.run(new Map([['traceId', 't-1']]), () => {
      setActivityContext({ actorType: 'admin', actorUserId: 'admin-1', ip: undefined });

      expect(getActivityContext()).toEqual({ traceId: 't-1', actorType: 'admin', actorUserId: 'admin-1' });
    });
  });

  it('runs with another actor and keeps the trace id of the request', () => {
    requestContext.run(
      new Map([
        ['traceId', 't-1'],
        ['actorUserId', 'u-1'],
        ['actorType', 'user'],
      ]),
      () => {
        const inner = runWithActivityContext({ actorType: 'integration', provider: 'strava' }, () =>
          getActivityContext(),
        );

        expect(inner).toEqual({ traceId: 't-1', actorType: 'integration', provider: 'strava' });
        expect(getActivityContext().actorType).toBe('user');
      },
    );
  });

  it('issues a trace id for a job without a request', () => {
    const inner = runWithActivityContext({ actorType: 'system' }, () => getActivityContext());

    expect(inner.traceId).toEqual(expect.any(String));
  });
});
