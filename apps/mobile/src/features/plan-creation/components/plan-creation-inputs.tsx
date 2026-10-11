import { Text, TextInput, View } from "react-native";
import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";
import { formatTargetTime } from "../plan-creation-types";
import { Ruler } from "@workspace/ui-native";
import { styles } from "./plan-creation-ui.styles";
import { FieldError, InputRowHeader } from "./plan-creation-field";

/** Ruler scale for a time value in seconds. */
export type TimeRulerRange = {
  min: number;
  max: number;
  step: number;
  majorEvery: number;
  labelEvery: number;
};

export const PACE_RANGE: TimeRulerRange = {
  min: 2 * 60 + 30,
  max: 15 * 60,
  step: 5,
  majorEvery: 60,
  labelEvery: 60,
};

/** Ruler over seconds, displayed as m:ss / h:mm:ss (finish time, pace). */
export function TimeRuler({
  seconds,
  onChange,
  range,
  unit,
  accessibilityLabel,
  theme,
  themeMode,
}: {
  seconds: number;
  onChange: (seconds: number) => void;
  range: TimeRulerRange;
  unit?: string;
  accessibilityLabel?: string;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
}) {
  return (
    <Ruler
      value={Math.max(range.min, Math.min(range.max, seconds))}
      onChange={onChange}
      min={range.min}
      max={range.max}
      step={range.step}
      majorEvery={range.majorEvery}
      labelEvery={range.labelEvery}
      formatValue={formatTargetTime}
      formatLabel={formatTargetTime}
      unit={unit}
      accessibilityLabel={accessibilityLabel}
      theme={theme}
      themeMode={themeMode}
    />
  );
}

export type FormInputRowProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  unit?: string;
  keyboardType?:
    | "default"
    | "numeric"
    | "decimal-pad"
    | "number-pad"
    | "numbers-and-punctuation";
  error?: string | null;
  badge?: string;
  theme: ThemeTokens;
};

export function FormInputRow({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  keyboardType = "numeric",
  error,
  badge,
  theme,
}: FormInputRowProps) {
  return (
    <View style={styles.inputRowBlock}>
      <InputRowHeader label={label} badge={badge} theme={theme} />

      <View style={styles.inputContainer}>
        <TextInput
          accessibilityLabel={label}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={theme.color.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          style={[
            styles.textInput,
            {
              backgroundColor: theme.color.surfaceElevated,
              borderColor: error ? theme.color.danger : theme.color.border,
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        />
        {unit ? (
          <Text
            style={[
              styles.unitSuffix,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {unit}
          </Text>
        ) : null}
      </View>

      {error ? <FieldError message={error} theme={theme} /> : null}
    </View>
  );
}

export type MultilineInputRowProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  badge?: string;
  theme: ThemeTokens;
};

export function MultilineInputRow({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  badge,
  theme,
}: MultilineInputRowProps) {
  return (
    <View style={styles.inputRowBlock}>
      <InputRowHeader label={label} badge={badge} theme={theme} />

      <TextInput
        accessibilityLabel={label}
        multiline
        numberOfLines={4}
        placeholder={placeholder}
        placeholderTextColor={theme.color.mutedForeground}
        textAlignVertical="top"
        value={value}
        onChangeText={onChangeText}
        style={[
          styles.multilineInput,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: error ? theme.color.danger : theme.color.border,
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      />

      {error ? <FieldError message={error} theme={theme} /> : null}
    </View>
  );
}
