import { type ReactNode } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";

import { SheetBlock } from "../../../shared/ui/bottom-sheet";
import { formatTargetTime, parseTargetTime, PLAN_WEEKDAY_ORDER } from "../plan-creation-types";
import { Ruler } from "@workspace/ui-native";
import { Plus } from "lucide-react-native";

type OptionChipProps = {
  label: string;
  selected: boolean;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
  onPress: () => void;
};

export function OptionChip({ label, selected, theme, themeMode, onPress }: OptionChipProps) {
  const isDark = themeMode === "dark" || theme.color.background === "#09090b";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? theme.color.primary
            : theme.color.control,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.08)"
            : theme.color.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          {
            color: selected
              ? theme.color.primaryForeground
              : theme.color.foreground,
            fontFamily: selected
              ? theme.typography.fontFamily.sans.bold
              : theme.typography.fontFamily.sans.medium,
          },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Row of equal round buttons — the one picker look used for weekdays and
 * small counts: outlined when free, filled when selected, faded when unavailable.
 */
export function CirclePicker<T extends string | number>({
  options,
  selected,
  onPress,
  theme,
}: {
  options: { value: T; label: string; disabled?: boolean }[];
  selected: T[];
  onPress: (value: T) => void;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.dayRow}>
      {options.map(({ value, label, disabled = false }) => {
        const isSelected = selected.includes(value);
        return (
          <Pressable
            key={String(value)}
            accessibilityRole="button"
            accessibilityState={{ selected: isSelected, disabled }}
            accessibilityLabel={label}
            disabled={disabled}
            hitSlop={4}
            onPress={() => onPress(value)}
            style={({ pressed }) => [
              styles.dayCell,
              {
                backgroundColor: isSelected ? theme.color.primary : "transparent",
                borderColor: isSelected ? theme.color.primary : theme.color.border,
                opacity: disabled ? 0.3 : 1,
              },
              pressed && !disabled && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.dayLabel,
                {
                  color: isSelected ? theme.color.primaryForeground : theme.color.foreground,
                  fontFamily: isSelected
                    ? theme.typography.fontFamily.sans.semibold
                    : theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type DayPickerProps = {
  selectedDays: number[];
  theme: ThemeTokens;
  themeMode?: ThemeMode;
  shortDayNames: readonly string[];
  onToggleDay: (dayIndex: number) => void;
  /** Days that cannot be picked (shown faded), e.g. rest days for the long run. */
  disabledDays?: number[];
};

/** Week row (Mon–Sun) built on CirclePicker. */
export function DayPicker({
  selectedDays,
  theme,
  shortDayNames,
  onToggleDay,
  disabledDays = [],
}: DayPickerProps) {
  return (
    <CirclePicker
      options={PLAN_WEEKDAY_ORDER.map((dayIndex) => ({
        value: dayIndex as number,
        label: shortDayNames[dayIndex],
        disabled: disabledDays.includes(dayIndex),
      }))}
      selected={selectedDays}
      onPress={onToggleDay}
      theme={theme}
    />
  );
}

type SectionBlockProps = {
  title: string;
  /** Optional explanation under the title: why the block exists / what happens if skipped. */
  description?: string;
  theme: ThemeTokens;
  /**
   * "title" — centred heading for a standalone block.
   * "divider" — quieter heading between hairlines, for grouping
   * (goal vs. current state) without competing with field labels.
   */
  variant?: "title" | "divider";
  children: ReactNode;
};

export function SectionBlock({
  title,
  description,
  theme,
  variant = "title",
  children,
}: SectionBlockProps) {
  const isDivider = variant === "divider";
  const titleText = (
    <Text
      style={[
        isDivider ? styles.dividerTitle : styles.sectionTitle,
        {
          color: isDivider ? theme.color.mutedForeground : theme.color.foreground,
          fontFamily: isDivider
            ? theme.typography.fontFamily.sans.medium
            : theme.typography.fontFamily.sans.semibold,
        },
      ]}
    >
      {title}
    </Text>
  );

  return (
    <SheetBlock theme={theme}>
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeader}>
          {isDivider ? (
            <View style={styles.dividerRow}>
              <View style={[styles.dividerLine, { backgroundColor: theme.color.border }]} />
              {titleText}
              <View style={[styles.dividerLine, { backgroundColor: theme.color.border }]} />
            </View>
          ) : (
            titleText
          )}
          {description ? (
            <Text
              style={[
                styles.sectionDescription,
                { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular },
              ]}
            >
              {description}
            </Text>
          ) : null}
        </View>
        {children}
      </View>
    </SheetBlock>
  );
}

export function FieldError({ message, theme }: { message: string; theme: ThemeTokens }) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        styles.fieldError,
        { fontFamily: theme.typography.fontFamily.sans.regular },
      ]}
    >
      {message}
    </Text>
  );
}


/** Centred field label with an optional short description in small muted text under it. */
function InputRowHeader({
  label,
  info,
  badge,
  theme,
}: {
  label: string;
  info?: string;
  badge?: string;
  theme: ThemeTokens;
}) {
  return (
    <View style={styles.fieldHeader}>
      <View style={styles.inputRowHeader}>
        <Text
          style={[
            styles.inputRowLabel,
            { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.semibold },
          ]}
        >
          {label}
        </Text>
        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.color.surfaceElevated }]}>
            <Text
              style={[
                styles.badgePillText,
                { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.medium },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>
      {info ? (
        <Text
          style={[
            styles.fieldInfo,
            { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular },
          ]}
        >
          {info}
        </Text>
      ) : null}
    </View>
  );
}

/** A field that is always part of the goal: label (+ info tooltip) and its control. */
export function FieldBlock({
  label,
  info,
  theme,
  children,
}: {
  label: string;
  info?: string;
  theme: ThemeTokens;
  children: ReactNode;
}) {
  return (
    <View style={styles.inputRowBlock}>
      <InputRowHeader label={label} info={info} theme={theme} />
      {children}
    </View>
  );
}

/** Centred "+ Add …" text link used to reveal optional fields and sections. */
export function AddLink({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.addLink, pressed && styles.pressed]}
    >
      <Plus size={16} color={theme.color.foreground} />
      <Text
        style={[
          styles.addLinkText,
          { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.semibold },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function RemoveLink({
  label,
  onPress,
  theme,
}: {
  label: string;
  onPress: () => void;
  theme: ThemeTokens;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.optionalRemove, pressed && styles.pressed]}
    >
      <Text
        style={[
          styles.optionalRemoveText,
          { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.medium },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Optional field inside a section. Hidden behind "+ Add …"; once added the
 * value is stored and the control shows with a "Remove" link. Nothing that
 * is not visible is ever sent.
 */
export function OptionalField({
  label,
  info,
  addLabel,
  removeLabel,
  isSet,
  onSet,
  onRemove,
  theme,
  children,
}: {
  label: string;
  info?: string;
  addLabel: string;
  removeLabel: string;
  isSet: boolean;
  onSet: () => void;
  onRemove: () => void;
  theme: ThemeTokens;
  children: ReactNode;
}) {
  if (!isSet) {
    return <AddLink label={addLabel} onPress={onSet} theme={theme} />;
  }

  return (
    <View style={styles.inputRowBlock}>
      <InputRowHeader label={label} info={info} theme={theme} />
      {children}
      <RemoveLink label={removeLabel} onPress={onRemove} theme={theme} />
    </View>
  );
}

/**
 * Optional section (e.g. current metrics, target date). Collapsed it is a
 * single "+ Add …" link; opened it becomes a regular divider section with
 * a "Remove …" link that clears everything it stored.
 */
export function OptionalSection({
  title,
  description,
  addLabel,
  removeLabel,
  isOpen,
  onOpen,
  onRemove,
  theme,
  children,
}: {
  title: string;
  description?: string;
  addLabel: string;
  removeLabel: string;
  isOpen: boolean;
  onOpen: () => void;
  onRemove: () => void;
  theme: ThemeTokens;
  children: ReactNode;
}) {
  if (!isOpen) {
    return (
      <SheetBlock theme={theme}>
        <AddLink label={addLabel} onPress={onOpen} theme={theme} />
      </SheetBlock>
    );
  }

  return (
    <SectionBlock title={title} description={description} theme={theme} variant="divider">
      {children}
      <RemoveLink label={removeLabel} onPress={onRemove} theme={theme} />
    </SectionBlock>
  );
}

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

type FormInputRowProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  unit?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation';
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
  keyboardType = 'numeric',
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
              borderColor: error ? '#dc2626' : theme.color.border,
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

type MultilineInputRowProps = {
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
            borderColor: error ? '#dc2626' : theme.color.border,
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      />

      {error ? <FieldError message={error} theme={theme} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRowBlock: {
    gap: 16,
  },
  inputRowHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  inputRowLabel: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    lineHeight: 14,
  },
  inputContainer: {
    position: "relative",
    justifyContent: "center",
  },
  textInput: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  unitSuffix: {
    position: "absolute",
    right: 16,
    fontSize: 13,
  },
  multilineInput: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 96,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayCell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    fontSize: 13,
    lineHeight: 17,
  },
  sectionBlock: {
    gap: 28,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  // Separator in the spirit of shadcn Marker (separator variant):
  // quiet centred label between hairlines; spacing does the grouping.
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerTitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldHeader: {
    gap: 2,
  },
  fieldInfo: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  addLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 6,
    paddingVertical: 8,
  },
  addLinkText: {
    fontSize: 15,
    lineHeight: 20,
  },
  optionalEmptyRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  optionalEmptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionalActionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionalRemove: {
    alignSelf: "center",
    paddingVertical: 2,
  },
  optionalRemoveText: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldError: {
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 4,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
});
