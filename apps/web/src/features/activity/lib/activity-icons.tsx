import {
  ActivityIcon,
  CalendarRangeIcon,
  EyeIcon,
  FootprintsIcon,
  HeartPulseIcon,
  PlugIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TrendingUpIcon,
  UserRoundIcon,
  type LucideIcon,
} from "lucide-react";

import type { ActivityItem } from "@trefix/api-client";

/** Icon of an activity section, shown next to every entry of the feed. */
export const ACTIVITY_DOMAIN_ICONS: Record<ActivityItem["domain"], LucideIcon> =
  {
    account: UserRoundIcon,
    access: ShieldCheckIcon,
    athlete: HeartPulseIcon,
    workouts: ActivityIcon,
    plans: CalendarRangeIcon,
    progress: TrendingUpIcon,
    gear: FootprintsIcon,
    integrations: PlugIcon,
    coach: SparklesIcon,
    preferences: SlidersHorizontalIcon,
    data_access: EyeIcon,
    settings: SettingsIcon,
  };
