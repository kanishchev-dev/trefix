"use client";

import type { ReactElement } from "react";
import { enUS, ru } from "react-day-picker/locale";

import { Calendar } from "@workspace/ui/components/calendar";

import type { Locale } from "@/shared/i18n";

const DAY_PICKER_LOCALES = { en: enUS, ru } as const;

/** Dot under a day that has workouts; inverted on the selected (primary) day. */
const BUSY_DAY_CLASS_NAME =
  "after:pointer-events-none after:absolute after:bottom-1.5 after:left-1/2 after:z-20 after:size-1 after:-translate-x-1/2 after:rounded-full after:bg-primary data-[selected=true]:after:bg-primary-foreground";

/**
 * Month picker of the training calendar: single-day selection, localized,
 * Monday-first, with a marker on every day that has workouts.
 */
export function WorkoutCalendar({
  locale,
  selected,
  onSelect,
  month,
  onMonthChange,
  busyDays,
}: {
  locale: Locale;
  selected: Date;
  onSelect: (day: Date) => void;
  month: Date;
  onMonthChange: (month: Date) => void;
  busyDays: readonly Date[];
}): ReactElement {
  return (
    <Calendar
      mode="single"
      required
      locale={DAY_PICKER_LOCALES[locale]}
      weekStartsOn={1}
      selected={selected}
      onSelect={onSelect}
      month={month}
      onMonthChange={onMonthChange}
      modifiers={{ busy: [...busyDays] }}
      modifiersClassNames={{ busy: BUSY_DAY_CLASS_NAME }}
      className="mx-auto [--cell-size:--spacing(10)]"
    />
  );
}
