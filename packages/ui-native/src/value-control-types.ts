import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

export type ValueControlProps<T> = {
  value: T;
  onChange: (value: T) => void;
  min?: T;
  max?: T;
  step?: number;
  disabled?: boolean;
  formatValue?: (value: T) => string;
  formatLabel?: (value: T) => string;
  accessibilityLabel?: string;
  theme?: ThemeTokens;
  themeMode?: ThemeMode;
};
