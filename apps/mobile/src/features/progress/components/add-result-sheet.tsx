import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { type RecordDistance } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Compound, DateWheel, Ruler, Segmented } from "@workspace/ui-native";

import { trackEvent } from "../../../lib/analytics";
import {
  fillTemplate,
  formatShortDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import {
  displayToKm,
  formatPace,
  kmToDisplay,
} from "../../../shared/lib/units";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import { Chip, ChipScroller } from "../../../shared/ui/chip-scroller";
import { SectionTitle } from "../../../shared/ui/list-card";
import { useToast } from "../../../shared/ui/toast";
import {
  InlineError,
  SheetActionsColumn,
} from "../../plans/components/plans-ui";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { useProgressMutation } from "../hooks/use-progress-v2";
import { RECORD_DISTANCE_METERS } from "../lib/progress-format";

type Props = {
  visible: boolean;
  initialDistance?: RecordDistance | null;
  onClose: () => void;
  copy: MainCopy;
  language: AppLanguage;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

type DistanceChoice = RecordDistance | "other";
type Kind = "race" | "workout" | "test";

const DISTANCES: RecordDistance[] = [
  "1k",
  "5k",
  "10k",
  "half_marathon",
  "marathon",
];
const DEFAULT_TIME: Record<DistanceChoice, number> = {
  "1k": 300,
  "5k": 1500,
  "10k": 3000,
  half_marathon: 6600,
  marathon: 14400,
  other: 1800,
};
const pad = (value: number) => String(value).padStart(2, "0");
const todayIso = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** G3 — a race, test or workout result entered by hand. */
export function AddResultSheet({
  visible,
  initialDistance,
  onClose,
  copy,
  language,
  theme,
  themeMode,
}: Props) {
  const mutation = useProgressMutation();
  const format = useUnitFormat(copy, language);
  const { showToast } = useToast();
  const a = copy.progress.addResult;
  const [open, setOpen] = useState(false);
  const [distance, setDistance] = useState<DistanceChoice>("10k");
  const [otherKm, setOtherKm] = useState(3);
  const [seconds, setSeconds] = useState(DEFAULT_TIME["10k"]);
  const [kind, setKind] = useState<Kind>("race");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayIso());
  const [dateOpen, setDateOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const start = initialDistance ?? "10k";
    setOpen(true);
    setDistance(start);
    setSeconds(DEFAULT_TIME[start]);
    setKind("race");
    setName("");
    setDate(todayIso());
    setDateOpen(false);
    setError(null);
  }, [visible, initialDistance]);

  const distanceM =
    distance === "other"
      ? Math.round(otherKm * 1000)
      : RECORD_DISTANCE_METERS[distance];
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  const pace = seconds / (distanceM / 1000);
  const imperial = format.units === "imperial";

  const save = async () => {
    setError(null);
    if (date > todayIso()) {
      setError(copy.progress.errors.RESULT_INVALID);
      return;
    }
    try {
      await mutation.mutateAsync({
        kind: "add",
        input: {
          distanceM: Math.round(distanceM),
          timeSeconds: seconds,
          date,
          kind,
          name: name.trim() || undefined,
        },
      });
      trackEvent("progress_result_added", { distance, kind });
      showToast(a.saved);
      setOpen(false);
    } catch (saveError) {
      const code = (saveError as { code?: string } | null)?.code;
      setError(
        code === "RESULT_INVALID"
          ? copy.progress.errors.RESULT_INVALID
          : copy.progress.errors.generic,
      );
    }
  };

  const text = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };

  return (
    <BottomSheet
      title={a.title}
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
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SheetBlock theme={theme}>
          <View style={styles.field}>
            <SectionTitle text={a.distance} theme={theme} />
            <ChipScroller inset={20}>
              {[...DISTANCES, "other" as const].map((choice) => (
                <Chip
                  key={choice}
                  theme={theme}
                  label={
                    choice === "other"
                      ? a.other
                      : copy.progress.records.distances[choice]
                  }
                  selected={distance === choice}
                  onPress={() => {
                    setDistance(choice);
                    setSeconds(DEFAULT_TIME[choice]);
                  }}
                />
              ))}
            </ChipScroller>
          </View>
        </SheetBlock>

        {distance === "other" ? (
          <SheetBlock theme={theme} edgeToEdge>
            <Ruler
              value={Math.round(kmToDisplay(otherKm, format.units) * 10) / 10}
              onChange={(value) =>
                setOtherKm(
                  Math.max(
                    0.4,
                    Math.round(displayToKm(value, format.units) * 100) / 100,
                  ),
                )
              }
              min={imperial ? 0.3 : 0.4}
              max={imperial ? 62 : 100}
              step={0.1}
              majorEvery={1}
              labelEvery={5}
              unit={imperial ? format.labels.mi : format.labels.km}
              accessibilityLabel={a.distance}
              theme={theme}
              themeMode={themeMode}
            />
          </SheetBlock>
        ) : null}

        <SheetBlock theme={theme}>
          <View style={styles.field}>
            <SectionTitle text={a.time} theme={theme} />
            <Compound
              parts={[
                { label: a.hours, value: hours, min: 0, max: 23 },
                {
                  label: a.minutes,
                  value: minutes,
                  min: 0,
                  max: 59,
                  formatValue: pad,
                },
                {
                  label: a.seconds,
                  value: secs,
                  min: 0,
                  max: 59,
                  formatValue: pad,
                },
              ]}
              separator=":"
              onChangePart={(index, value) => {
                const next = [hours, minutes, secs];
                next[index] = value;
                setSeconds(
                  Math.max(60, next[0] * 3600 + next[1] * 60 + next[2]),
                );
              }}
              accessibilityLabel={a.time}
              theme={theme}
              themeMode={themeMode}
            />
            <Text style={[styles.centered, muted]}>
              {fillTemplate(a.pace, {
                pace: formatPace(pace, format.units, format.labels),
              })}
            </Text>
          </View>
        </SheetBlock>

        <SheetBlock theme={theme}>
          <View style={styles.field}>
            <SectionTitle text={a.where} theme={theme} />
            <Segmented
              segments={(["race", "workout", "test"] as const).map((value) => ({
                value,
                label: a.kinds[value],
              }))}
              value={kind}
              onChange={setKind}
              theme={theme}
              themeMode={themeMode}
            />
            <View
              style={[styles.input, { backgroundColor: theme.color.control }]}
            >
              <Text style={[styles.inputLabel, muted]}>{a.name}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                maxLength={120}
                placeholder={a.namePlaceholder}
                placeholderTextColor={theme.color.mutedForeground}
                style={[styles.inputValue, text]}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => setDateOpen((value) => !value)}
              style={[styles.input, { backgroundColor: theme.color.control }]}
            >
              <Text style={[styles.inputLabel, muted]}>{a.date}</Text>
              <Text style={[styles.inputValue, text]}>
                {formatShortDate(date, language)}
              </Text>
            </Pressable>
            {dateOpen ? (
              <DateWheel
                value={date}
                onChange={setDate}
                minDate="2000-01-01"
                monthNames={copy.plan.creation.datePicker.months}
                accessibilityLabel={a.date}
                theme={theme}
                themeMode={themeMode}
              />
            ) : null}
          </View>
        </SheetBlock>

        {error ? (
          <SheetBlock theme={theme}>
            <InlineError message={error} theme={theme} />
          </SheetBlock>
        ) : null}

        <SheetBlock theme={theme}>
          <Text style={[styles.centered, muted]}>{a.note}</Text>
        </SheetBlock>

        <SheetBlock theme={theme}>
          <SheetActionsColumn>
            <SheetButton
              label={a.save}
              pending={mutation.isPending}
              onPress={() => void save()}
              theme={theme}
              themeMode={themeMode}
            />
            <SheetButton
              label={a.cancel}
              variant="secondary"
              onPress={() => setOpen(false)}
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
    gap: 18,
    paddingTop: 72,
    paddingBottom: 32,
  },
  field: {
    gap: 10,
  },
  centered: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  inputLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  inputValue: {
    flex: 1,
    textAlign: "right",
    fontSize: 15,
    lineHeight: 20,
  },
});
