import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";

import { SheetBlock } from "../../../shared/ui/bottom-sheet";
import { PLAN_WEEKDAY_ORDER } from "../plan-creation-types";
import { Plus } from "lucide-react-native";
import { styles } from "./plan-creation-ui.styles";
import { InputRowHeader } from "./plan-creation-field";
export { FieldError, InputRowHeader } from "./plan-creation-field";
export {
  PACE_RANGE,
  TimeRuler,
  FormInputRow,
  MultilineInputRow,
  type TimeRulerRange,
} from "./plan-creation-inputs";

type OptionChipProps = {
  label: string;
  selected: boolean;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
  onPress: () => void;
};

export function OptionChip({
  label,
  selected,
  theme,
  onPress,
}: OptionChipProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.color.primary : theme.color.control,
          borderColor: theme.color.controlBorder,
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
                backgroundColor: isSelected
                  ? theme.color.primary
                  : "transparent",
                borderColor: isSelected
                  ? theme.color.primary
                  : theme.color.border,
                opacity: disabled ? 0.3 : 1,
              },
              pressed && !disabled && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.dayLabel,
                {
                  color: isSelected
                    ? theme.color.primaryForeground
                    : theme.color.foreground,
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
          color: isDivider
            ? theme.color.mutedForeground
            : theme.color.foreground,
          fontFamily: isDivider
            ? theme.typography.fontFamily.sans.medium
            : theme.typography.fontFamily.sans.medium,
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
              <View
                style={[
                  styles.dividerLine,
                  { backgroundColor: theme.color.border },
                ]}
              />
              {titleText}
              <View
                style={[
                  styles.dividerLine,
                  { backgroundColor: theme.color.border },
                ]}
              />
            </View>
          ) : (
            titleText
          )}
          {description ? (
            <Text
              style={[
                styles.sectionDescription,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
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
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.semibold,
          },
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
      style={({ pressed }) => [
        styles.optionalRemove,
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.optionalRemoveText,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.medium,
          },
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
    <SectionBlock
      title={title}
      description={description}
      theme={theme}
      variant="divider"
    >
      {children}
      <RemoveLink label={removeLabel} onPress={onRemove} theme={theme} />
    </SectionBlock>
  );
}
