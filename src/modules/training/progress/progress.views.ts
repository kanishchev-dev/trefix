import {
  type HrZonesMethod,
  type ProgressMetric,
  type ProgressPeriodKey,
  type RaceResultKind,
  type RecordDistance,
} from '../training.constants';
import {
  type AccuracyLevel,
  type Achievement,
  type BucketSize,
  type CapabilityType,
  type DynamicsMetric,
  type DynamicsSeries,
  type Effort,
} from './progress-calculations';
import { type GoalProgress } from './progress-goal';

type Trend = 'up' | 'down' | 'stable';

export interface RecordBestView {
  seconds: number;
  date: string;
  source: Effort['source'];
  kind: Effort['kind'];
  provider: string | null;
  name: string | null;
  isNew: boolean;
  workoutId: string | null;
  resultId: string | null;
}

export interface RecordView {
  distance: RecordDistance;
  best: RecordBestView | null;
  predictionSeconds?: number | null;
}

export interface ProgressOverviewView {
  period: { key: ProgressPeriodKey; from: string; to: string };
  metricsUnlock: { required: number; completed: number; unlocked: boolean };
  goal: (GoalProgress & { planName: string | null }) | null;
  predictions: Array<{ distance: RecordDistance; seconds: number }>;
  predictionBasis: number;
  form: { fitness: number; fatigue: number; form: number; fitnessChange: number; changeWeeks: number } | null;
  metrics: {
    thresholdPace: { value: number; change: number | null } | null;
    vo2max: { value: number; change: number | null } | null;
    thresholdHeartRate: { value: number; estimated: boolean } | null;
  };
  capabilities: Array<{ type: CapabilityType; value: number | null; trend: Trend }> | null;
  records: RecordView[];
  dynamics: {
    bucket: BucketSize;
    metrics: Record<DynamicsMetric, DynamicsSeries>;
    profileVolumeHint: { profileKm: number; actualKm: number } | null;
  };
  achievements: Achievement[];
}

export interface ProgressMetricView {
  metric: ProgressMetric;
  value: number | null;
  change: number | null;
  updatedAt: Date | null;
  series: Array<{ date: string; value: number }>;
  accuracy: { level: AccuracyLevel; efforts: number };
  zones?: { method: HrZonesMethod; maxHeartRate: number | null; thresholdHeartRate: number | null };
  paces?: { easy: [number, number]; tempo: [number, number]; interval: [number, number] };
  topEfforts?: Array<{
    id: string;
    workoutId: string | null;
    resultId: string | null;
    title: string | null;
    workoutType: string | null;
    date: string;
    distanceKm: number;
    paceSecondsPerKm: number;
  }>;
}

export interface RecordAttemptView {
  id: string;
  source: Effort['source'];
  kind: Effort['kind'];
  provider: string | null;
  name: string | null;
  date: string;
  seconds: number;
  workoutId: string | null;
  resultId: string | null;
}

export interface RecordHistoryView {
  distance: RecordDistance;
  attempts: RecordAttemptView[];
}

export interface RaceResultView {
  id: string;
  distanceM: number;
  timeSeconds: number;
  date: string;
  kind: RaceResultKind;
  name: string | null;
}

export interface RecordsExclusionView {
  workoutId: string;
  excluded: boolean;
}
