import { useCallback, useState } from "react";
import { type PlanOverview } from "@workspace/api-client";

export type PlanDisplayState =
  | "active"
  | "not_started"
  | "completed"
  | "empty"
  | "loading"
  | "error";

const MOCK_ACTIVE_PLAN: PlanOverview = {
  plan: {
    id: "plan-10k-2026",
    name: "Autumn 10K Goal",
    goal: {
      title: "Autumn 10K Goal",
      distance: "10K",
      targetTime: "under 45 min",
      targetDate: "2026-10-18",
    },
    status: "active",
    currentWeek: 5,
    totalWeeks: 12,
    progress: 5 / 12,
    currentPhase: "BUILD",
    startDate: "2026-08-18",
  },
  currentWeekContext: {
    title: "Aerobic strength",
    description:
      "This week increases your training load gradually while maintaining recovery.",
    focusItems: [
      "One quality interval session (6x800m)",
      "Controlled aerobic volume increase (+2 km)",
      "Sunday progression long run (13 km)",
    ],
  },
  adaptations: [
    {
      id: "adapt-1",
      weekId: "week-5",
      weekNumber: 5,
      type: "HIGH_FATIGUE",
      title: "Recovery added",
      description:
        "An extra recovery day was added after elevated fatigue detected in Monday workout.",
      createdAt: "2026-09-19T10:00:00Z",
    },
    {
      id: "adapt-2",
      weekId: "week-4",
      weekNumber: 4,
      type: "SCHEDULE_CHANGE",
      title: "Workout moved",
      description: "Your quality session was moved to Thursday based on schedule adjustment.",
      createdAt: "2026-09-16T14:30:00Z",
    },
  ],
  weeks: [
    {
      id: "week-1",
      weekNumber: 1,
      phase: "BASE",
      title: "Building consistency",
      status: "completed",
      plannedWorkoutsCount: 4,
      plannedDistance: 28,
      plannedLoad: 180,
      summaryText: "4 workouts · 28 km",
      intent: "Establish steady running routine and comfortable easy effort aerobic base.",
      keySessions: ["Easy Run 6 km", "Long Easy Run 10 km"],
    },
    {
      id: "week-2",
      weekNumber: 2,
      phase: "BASE",
      title: "Building consistency",
      status: "completed",
      plannedWorkoutsCount: 4,
      plannedDistance: 29,
      plannedLoad: 195,
      summaryText: "4 workouts · 29 km",
      intent: "Maintain steady running habits with easy pace control.",
      keySessions: ["Easy Run 7 km", "Long Run 11 km"],
    },
    {
      id: "week-3",
      weekNumber: 3,
      phase: "BASE",
      title: "Volume progression",
      status: "completed",
      plannedWorkoutsCount: 4,
      plannedDistance: 30,
      plannedLoad: 210,
      summaryText: "4 workouts · 30 km",
      intent: "Gradual weekly volume increase and stride additions.",
      keySessions: ["Strides & Easy 6 km", "Long Run 12 km"],
    },
    {
      id: "week-4",
      weekNumber: 4,
      phase: "BUILD",
      title: "Increasing training load",
      status: "completed",
      plannedWorkoutsCount: 4,
      plannedDistance: 31,
      plannedLoad: 230,
      summaryText: "4 workouts · 31 km",
      intent: "Introduce aerobic strength tempo work and higher overall load.",
      keySessions: ["Tempo Run 7 km", "Long Run 12 km"],
    },
    {
      id: "week-5",
      weekNumber: 5,
      phase: "BUILD",
      title: "Aerobic strength",
      status: "current",
      plannedWorkoutsCount: 4,
      plannedDistance: 32,
      plannedLoad: 250,
      summaryText: "4 workouts · 32 km",
      intent: "Build aerobic strength while maintaining recovery between quality sessions.",
      keySessions: ["Intervals 6x800m", "Progression Long Run 13 km"],
    },
    {
      id: "week-6",
      weekNumber: 6,
      phase: "BUILD",
      title: "Increasing load",
      status: "upcoming",
      plannedWorkoutsCount: 4,
      plannedDistance: 34,
      plannedLoad: 270,
      summaryText: "4 workouts · 34 km",
      intent: "Peak build volume before transitioning to race-specific focus.",
      keySessions: ["Tempo Run 8 km", "Long Run 14 km"],
    },
    {
      id: "week-7",
      weekNumber: 7,
      phase: "BUILD",
      title: "Quality progression",
      status: "upcoming",
      plannedWorkoutsCount: 4,
      plannedDistance: 35,
      plannedLoad: 285,
      summaryText: "4 workouts · 35 km",
      intent: "Focus on lactate threshold pacing and fatigue resistance.",
      keySessions: ["Threshold Intervals 5x1km", "Long Run 15 km"],
    },
    {
      id: "week-8",
      weekNumber: 8,
      phase: "SPECIFIC",
      title: "Race-specific work",
      status: "upcoming",
      plannedWorkoutsCount: 4,
      plannedDistance: 33,
      plannedLoad: 270,
      summaryText: "4 workouts · 33 km",
      intent: "Develop 10K target pace efficiency and rhythm.",
      keySessions: ["10K Pace Intervals 4x1.5km", "Long Run 14 km"],
    },
    {
      id: "week-9",
      weekNumber: 9,
      phase: "SPECIFIC",
      title: "Race-specific work",
      status: "upcoming",
      plannedWorkoutsCount: 4,
      plannedDistance: 34,
      plannedLoad: 280,
      summaryText: "4 workouts · 34 km",
      intent: "Consolidate race pace feel and mental stamina.",
      keySessions: ["10K Pace Repeats 3x2km", "Long Run 14 km"],
    },
    {
      id: "week-10",
      weekNumber: 10,
      phase: "PEAK",
      title: "Peak preparation",
      status: "upcoming",
      plannedWorkoutsCount: 4,
      plannedDistance: 32,
      plannedLoad: 260,
      summaryText: "4 workouts · 32 km",
      intent: "Execute final key race simulation session before reducing volume.",
      keySessions: ["Race Simulation 5km fast", "Long Run 12 km"],
    },
    {
      id: "week-11",
      weekNumber: 11,
      phase: "TAPER",
      title: "Reducing load",
      status: "upcoming",
      plannedWorkoutsCount: 3,
      plannedDistance: 22,
      plannedLoad: 160,
      summaryText: "3 workouts · 22 km",
      intent: "Shed residual fatigue while preserving neural sharpness.",
      keySessions: ["Short Sharp Strides 5 km", "Easy Run 8 km"],
    },
    {
      id: "week-12",
      weekNumber: 12,
      phase: "RACE",
      title: "Race week",
      status: "upcoming",
      plannedWorkoutsCount: 3,
      plannedDistance: 16,
      plannedLoad: 120,
      summaryText: "3 workouts · 16 km",
      intent: "Rest, hydrate, carb load and execute 10K goal race.",
      keySessions: ["Pre-race Shakeout 3 km", "Race Day 10K Goal"],
    },
  ],
};

const MOCK_NOT_STARTED_PLAN: PlanOverview = {
  ...MOCK_ACTIVE_PLAN,
  plan: {
    ...MOCK_ACTIVE_PLAN.plan,
    status: "not_started",
    currentWeek: 0,
    progress: 0,
    startDate: "2026-09-28",
  },
  weeks: MOCK_ACTIVE_PLAN.weeks.map((w) => ({
    ...w,
    status: "upcoming" as const,
  })),
};

const MOCK_COMPLETED_PLAN: PlanOverview = {
  ...MOCK_ACTIVE_PLAN,
  plan: {
    ...MOCK_ACTIVE_PLAN.plan,
    status: "completed",
    currentWeek: 12,
    progress: 1,
    currentPhase: "RACE",
  },
  weeks: MOCK_ACTIVE_PLAN.weeks.map((w) => ({
    ...w,
    status: "completed" as const,
  })),
};

export function usePlanOverview() {
  const [displayState, setDisplayState] =
    useState<PlanDisplayState>("active");
  const [data, setData] = useState<PlanOverview | null>(MOCK_ACTIVE_PLAN);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const switchDisplayState = useCallback((nextState: PlanDisplayState) => {
    setDisplayState(nextState);
    if (nextState === "active") {
      setData(MOCK_ACTIVE_PLAN);
    } else if (nextState === "not_started") {
      setData(MOCK_NOT_STARTED_PLAN);
    } else if (nextState === "completed") {
      setData(MOCK_COMPLETED_PLAN);
    } else if (nextState === "empty") {
      setData(null);
    } else if (nextState === "loading") {
      setData(null);
    } else if (nextState === "error") {
      setData(null);
    }
  }, []);

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  }, []);

  return {
    displayState,
    data,
    isRefreshing,
    switchDisplayState,
    refresh,
  };
}
