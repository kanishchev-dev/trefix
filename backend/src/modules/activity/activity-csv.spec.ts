import { activityCsvHeader, activityCsvRows } from './activity-csv';
import type { ActivityItemDto } from './dto/activity-response.dto';

const item = (overrides: Partial<ActivityItemDto> = {}): ActivityItemDto => ({
  id: 'e-1',
  occurredAt: '2026-10-16T09:00:00.000Z',
  action: 'training.workout.updated',
  domain: 'workouts',
  actor: { type: 'admin', id: 'a-1', name: 'Viktor, K.' },
  subject: { id: 'u-1', name: 'Anna' },
  entity: { type: 'workout', id: 'w-1' },
  changes: { distanceKm: { from: 8, to: 9 } },
  metadata: {},
  source: 'admin',
  client: null,
  ip: null,
  ...overrides,
});

describe('activity CSV', () => {
  it('writes one quoted line per entry', () => {
    expect(activityCsvHeader().startsWith('occurredAt,actorType,actorName,action')).toBe(true);
    expect(activityCsvRows([item()])).toBe(
      '2026-10-16T09:00:00.000Z,admin,"Viktor, K.",training.workout.updated,workouts,Anna,workout,w-1,admin,' +
        '"{""distanceKm"":{""from"":8,""to"":9}}",\r\n',
    );
  });

  it('neutralises spreadsheet formulas', () => {
    expect(activityCsvRows([item({ subject: { id: 'u-1', name: '=HYPERLINK("x")' } })])).toContain(
      `"'=HYPERLINK(""x"")"`,
    );
  });
});
