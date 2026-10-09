import { type AthleteProfile, type Gear, type UserPreferences } from "@workspace/api-client";

import { fillTemplate, pluralize, type AppLanguage, type MainCopy } from "../../../locales";
import {
  formatDistance,
  formatHeight,
  formatWeight,
  type UnitLabels,
  type UnitSystem,
} from "../../../shared/lib/units";

export const WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export type ProfileGroup = "body" | "heart" | "schedule" | "experience";

/** Which profile group a missing completeness field belongs to. */
const GROUP_OF_FIELD: Record<string, ProfileGroup> = {
  birthDate: "body",
  sex: "body",
  heightCm: "body",
  weightKg: "body",
  restingHeartRate: "heart",
  maxHeartRate: "heart",
  thresholdHeartRate: "heart",
  availableTrainingDays: "schedule",
  weeklyMileageKm: "schedule",
  limitations: "experience",
};

export function missingGroups(profile: AthleteProfile | null | undefined): Set<ProfileGroup> {
  const groups = new Set<ProfileGroup>();
  for (const field of profile?.completeness?.missing ?? []) {
    const group = GROUP_OF_FIELD[field];
    if (group) groups.add(group);
  }
  return groups;
}

export function localeOf(language: AppLanguage): string {
  return language === "ru" ? "ru-RU" : "en-US";
}

export type Formatter = {
  units: UnitSystem;
  labels: UnitLabels;
  locale: string;
  distance: (km: number, digits?: number) => string;
  weight: (kg: number) => string;
  height: (cm: number) => string;
  minutes: (minutes: number) => string;
};

export function createFormatter(copy: MainCopy, language: AppLanguage, preferences: UserPreferences): Formatter {
  const labels = copy.profile.unitLabels;
  const locale = localeOf(language);
  const units = preferences.units;
  return {
    units,
    labels,
    locale,
    distance: (km, digits = 1) => formatDistance(km, units, labels, locale, digits),
    weight: (kg) => formatWeight(kg, units, labels, locale),
    height: (cm) => formatHeight(cm, units, labels),
    minutes: (total) => {
      const hours = Math.floor(total / 60);
      const minutes = total % 60;
      if (hours === 0) return `${minutes} ${labels.min}`;
      return minutes === 0 ? `${hours} ${labels.h}` : `${hours} ${labels.h} ${minutes} ${labels.min}`;
    },
  };
}

/** Full years from an ISO date. */
export function ageFrom(birthDate: string | null | undefined, today = new Date()): number | null {
  if (!birthDate) return null;
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day)) age -= 1;
  return age;
}

/** Weekdays in display order for the chosen week start. */
export function orderedWeekdays(weekStart: UserPreferences["weekStart"]): Weekday[] {
  return weekStart === "sun" ? ["sunday", ...WEEKDAYS.slice(0, 6)] : [...WEEKDAYS];
}

export function weekdayShort(copy: MainCopy, day: string): string {
  const index = WEEKDAYS.indexOf(day as Weekday);
  return index >= 0 ? copy.profile.weekdays.short[index] : day;
}

export function weekdayFull(copy: MainCopy, day: string): string {
  const index = WEEKDAYS.indexOf(day as Weekday);
  return index >= 0 ? copy.profile.weekdays.full[index] : day;
}

/** "Бегает с 2021 · Средний" — parts that are missing are skipped. */
export function heroSubtitle(profile: AthleteProfile | null | undefined, copy: MainCopy): string | null {
  if (!profile) return null;
  const parts: string[] = [];
  if (profile.runningSinceYear) {
    parts.push(fillTemplate(copy.profile.summary.runningSince, { year: profile.runningSinceYear }));
  }
  const level = copy.profile.levels[profile.experienceLevel as keyof MainCopy["profile"]["levels"]];
  if (level) parts.push(level);
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function bodySummary(profile: AthleteProfile, copy: MainCopy, language: AppLanguage, format: Formatter): string {
  const parts: string[] = [];
  if (profile.heightCm) parts.push(format.height(profile.heightCm));
  if (profile.weightKg) parts.push(format.weight(profile.weightKg));
  const age = ageFrom(profile.birthDate) ?? profile.age;
  if (age) parts.push(pluralize(copy.profile.summary.years, age, language));
  return parts.length > 0 ? parts.join(" · ") : copy.profile.summary.notSet;
}

export function heartSummary(profile: AthleteProfile, copy: MainCopy): string {
  const parts: string[] = [];
  if (profile.restingHeartRate || profile.maxHeartRate) {
    parts.push(
      fillTemplate(copy.profile.summary.heart, {
        rest: profile.restingHeartRate ?? "—",
        max: profile.maxHeartRate ?? "—",
      }),
    );
  }
  if (profile.thresholdHeartRate) {
    parts.push(fillTemplate(copy.profile.summary.heartThreshold, { value: profile.thresholdHeartRate }));
  }
  return parts.length > 0 ? parts.join(" · ") : copy.profile.summary.notSet;
}

export function scheduleSummary(profile: AthleteProfile, copy: MainCopy, format: Formatter): string {
  const days = WEEKDAYS.filter((day) => profile.availableTrainingDays.includes(day)).map((day) => weekdayShort(copy, day));
  const parts: string[] = [];
  if (days.length > 0) parts.push(days.join(" "));
  if (profile.weeklyMileageKm) parts.push(fillTemplate(copy.profile.summary.volume, { value: format.distance(profile.weeklyMileageKm, 0) }));
  return parts.length > 0 ? parts.join(" · ") : copy.profile.summary.notSet;
}

export function experienceSummary(profile: AthleteProfile, copy: MainCopy, language: AppLanguage): string {
  const parts: string[] = [];
  const level = copy.profile.levels[profile.experienceLevel as keyof MainCopy["profile"]["levels"]];
  if (level) parts.push(level);
  if (profile.runningSinceYear) {
    const years = Math.max(0, new Date().getFullYear() - profile.runningSinceYear);
    if (years > 0) parts.push(pluralize(copy.profile.summary.years, years, language));
  }
  return parts.join(" · ") || copy.profile.summary.notSet;
}

export function gearName(gear: Gear): string {
  return `${gear.brand} ${gear.model}`.trim();
}

/** The most worn active pair, shown on the profile row. */
export function mostWorn(gear: Gear[] | undefined): Gear | null {
  if (!gear || gear.length === 0) return null;
  return [...gear].sort((left, right) => right.wearPercent - left.wearPercent)[0];
}

/** "3 дня назад" from an ISO timestamp. */
export function formatAgo(iso: string | null | undefined, copy: MainCopy): string {
  if (!iso) return "";
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
  if (minutes < 1) return copy.profile.ago.justNow;
  if (minutes < 60) return fillTemplate(copy.profile.ago.minutes, { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return fillTemplate(copy.profile.ago.hours, { count: hours });
  return fillTemplate(copy.profile.ago.days, { count: Math.round(hours / 24) });
}

/** Maps an API error to a localized message for inline display. */
export function profileErrorMessage(error: unknown, copy: MainCopy): string {
  const code = (error as { code?: string } | null)?.code;
  const errors = copy.profile.errors as Record<string, string>;
  return (code && errors[code]) || copy.profile.errors.generic;
}
