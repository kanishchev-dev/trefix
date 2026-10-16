import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import type { MainCopy } from "../../../locales";
import type { UnitSystem } from "../../../shared/lib/units";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
  SheetSectionLabel,
  SheetTabs,
} from "../../../shared/ui/bottom-sheet";
import { SheetList, SheetListRow } from "../../../shared/ui/sheet-list";
import { Switch } from "../../../shared/ui/switch";
import {
  DEFAULT_VOICE_REPORT,
  type VoiceInterval,
  type VoiceReport,
  type VoiceSettings,
} from "../voice/cues";

const INTERVALS: VoiceInterval[] = ["1u", "2u", "5min", "10min"];
const REPORT_KEYS: Array<keyof VoiceReport> = [
  "distance",
  "time",
  "splitPace",
  "avgPace",
  "planSteps",
];

type Props = {
  visible: boolean;
  settings: VoiceSettings;
  onChange: (settings: VoiceSettings) => void;
  onClose: () => void;
  units: UnitSystem;
  copy: MainCopy;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

/** Voice cues: on/off, how often, and what the regular report says. */
export function VoiceSheet({
  visible,
  settings,
  onChange,
  onClose,
  units,
  copy,
  theme,
  themeMode,
}: Props) {
  const t = copy.tracker;
  const s = t.voiceSheet;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (visible) setOpen(true);
  }, [visible]);

  const report = settings.report ?? DEFAULT_VOICE_REPORT;
  const intervalLabel = (value: VoiceInterval): string =>
    units === "imperial" && (value === "1u" || value === "2u")
      ? t.voiceIntervalsImperial[value]
      : t.voiceIntervals[value];
  const itemLabel = (key: keyof VoiceReport): string =>
    key === "splitPace" && units === "imperial"
      ? s.items.splitPaceImperial
      : s.items[key];

  return (
    <BottomSheet
      title={s.title}
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
      >
        <SheetBlock theme={theme}>
          <SheetList theme={theme}>
            <SheetListRow
              theme={theme}
              title={s.toggle}
              trailing={
                <Switch
                  value={settings.enabled}
                  onValueChange={(enabled) =>
                    onChange({ ...settings, enabled })
                  }
                  theme={theme}
                  accessibilityLabel={s.toggle}
                />
              }
            />
          </SheetList>
        </SheetBlock>

        {settings.enabled ? (
          <>
            <SheetBlock theme={theme}>
              <View style={styles.label}>
                <SheetSectionLabel text={s.howOften} theme={theme} />
              </View>
            </SheetBlock>
            <SheetBlock theme={theme}>
              <SheetTabs
                value={settings.interval}
                onChange={(interval) => onChange({ ...settings, interval })}
                trackColor={theme.color.screen}
                theme={theme}
                tabs={INTERVALS.map((key) => ({
                  key,
                  label: intervalLabel(key),
                }))}
              />
            </SheetBlock>
            <SheetBlock theme={theme}>
              <View style={styles.label}>
                <SheetSectionLabel text={s.what} theme={theme} />
              </View>
            </SheetBlock>
            <SheetBlock theme={theme}>
              <SheetList theme={theme}>
                {REPORT_KEYS.map((key, index) => (
                  <SheetListRow
                    key={key}
                    theme={theme}
                    divided={index > 0}
                    title={itemLabel(key)}
                    checked={report[key]}
                    onPress={() =>
                      onChange({
                        ...settings,
                        report: { ...report, [key]: !report[key] },
                      })
                    }
                  />
                ))}
              </SheetList>
            </SheetBlock>
            <SheetBlock theme={theme}>
              <Text
                style={[
                  styles.hint,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {s.hint}
              </Text>
            </SheetBlock>
          </>
        ) : null}

        <SheetBlock theme={theme}>
          <View style={styles.buttons}>
            <SheetButton
              label={t.done}
              onPress={() => setOpen(false)}
              theme={theme}
              themeMode={themeMode}
            />
          </View>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

/** "Every 1 km" for the setup row, "Off" when the voice is off. */
export function voiceSummary(
  settings: VoiceSettings,
  units: UnitSystem,
  copy: MainCopy,
): string {
  const t = copy.tracker;
  if (!settings.enabled) return t.voiceOff;
  const interval = settings.interval;
  return units === "imperial" && (interval === "1u" || interval === "2u")
    ? t.voiceEveryImperial[interval]
    : t.voiceEvery[interval];
}

const styles = StyleSheet.create({
  scroll: { width: "100%" },
  content: { gap: 14, paddingTop: 72, paddingBottom: 32 },
  label: { paddingHorizontal: 16, marginBottom: -6 },
  hint: { paddingHorizontal: 16, fontSize: 13, lineHeight: 18 },
  buttons: { gap: 8 },
});
