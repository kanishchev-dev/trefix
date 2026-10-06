"use client";

import type { ReactElement } from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select";

export type SelectOption<TValue extends string> = {
  value: TValue;
  label: string;
};

/**
 * Single-value select over a flat option list. Wraps the shadcn select so
 * forms pass options once and get labels in the trigger for free.
 */
export function OptionSelect<TValue extends string>({
  id,
  value,
  options,
  onValueChange,
  disabled,
  invalid,
}: {
  id?: string;
  value: TValue;
  options: readonly SelectOption<TValue>[];
  onValueChange: (value: TValue) => void;
  disabled?: boolean;
  invalid?: boolean;
}): ReactElement {
  return (
    <Select
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next !== null) {
          onValueChange(next as TValue);
        }
      }}
    >
      <SelectTrigger
        id={id}
        className="w-full"
        aria-invalid={invalid || undefined}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
