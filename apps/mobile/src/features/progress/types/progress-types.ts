import type {
  ProgressCapability,
  ProgressCapabilityType,
  ProgressForm,
  ProgressGoal,
  ProgressMilestone,
  ProgressPerformanceMetric,
  ProgressPerformanceMetricKey,
  ProgressPerformancePoint,
  ProgressPeriod,
  ProgressSnapshot,
  ProgressTrainingImpact,
} from "@workspace/api-client";

export type ProgressDisplayState =
  | "active"
  | "loading"
  | "empty"
  | "insufficient_data"
  | "error";

export type {
  ProgressCapability,
  ProgressCapabilityType,
  ProgressForm,
  ProgressGoal,
  ProgressMilestone,
  ProgressPerformanceMetric,
  ProgressPerformanceMetricKey,
  ProgressPerformancePoint,
  ProgressPeriod,
  ProgressSnapshot,
  ProgressTrainingImpact,
};
