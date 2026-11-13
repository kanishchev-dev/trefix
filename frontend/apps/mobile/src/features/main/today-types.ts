export type DayEventType = "workout" | "recovery" | "race" | "note" | "insight";

export type DayEventStatus = "planned" | "completed" | "missed" | "modified";

import { type WorkoutIntensity } from "./lib/workout-intensity";

export type { WorkoutIntensity };

export type DayEvent = {
  id: string;
  type: DayEventType;
  status: DayEventStatus;
  title: string;
  /** Localized workout type ("Лёгкая", "Интервалы"). */
  typeLabel?: string;
  /** Localized date ("18 сент") or "Сегодня". */
  dateLabel?: string;
  intensity?: WorkoutIntensity;
  startAt?: string;
  duration?: string;
  distance?: string;
  description?: string;
  metadata?: Record<string, unknown>;
};

export type Day = {
  date: string; // YYYY-MM-DD
  events: DayEvent[];
};

export type CalendarMode = "week" | "month";
