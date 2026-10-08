"use client";

import type { ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

import {
  ATHLETE_GOAL_CATEGORIES,
  ATHLETE_GOAL_TYPES,
  GOAL_TYPE_CATEGORY,
  type AthleteGoalType,
} from "@workspace/api-client";

import { useI18n } from "@/shared/i18n";

/** Goal type picker grouped by category, like the goal selector in the app. */
export function GoalTypeSelect({
  id,
  value,
  onValueChange,
}: {
  id?: string;
  value: AthleteGoalType;
  onValueChange: (value: AthleteGoalType) => void;
}): ReactElement {
  const { t } = useI18n();
  const items = ATHLETE_GOAL_TYPES.map((type) => ({
    value: type,
    label: t(`userPlans.goal.types.${type}`),
  }));

  return (
    <Select
      items={items}
      value={value}
      onValueChange={(next) => {
        if (next !== null) onValueChange(next as AthleteGoalType);
      }}
    >
      <SelectTrigger id={id} className="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ATHLETE_GOAL_CATEGORIES.map((category) => (
          <SelectGroup key={category}>
            <SelectLabel>
              {t(`userPlans.goal.categories.${category}`)}
            </SelectLabel>
            {ATHLETE_GOAL_TYPES.filter(
              (type) => GOAL_TYPE_CATEGORY[type] === category,
            ).map((type) => (
              <SelectItem key={type} value={type}>
                {t(`userPlans.goal.types.${type}`)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
