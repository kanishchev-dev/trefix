import { WorkoutSport, WorkoutStatus, WorkoutType } from '../training.constants';

/** Admin projection of a workout row. */
export interface AdminWorkoutView {
  id: string;
  athleteId: string;
  planId: string | null;
  scheduledAt: Date;
  type: WorkoutType;
  sport: WorkoutSport;
  phase: string;
  status: WorkoutStatus;
  durationMinutes: number;
  distanceKm: number;
  title: string | null;
  source: string | null;
  hasActual: boolean;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Workouts of one local calendar day. */
export interface AdminCalendarDayView {
  date: string;
  timezone: string;
  workouts: AdminWorkoutView[];
  total: number;
  hasAthleteProfile: boolean;
}

export interface AdminCalendarSummaryDay {
  date: string;
  total: number;
  statuses: Record<WorkoutStatus, number>;
}

/** Busy days of a local date range. */
export interface AdminCalendarSummaryView {
  from: string;
  to: string;
  timezone: string;
  days: AdminCalendarSummaryDay[];
}

/** Response wrapper of create/update mutations. */
export interface AdminWorkoutMutationView {
  workout: AdminWorkoutView;
}
