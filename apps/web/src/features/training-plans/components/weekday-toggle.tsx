"use client";

import type { ReactElement } from "react";

import {
  ToggleGroup,
  ToggleGroupItem,
} from "@trefix/ui/components/toggle-group";

import { useI18n } from "@/shared/i18n";

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** Monday-first multi-select of training days (0 = Monday), the API's day index. */
export function WeekdayToggle({
  value,
  onChange,
  disabled,
  invalid,
  id,
}: {
  value: readonly number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
  invalid?: boolean;
  id?: string;
}): ReactElement {
  const { t } = useI18n();

  return (
    <ToggleGroup
      id={id}
      multiple
      variant="outline"
      spacing={0}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      value={value.map(String)}
      onValueChange={(next: string[]) =>
        onChange(next.map(Number).sort((a, b) => a - b))
      }
    >
      {WEEKDAYS.map((day) => (
        <ToggleGroupItem
          key={day}
          value={String(day)}
          aria-label={t(`userPlans.weekdays.long.${day}`)}
        >
          {t(`userPlans.weekdays.short.${day}`)}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

/** Options for single-day pickers (e.g. the long run day). */
export function useWeekdayOptions(): Array<{ value: string; label: string }> {
  const { t } = useI18n();
  return WEEKDAYS.map((day) => ({
    value: String(day),
    label: t(`userPlans.weekdays.long.${day}`),
  }));
}
