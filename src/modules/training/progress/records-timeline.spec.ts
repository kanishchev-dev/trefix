import type { Effort } from './progress-calculations';
import { recordTimeline } from './records-timeline';

function effort(id: string, day: number, distanceM: number, timeSeconds: number, vdot: number | null = 40): Effort {
  return {
    id: `workout:${id}`,
    source: 'workout',
    kind: 'workout',
    provider: null,
    date: new Date(Date.UTC(2026, 0, day)),
    distanceM,
    timeSeconds,
    name: null,
    workoutId: id,
    resultId: null,
    vdot,
  };
}

describe('recordTimeline', () => {
  it('records the first result and every later improvement on a distance', () => {
    const timeline = recordTimeline([
      effort('a', 1, 5000, 1800),
      effort('b', 5, 5000, 1850),
      effort('c', 9, 5000, 1750),
    ]);

    const fiveK = timeline.filter((entry) => entry.distance === '5k');
    expect(fiveK.map((entry) => [entry.workoutId, entry.seconds, entry.previousSeconds])).toEqual([
      ['a', 1800, null],
      ['c', 1750, 1800],
    ]);
  });

  it('ignores efforts without a plausible pace', () => {
    expect(recordTimeline([effort('a', 1, 5000, 1800, null)])).toEqual([]);
  });

  it('counts one effort for every distance it covers', () => {
    const distances = recordTimeline([effort('a', 1, 10_200, 3000)]).map((entry) => entry.distance);
    expect(distances).toEqual(['10k']);
  });
});
