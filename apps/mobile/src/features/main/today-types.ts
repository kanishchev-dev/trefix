export type DayEventType = "workout" | "recovery" | "race" | "note" | "insight";

export type DayEventStatus = "planned" | "completed" | "missed" | "modified";

export type DayEvent = {
  id: string;
  type: DayEventType;
  status: DayEventStatus;
  title: string;
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
