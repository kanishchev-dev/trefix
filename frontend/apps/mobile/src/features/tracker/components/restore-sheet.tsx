import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { RotateCcw } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import {
  SheetBadge,
  SheetList,
  SheetListRow,
  SheetSubtitle,
} from "../../../shared/ui/sheet-list";
import { openTab, pushSubScreen } from "../../main/main-routes";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { formatClock, formatDistanceValue, formatPaceValue } from "../format";
import { useRecorder, useRestorePrompt } from "../hooks";
import { recorder } from "../recorder";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** The app closed during a run: continue it, finish it or delete it. */
export function RestoreSheet({ theme, themeMode, copy, language }: Props) {
  const t = copy.tracker;
  const [prompt, dismiss] = useRestorePrompt();
  const snapshot = useRecorder();
  const format = useUnitFormat(copy, language);
  const [open, setOpen] = useState(false);
  const after = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (prompt && snapshot) setOpen(true);
  }, [prompt, snapshot]);

  const state = recorder.getState();
  if (!snapshot || !state) return null;
  const { view } = snapshot;
  const units = format.units;
  const lastPause = state.pauses[state.pauses.length - 1];
  const closedAt = new Date(lastPause?.startedAt ?? state.clock);
  const time = `${String(closedAt.getHours()).padStart(2, "0")}:${String(closedAt.getMinutes()).padStart(2, "0")}`;
  const distanceUnit =
    units === "imperial" ? format.labels.mi : format.labels.km;
  const paceUnit =
    units === "imperial" ? format.labels.perMi : format.labels.perKm;

  const choose = (then: () => void) => {
    after.current = then;
    setOpen(false);
  };

  return (
    <BottomSheet
      title={t.restore.title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        dismiss();
        const then = after.current;
        after.current = null;
        then?.();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <SheetBlock theme={theme}>
          <SheetBadge theme={theme}>
            <RotateCcw
              size={26}
              color={theme.color.foreground}
              strokeWidth={1.9}
            />
          </SheetBadge>
        </SheetBlock>
        <SheetBlock theme={theme}>
          <SheetSubtitle
            text={fillTemplate(t.restore.body, { time })}
            theme={theme}
          />
        </SheetBlock>
        <SheetBlock theme={theme}>
          <SheetList theme={theme}>
            <SheetListRow
              theme={theme}
              title={t.metrics.distance}
              value={`${formatDistanceValue(view.distanceM, units, format.locale)} ${distanceUnit}`}
            />
            <SheetListRow
              theme={theme}
              divided
              title={t.metrics.time}
              value={formatClock(view.movingMs)}
            />
            <SheetListRow
              theme={theme}
              divided
              title={t.metrics.pace}
              value={`${formatPaceValue(view.avgPaceSecPerKm, units)} ${paceUnit}`}
            />
          </SheetList>
        </SheetBlock>
        <SheetBlock theme={theme}>
          <View style={styles.buttons}>
            <SheetButton
              label={t.restore.resume}
              onPress={() =>
                choose(() => {
                  recorder.resume();
                  pushSubScreen({ kind: "tracker-recording" });
                })
              }
              theme={theme}
              themeMode={themeMode}
            />
            <SheetButton
              label={t.restore.finish}
              variant="secondary"
              onPress={() =>
                choose(() => {
                  void recorder
                    .finish()
                    .then(() => pushSubScreen({ kind: "tracker-summary" }));
                })
              }
              theme={theme}
              themeMode={themeMode}
            />
            <SheetButton
              label={t.restore.delete}
              variant="destructive"
              onPress={() =>
                choose(() => {
                  void recorder.discard().then(() => openTab("today"));
                })
              }
              theme={theme}
              themeMode={themeMode}
            />
          </View>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { width: "100%" },
  content: { gap: 16, paddingTop: 72, paddingBottom: 32 },
  buttons: { gap: 8, marginTop: 4 },
});
