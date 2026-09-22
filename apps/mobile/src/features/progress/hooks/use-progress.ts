import { useCallback, useMemo, useState } from "react";
import type {
  ProgressCapability,
  ProgressDisplayState,
  ProgressMilestone,
  ProgressPeriod,
  ProgressSnapshot,
} from "../types/progress-types";

const MOCK_PROGRESS_ACTIVE: ProgressSnapshot = {
  period: {
    from: "2026-08-01",
    to: "2026-09-21",
    periodKey: "6M",
  },
  form: {
    fitness: 82,
    fatigue: 34,
    form: 48,
    status: "BUILDING",
    trend: "IMPROVING",
    change: 8,
    periodComparison: "compared with 6 weeks ago",
  },
  goal: {
    type: "RACE_TIME",
    title: "10K Race Goal",
    distance: "10k",
    target: "45:00",
    currentEstimate: "47:18",
    delta: "2:18",
    progress: 72,
    status: "ON_TRACK",
    targetDate: "2026-10-25",
  },
  capabilities: [
    {
      type: "ENDURANCE",
      name: "Endurance",
      value: 78,
      change: 12,
      trend: "UP",
      period: "6 weeks",
      description:
        "Your fatigue resistance on long runs has increased significantly due to steady weekly volume.",
      currentMetric: "Longest run: 18.4 km",
      previousMetric: "Previous longest: 14.2 km",
      trainingFactors: [
        "Consistent weekend long runs (14-18km)",
        "Aerobic base volume +15% vs previous phase",
      ],
    },
    {
      type: "SPEED",
      name: "Speed",
      value: 64,
      change: 7,
      trend: "UP",
      period: "6 weeks",
      description:
        "Neuromuscular power and stride turnover are improving steadily from strides and short intervals.",
      currentMetric: "1km max pace: 3:58/km",
      previousMetric: "Previous max pace: 4:12/km",
      trainingFactors: [
        "Post-run stride sessions 2x per week",
        "400m interval workouts",
      ],
    },
    {
      type: "THRESHOLD",
      name: "Threshold",
      value: 71,
      change: 9,
      trend: "UP",
      period: "6 weeks",
      description:
        "Your threshold pace has improved from 5:02/km to 4:47/km over the last 6 weeks. This improvement is reflected in your recent threshold workouts.",
      currentMetric: "4:47 /km",
      previousMetric: "5:02 /km",
      trainingFactors: [
        "Weekly tempo runs at 4:50/km",
        "Controlled cruise intervals with short rest",
      ],
    },
    {
      type: "RECOVERY",
      name: "Recovery",
      value: 82,
      change: 4,
      trend: "UP",
      period: "6 weeks",
      description:
        "Heart rate recovery post-workout is faster by 12 bpm at 2 minutes post-session.",
      currentMetric: "2-min HR drop: 38 bpm",
      previousMetric: "Previous drop: 26 bpm",
      trainingFactors: [
        "Dedicated easy recovery days at <135 bpm",
        "Improved sleep regularity",
      ],
    },
    {
      type: "CONSISTENCY",
      name: "Consistency",
      value: 87,
      change: 11,
      trend: "UP",
      period: "6 weeks",
      description:
        "You have completed 94% of scheduled sessions over the last 6 weeks without missing key quality sessions.",
      currentMetric: "4 sessions / week",
      previousMetric: "3 sessions / week",
      trainingFactors: [
        "Adherence to weekly training schedule",
        "No missed long runs in 6 weeks",
      ],
    },
  ],
  performance: [
    {
      metric: "pace",
      title: "Threshold Pace",
      currentValue: "4:47 /km",
      previousValue: "5:02 /km",
      comparableContext: "5:02/km → 4:47/km at similar HR (158 bpm)",
      changePercent: 5.2,
      unit: "min/km",
      dataPoints: [
        { date: "Aug 02", value: 5.08, label: "5:05/km" },
        { date: "Aug 16", value: 5.0, label: "5:00/km" },
        { date: "Aug 30", value: 4.92, label: "4:55/km" },
        { date: "Sep 10", value: 4.82, label: "4:49/km" },
        { date: "Sep 20", value: 4.78, label: "4:47/km" },
      ],
    },
    {
      metric: "distance",
      title: "Weekly Distance",
      currentValue: "48.5 km",
      previousValue: "38.2 km",
      comparableContext: "+10.3 km vs previous 4 weeks average",
      changePercent: 26.9,
      unit: "km",
      dataPoints: [
        { date: "Aug 02", value: 36.5, label: "36.5 km" },
        { date: "Aug 16", value: 40.2, label: "40.2 km" },
        { date: "Aug 30", value: 42.0, label: "42.0 km" },
        { date: "Sep 10", value: 46.8, label: "46.8 km" },
        { date: "Sep 20", value: 48.5, label: "48.5 km" },
      ],
    },
    {
      metric: "heartRate",
      title: "HR at Comparable Pace",
      currentValue: "148 bpm",
      previousValue: "156 bpm",
      comparableContext: "-8 bpm at steady 5:15/km pace",
      changePercent: -5.1,
      unit: "bpm",
      dataPoints: [
        { date: "Aug 02", value: 156, label: "156 bpm" },
        { date: "Aug 16", value: 154, label: "154 bpm" },
        { date: "Aug 30", value: 151, label: "151 bpm" },
        { date: "Sep 10", value: 149, label: "149 bpm" },
        { date: "Sep 20", value: 148, label: "148 bpm" },
      ],
    },
    {
      metric: "trainingLoad",
      title: "Weekly Training Load",
      currentValue: "420 TRIMP",
      previousValue: "340 TRIMP",
      comparableContext: "Optimal load progression (+23%)",
      changePercent: 23.5,
      unit: "TRIMP",
      dataPoints: [
        { date: "Aug 02", value: 330, label: "330" },
        { date: "Aug 16", value: 360, label: "360" },
        { date: "Aug 30", value: 380, label: "380" },
        { date: "Sep 10", value: 405, label: "405" },
        { date: "Sep 20", value: 420, label: "420" },
      ],
    },
    {
      metric: "elevation",
      title: "Elevation Gain",
      currentValue: "480 m",
      previousValue: "320 m",
      comparableContext: "+160 m elevation per week",
      changePercent: 50.0,
      unit: "m",
      dataPoints: [
        { date: "Aug 02", value: 290, label: "290 m" },
        { date: "Aug 16", value: 340, label: "340 m" },
        { date: "Aug 30", value: 390, label: "390 m" },
        { date: "Sep 10", value: 430, label: "430 m" },
        { date: "Sep 20", value: 480, label: "480 m" },
      ],
    },
  ],
  milestones: [
    {
      id: "m1",
      title: "NEW 10K BEST",
      value: "48:37",
      date: "September 18",
      previousBest: "50:12",
      change: "1:35",
      context: "Achieved during your BUILD phase during a structured tempo run.",
      category: "race",
    },
    {
      id: "m2",
      title: "LONGEST RUN",
      value: "18.4 km",
      date: "September 14",
      previousBest: "16.1 km",
      change: "+2.3 km",
      context: "Completed with strong energy finish in Zone 2.",
      category: "distance",
    },
    {
      id: "m3",
      title: "THRESHOLD IMPROVEMENT",
      value: "4:47/km",
      date: "September 10",
      previousBest: "5:02/km",
      change: "15 sec/km",
      context: "Validated over 3 consecutive threshold sessions.",
      category: "performance",
    },
    {
      id: "m4",
      title: "CONSISTENCY STREAK",
      value: "4 weeks",
      date: "September 07",
      previousBest: "2 weeks",
      change: "+2 weeks",
      context: "100% scheduled workouts completed without skipping key sessions.",
      category: "streak",
    },
    {
      id: "m5",
      title: "FIRST 20 KM WEEKEND",
      value: "20.1 km",
      date: "August 28",
      previousBest: "17.5 km",
      change: "+2.6 km",
      context: "Milestone distance reached across Saturday long run & Sunday recovery.",
      category: "milestone",
    },
  ],
  trainingImpact: {
    title: "TRAINING IMPACT",
    description:
      "Your threshold improved 9% over the last 6 weeks. The biggest contribution came from:",
    factors: [
      {
        name: "Threshold sessions",
        percentage: 45,
        description: "Weekly 20-30 min tempo intervals at controlled target pace.",
      },
      {
        name: "Long runs",
        percentage: 35,
        description: "Consistent progressive weekend long runs building stamina.",
      },
      {
        name: "Easy volume",
        percentage: 20,
        description: "Aerobic support runs keeping fatigue low and recovery high.",
      },
    ],
  },
};

export function useProgress() {
  const [period, setPeriod] = useState<ProgressPeriod>("6M");
  const [displayState, setDisplayState] =
    useState<ProgressDisplayState>("active");

  const data = useMemo<ProgressSnapshot | null>(() => {
    if (displayState === "loading" || displayState === "error" || displayState === "empty") {
      return null;
    }
    return MOCK_PROGRESS_ACTIVE;
  }, [displayState]);

  const switchDisplayState = useCallback((nextState: ProgressDisplayState) => {
    setDisplayState(nextState);
  }, []);

  const getAskTrefixPromptForCapability = useCallback(
    (capability: ProgressCapability) => {
      return `Explain my progress in ${capability.name || capability.type} over the last ${period}. What workouts influenced it most?`;
    },
    [period]
  );

  const getAskTrefixPromptForMilestone = useCallback(
    (milestone: ProgressMilestone) => {
      return `Explain my milestone "${milestone.title}" (${milestone.value} on ${milestone.date}). How does it affect my race target?`;
    },
    []
  );

  return {
    period,
    setPeriod,
    displayState,
    switchDisplayState,
    data,
    getAskTrefixPromptForCapability,
    getAskTrefixPromptForMilestone,
  };
}
