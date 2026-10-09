import { useEffect, useRef, useState, type ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { DateWheel, Ruler } from "@workspace/ui-native";

import { fillTemplate, type MainCopy } from "../../../locales";
import { BottomSheet, SheetBlock, SheetButton } from "../../../shared/ui/bottom-sheet";
import { ActionCard } from "../../../shared/ui/list-card";
import { InlineError, SheetActionsColumn } from "../../plans/components/plans-ui";
import { formatAgo, profileErrorMessage } from "../lib/profile-format";

type Provenance = {
  /** Where the current value came from. */
  source: "strava" | "manual" | null;
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
      options: Array<{ value: string; label: string; description?: string; icon?: ReactNode }>;
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
export function ProfileValueSheet({ config, onClose, copy, theme, themeMode }: Props) {
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
    if (current.kind === "number") return run(() => current.onSave(typeof draft === "number" ? draft : null));
    if (current.kind === "date") return run(() => current.onSave(typeof draft === "string" ? draft : null));
    return undefined;
  };
  const clear = () => {
    if (current.kind === "number") return run(() => current.onSave(null));
    if (current.kind === "date") return run(() => current.onSave(null));
    return undefined;
  };

  const muted = { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular };

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
        {current.kind === "number" ? (
          <SheetBlock theme={theme} edgeToEdge>
            <Ruler
              value={typeof draft === "number" ? draft : current.fallback}
              onChange={(value) => setDraft(value)}
              min={current.min}
              max={current.max}
              step={current.step ?? 1}
              unit={current.unit}
              majorEvery={current.majorEvery}
              labelEvery={current.labelEvery}
              formatValue={current.formatValue}
              accessibilityLabel={current.title}
              theme={theme}
              themeMode={themeMode}
            />
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
            <View style={styles.options}>
              {current.options.map((option) => (
                <ActionCard
                  key={option.value}
                  theme={theme}
                  title={option.label}
                  description={option.description}
                  icon={option.icon}
                  disabled={pending}
                  trailing={
                    option.value === current.value ? (
                      <Check color={theme.color.foreground} size={18} strokeWidth={2.4} />
                    ) : undefined
                  }
                  onPress={() => void run(() => current.onSave(option.value))}
                />
              ))}
            </View>
          </SheetBlock>
        ) : null}

        {current.hint ? (
          <SheetBlock theme={theme}>
            <Text style={[styles.centered, muted]}>{current.hint}</Text>
          </SheetBlock>
        ) : null}

        {current.provenance?.source === "strava" ? (
          <SheetBlock theme={theme}>
            <Text style={[styles.centered, muted]}>
              {fillTemplate(sheetCopy.fromStrava, { ago: formatAgo(current.provenance.updatedAt, copy) })}
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
            {current.provenance?.source === "manual" && current.provenance.canReset ? (
              <SheetButton
                label={sheetCopy.resetToStrava}
                variant="secondary"
                onPress={() => void run(current.provenance!.onReset)}
                disabled={pending}
                theme={theme}
                themeMode={themeMode}
              />
            ) : null}
            {current.kind !== "options" && current.clearable && current.value !== null ? (
              <SheetButton
                label={sheetCopy.clear}
                variant="secondary"
                onPress={() => void clear()}
                disabled={pending}
                theme={theme}
                themeMode={themeMode}
              />
            ) : null}
            <SheetButton
              label={sheetCopy.cancel}
              variant="secondary"
              onPress={() => setOpen(false)}
              disabled={pending}
              theme={theme}
              themeMode={themeMode}
            />
          </SheetActionsColumn>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: "100%",
  },
  content: {
    gap: 16,
    paddingTop: 72,
    paddingBottom: 32,
  },
  options: {
    gap: 8,
  },
  centered: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
});
