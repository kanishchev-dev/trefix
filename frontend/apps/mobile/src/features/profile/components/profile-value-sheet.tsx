import { useEffect, useRef, useState, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { Compound, DateWheel, Wheel } from "@trefix/ui-native";

import { fillTemplate, type MainCopy } from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import {
  InlineError,
  SheetActionsColumn,
} from "../../plans/components/plans-ui";
import { formatAgo, profileErrorMessage } from "../lib/profile-format";

type Provenance = {
  /** Where the current value came from. */
  source: "strava" | "apple_health" | "health_connect" | "manual" | null;
  updatedAt?: string | null;
  /** The field can be handed back to Strava. */
  canReset: boolean;
  onReset: () => Promise<void>;
};

type Common = {
  title: string;
  provenance?: Provenance;
  /** Extra hint under the control. */
  hint?: string;
  /** Text above the control, e.g. what the value means. */
  description?: string;
};

/** "≈ 186 by age · Use" under a wheel: puts a computed value into the draft. */
type Suggestion = {
  text: string;
  actionLabel: string;
  value: number;
};

export type ValueSheetConfig =
  | (Common & {
      kind: "number";
      value: number | null;
      fallback: number;
      min: number;
      max: number;
      step?: number;
      unit?: string;
      majorEvery?: number;
      labelEvery?: number;
      formatValue?: (value: number) => string;
      clearable?: boolean;
      suggestion?: Suggestion;
      onSave: (value: number | null) => Promise<void>;
    })
  | (Common & {
      kind: "date";
      value: string | null;
      fallback: string;
      minDate?: string;
      clearable?: boolean;
      onSave: (value: string | null) => Promise<void>;
    })
  | (Common & {
      kind: "options";
      value: string | null;
      options: Array<{
        value: string;
        label: string;
        description?: string;
        icon?: ReactNode;
        disabled?: boolean;
        destructive?: boolean;
      }>;
      onSave: (value: string) => Promise<void>;
    });

type Props = {
  config: ValueSheetConfig | null;
  onClose: () => void;
  copy: MainCopy;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

/**
 * One sheet for every profile value: the right system control, the value's
 * source (Strava or manual) and Save / Cancel. Errors stay inline.
 */
export function ProfileValueSheet({
  config,
  onClose,
  copy,
  theme,
  themeMode,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number | string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const shown = useRef<ValueSheetConfig | null>(null);
  if (config) shown.current = config;
  const current = shown.current;
  const sheetCopy = copy.profile.valueSheet;

  useEffect(() => {
    if (!config) return;
    setOpen(true);
    setError(null);
    setPending(false);
    if (config.kind === "number") setDraft(config.value ?? config.fallback);
    else if (config.kind === "date") setDraft(config.value ?? config.fallback);
    else setDraft(config.value);
  }, [config]);

  const run = async (work: () => Promise<void>) => {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      await work();
      setOpen(false);
    } catch (saveError) {
      setError(profileErrorMessage(saveError, copy));
    } finally {
      setPending(false);
    }
  };

  if (!current) return null;

  const save = () => {
    if (current.kind === "number")
      return run(() =>
        current.onSave(typeof draft === "number" ? draft : null),
      );
    if (current.kind === "date")
      return run(() =>
        current.onSave(typeof draft === "string" ? draft : null),
      );
    return undefined;
  };
  const clear = () => {
    if (current.kind === "number") return run(() => current.onSave(null));
    if (current.kind === "date") return run(() => current.onSave(null));
    return undefined;
  };

  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };

  return (
    <BottomSheet
      title={current.title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {current.description ? (
          <SheetBlock theme={theme}>
            <Text style={[styles.description, muted]}>
              {current.description}
            </Text>
          </SheetBlock>
        ) : null}

        {current.kind === "number" ? (
          <SheetBlock theme={theme}>
            <NumberControl
              config={current}
              value={typeof draft === "number" ? draft : current.fallback}
              onChange={(value) => setDraft(value)}
              theme={theme}
              themeMode={themeMode}
            />
          </SheetBlock>
        ) : null}

        {current.kind === "number" && current.suggestion ? (
          <SheetBlock theme={theme}>
            <View style={styles.suggestion}>
              <Text numberOfLines={1} style={[styles.suggestionText, muted]}>
                {current.suggestion.text}
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setDraft(current.suggestion!.value)}
                style={({ pressed }) => [
                  styles.pill,
                  { backgroundColor: theme.color.iconSurface },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.pillText,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {current.suggestion.actionLabel}
                </Text>
              </Pressable>
            </View>
          </SheetBlock>
        ) : null}

        {current.kind === "date" ? (
          <SheetBlock theme={theme}>
            <DateWheel
              value={typeof draft === "string" ? draft : current.fallback}
              onChange={(value) => setDraft(value)}
              minDate={current.minDate}
              monthNames={copy.plan.creation.datePicker.months}
              accessibilityLabel={current.title}
              theme={theme}
              themeMode={themeMode}
            />
          </SheetBlock>
        ) : null}

        {current.kind === "options" ? (
          <SheetBlock theme={theme}>
            <SheetOptionList
              theme={theme}
              options={current.options}
              selected={current.value}
              disabled={pending}
              onSelect={(value) => void run(() => current.onSave(value))}
            />
          </SheetBlock>
        ) : null}

        {current.hint ? (
          <SheetBlock theme={theme}>
            <Text style={[styles.centered, muted]}>{current.hint}</Text>
          </SheetBlock>
        ) : null}

        {current.provenance?.source &&
        current.provenance.source !== "manual" ? (
          <SheetBlock theme={theme}>
            <Text style={[styles.centered, muted]}>
              {fillTemplate(
                current.provenance.source === "strava"
                  ? sheetCopy.fromStrava
                  : sheetCopy.fromHealth,
                {
                  ago: formatAgo(current.provenance.updatedAt, copy),
                },
              )}
              {"\n"}
              {sheetCopy.afterSave}
            </Text>
          </SheetBlock>
        ) : null}

        {error ? (
          <SheetBlock theme={theme}>
            <InlineError message={error} theme={theme} />
          </SheetBlock>
        ) : null}

        <SheetBlock theme={theme}>
          <SheetActionsColumn>
            {current.kind !== "options" ? (
              <SheetButton
                label={sheetCopy.save}
                onPress={() => void save()}
                pending={pending}
                theme={theme}
                themeMode={themeMode}
              />
            ) : null}
            {current.provenance?.source === "manual" &&
            current.provenance.canReset ? (
              <SheetButton
                label={sheetCopy.resetToStrava}
                variant="secondary"
                onPress={() => void run(current.provenance!.onReset)}
                disabled={pending}
                theme={theme}
                themeMode={themeMode}
              />
            ) : null}
            {current.kind !== "options" &&
            current.clearable &&
            current.value !== null ? (
              <SheetButton
                label={sheetCopy.clear}
                variant="secondary"
                onPress={() => void clear()}
                disabled={pending}
                theme={theme}
                themeMode={themeMode}
              />
            ) : null}
          </SheetActionsColumn>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

/** Wheels for whole numbers, an integer + tenths pair for decimals; the unit sits to the right. */
function NumberControl({
  config,
  value,
  onChange,
  theme,
  themeMode,
}: {
  config: Extract<ValueSheetConfig, { kind: "number" }>;
  value: number;
  onChange: (value: number) => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
}) {
  const step = config.step ?? 1;
  if (step < 1) {
    const whole = Math.floor(value);
    const tenths = Math.round((value - whole) * 10);
    return (
      <Compound
        parts={[
          {
            label: "",
            value: whole,
            min: Math.floor(config.min),
            max: Math.floor(config.max),
          },
          { label: "", value: tenths, min: 0, max: 9 },
        ]}
        onChangePart={(index, next) =>
          onChange(index === 0 ? next + tenths / 10 : whole + next / 10)
        }
        separator=","
        unit={config.unit}
        theme={theme}
        themeMode={themeMode}
        accessibilityLabel={config.title}
      />
    );
  }
  return (
    <View style={styles.wheelRow}>
      <View style={styles.wheel}>
        <Wheel
          value={value}
          onChange={onChange}
          min={config.min}
          max={config.max}
          step={step}
          formatValue={config.formatValue}
          accessibilityLabel={config.title}
          visibleItems={5}
          theme={theme}
          themeMode={themeMode}
        />
      </View>
      {config.unit ? (
        <Text
          style={[
            styles.unit,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {config.unit}
        </Text>
      ) : null}
    </View>
  );
}

/** Grouped radio list on the sheet: rows on the page colour, a check on the chosen one. */
export function SheetOptionList({
  theme,
  options,
  selected,
  disabled = false,
  onSelect,
}: {
  theme: ThemeTokens;
  options: Array<{
    value: string;
    label: string;
    description?: string;
    icon?: ReactNode;
    disabled?: boolean;
    destructive?: boolean;
  }>;
  selected: string | null;
  disabled?: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <View style={[styles.list, { backgroundColor: theme.color.screen }]}>
      {options.map((option, index) => {
        const color = option.destructive
          ? theme.color.danger
          : theme.color.foreground;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{
              checked: option.value === selected,
              disabled: disabled || option.disabled,
            }}
            disabled={disabled || option.disabled}
            onPress={() => onSelect(option.value)}
            style={({ pressed }) => [
              styles.listRow,
              index > 0 && {
                borderTopWidth: 1,
                borderTopColor: theme.color.sheet,
              },
              option.disabled && styles.listRowOff,
              pressed && styles.pressed,
            ]}
          >
            {option.icon}
            <View style={styles.listText}>
              <Text
                numberOfLines={1}
                style={[
                  styles.listTitle,
                  {
                    color,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {option.label}
              </Text>
              {option.description ? (
                <Text
                  numberOfLines={1}
                  style={[
                    styles.listDescription,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.regular,
                    },
                  ]}
                >
                  {option.description}
                </Text>
              ) : null}
            </View>
            {option.value === selected ? (
              <Check
                color={theme.color.foreground}
                size={18}
                strokeWidth={2.4}
              />
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  description: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  wheelRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  wheel: {
    flex: 1,
  },
  unit: {
    position: "absolute",
    right: 20,
    fontSize: 15,
    lineHeight: 22,
  },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 4,
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  pill: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.82,
  },
  list: {
    borderRadius: 20,
    overflow: "hidden",
  },
  listRow: {
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  listRowOff: {
    opacity: 0.35,
  },
  listText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  listTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  listDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  scroll: {
    width: "100%",
  },
  content: {
    gap: 16,
    paddingTop: 72,
    paddingBottom: 32,
  },
  centered: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
