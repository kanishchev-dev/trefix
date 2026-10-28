import { StravaActivitySummary } from '../../interfaces/strava-api.interface';
import { StravaMapper } from './strava.mapper';

describe('StravaMapper', () => {
  const sampleRunActivity: StravaActivitySummary = {
    id: 12345678,
    athlete: { id: 98765 },
    name: 'Morning Run',
    distance: 10000, // 10 km
    moving_time: 3000, // 50 mins
    elapsed_time: 3100,
    total_elevation_gain: 120,
    type: 'Run',
    start_date: '2026-09-24T08:00:00Z',
    start_date_local: '2026-09-24T10:00:00',
    average_speed: 3.33,
    average_heartrate: 155,
    max_heartrate: 175,
    average_cadence: 84,
  };

  const sampleRideActivity: StravaActivitySummary = {
    id: 87654321,
    athlete: { id: 98765 },
    name: 'Morning Ride',
    distance: 25000,
    moving_time: 3600,
    elapsed_time: 3600,
    type: 'Ride',
    start_date: '2026-09-24T08:00:00Z',
    start_date_local: '2026-09-24T10:00:00',
  };

  it('imports runs, walks, hikes and strength sessions, not rides', () => {
    expect(StravaMapper.isSupportedActivity(sampleRunActivity)).toBe(true);
    expect(StravaMapper.isSupportedActivity({ ...sampleRunActivity, type: 'Walk' })).toBe(true);
    expect(StravaMapper.isSupportedActivity({ ...sampleRunActivity, type: 'Hike' })).toBe(true);
    expect(StravaMapper.isSupportedActivity({ ...sampleRunActivity, type: 'WeightTraining' })).toBe(true);
    expect(StravaMapper.isSupportedActivity(sampleRideActivity)).toBe(false);
  });

  it('maps walks, hikes and strength sessions to their own kinds', () => {
    expect(StravaMapper.toRunningActivity('a', { ...sampleRunActivity, type: 'Walk' }).type).toBe('walk');
    expect(StravaMapper.toRunningActivity('a', { ...sampleRunActivity, type: 'Hike' }).type).toBe('hike');
    expect(
      StravaMapper.toRunningActivity('a', { ...sampleRunActivity, type: 'WeightTraining', distance: 0 }).type,
    ).toBe('strength');
  });

  it('maps Strava activity summary to RunningActivity domain DTO', () => {
    const athleteId = 'athlete-uuid-123';
    const mapped = StravaMapper.toRunningActivity(athleteId, sampleRunActivity);

    expect(mapped.id).toEqual('strava:12345678');
    expect(mapped.athleteId).toEqual(athleteId);
    expect(mapped.source).toEqual('strava');
    expect(mapped.sourceActivityId).toEqual('12345678');
    expect(mapped.type).toEqual('run');
    expect(mapped.distanceMeters).toEqual(10000);
    expect(mapped.movingTimeSec).toEqual(3000);
    expect(mapped.averageHeartRate).toEqual(155);
    expect(mapped.elevationGainMeters).toEqual(120);
    expect(mapped.averagePaceSecPerKm).toEqual(300); // 300s/km = 5:00/km
  });

  it('derives the UTC offset from start_date_local', () => {
    expect(StravaMapper.toRunningActivity('a', sampleRunActivity).utcOffsetMinutes).toBe(120);
    expect(
      StravaMapper.utcOffsetMinutes({
        ...sampleRunActivity,
        start_date: '2026-09-24T22:30:00Z',
        start_date_local: '2026-09-25T01:30:00Z',
      }),
    ).toBe(180);
  });

  it('reports cadence in steps per minute', () => {
    expect(StravaMapper.toRunningActivity('a', sampleRunActivity).cadence).toBe(168);
  });
});
