import { useEffect, useState } from "react";
import { BackHandler, Pressable, StyleSheet, Text, View } from "react-native";
import { useKeepAwake } from "expo-keep-awake";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  Gauge,
  Lock,
  Map as MapIcon,
  Pause,
  Play,
  SkipForward,
} from "lucide-react-native";

import { withAlpha, type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import type { AppLanguage, MainCopy } from "../../../locales";
import { replaceSubScreen } from "../../main/main-routes";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { HoldButton } from "../components/hold-button";
import { StepCard } from "../components/step-card";
import { mapsEnabled, TrackMap } from "../map/track-map";
import { useTrackLines } from "../map/use-track-lines";
import { formatClock, formatDistanceValue, formatPaceValue } from "../format";
import { useRecorder } from "../hooks";
import { recorder } from "../recorder";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
};

/** Live recording: big numbers, pause/resume, finish by holding, a lock against stray touches. */
export function TrackerRecordingScreen({ theme, copy, language }: Props) {
  useKeepAwake();
  const t = copy.tracker;
  const insets = useSafeAreaInsets();
  const snapshot = useRecorder();
  const format = useUnitFormat(copy, language);
  const [locked, setLocked] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const { lines, markers } = useTrackLines(
    recorder.getTrack(),
    format.units,
    snapshot?.trackSize ?? 0,
  );

  // The recording is left only through "Finish": the system back gesture must not drop it.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => true,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (snapshot?.view.status === "finished")
      replaceSubScreen({ kind: "tracker-summary" });
  }, [snapshot?.view.status]);

  if (!snapshot)
    return (
      <View
        style={[styles.root, { backgroundColor: theme.color.background }]}
      />
    );

  const { view, config, meta } = snapshot;
  const withPlan = view.step !== null || view.planDone;
  const canMap =
    mapsEnabled &&
    config.environment !== "treadmill" &&
    config.distanceMode === "gps";
  const mapShown = canMap && showMap;
  const paused = view.status === "paused";
  const distanceUnit =
    format.units === "imperial" ? format.labels.mi : format.labels.km;
  const paceUnit =
    format.units === "imperial" ? format.labels.perMi : format.labels.perKm;
  const statusText = paused
    ? t.paused
    : view.autoPaused
      ? t.autoPaused
      : view.gps === "off"
        ? t.gps.off
        : view.gps === "good"
          ? t.gps.good
          : view.gps === "lost"
            ? t.gps.lost
            : t.gps.searching;
  const statusColor =
    paused || view.autoPaused
      ? theme.color.warning
      : view.gps === "good"
        ? theme.color.success
        : view.gps === "lost"
          ? theme.color.warning
          : theme.color.mutedForeground;

  const medium = theme.typography.fontFamily.sans.medium;
  const semibold = theme.typography.fontFamily.sans.semibold;
  const label = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const value = { color: theme.color.foreground, fontFamily: semibold };

  const secondary =
    config.environment === "trail"
      ? {
          label: t.metrics.elevation,
          value: `${Math.round(view.elevationGainM)}`,
          unit: t.metrics.metres,
        }
      : view.gps === "off"
        ? {
            label: t.metrics.cadence,
            value: view.cadence ? String(view.cadence) : "–",
            unit: t.metrics.spm,
          }
        : {
            label: t.metrics.avgPace,
            value: formatPaceValue(view.avgPaceSecPerKm, format.units),
            unit: paceUnit,
          };

  return (
    <View
      style={[
        styles.root,
        {
          backgroundColor: theme.color.background,
          paddingTop: insets.top + 12,
          paddingBottom: insets.bottom + 16,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text
            style={[
              styles.status,
              { color: theme.color.foreground, fontFamily: medium },
            ]}
          >
            {statusText}
          </Text>
        </View>
        {canMap ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mapShown ? t.showMetrics : t.showMap}
            onPress={() => setShowMap(!mapShown)}
            hitSlop={8}
            style={({ pressed }) => [
              styles.headerButton,
              { backgroundColor: theme.color.controlSecondary },
              pressed && styles.pressed,
            ]}
          >
            {mapShown ? (
              <Gauge color={theme.color.foreground} size={18} />
            ) : (
              <MapIcon color={theme.color.foreground} size={18} />
            )}
          </Pressable>
        ) : null}
      </View>
      {meta.plannedTitle ? (
        <Text style={[styles.planTitle, label]} numberOfLines={1}>
          {meta.plannedTitle}
        </Text>
      ) : null}

      {withPlan ? (
        <StepCard
          view={view}
          theme={theme}
          copy={copy}
          units={format.units}
          paceUnit={paceUnit}
          skipIcon={<SkipForward color={theme.color.foreground} size={16} />}
          onSkip={locked ? undefined : () => recorder.nextStep()}
        />
      ) : null}

      {mapShown ? (
        <>
          <TrackMap
            theme={theme}
            lines={lines}
            markers={markers}
            mode="follow"
            centerLabel={t.centerMap}
            style={styles.map}
          />
          <View style={styles.compactRow}>
            {[
              {
                key: "time",
                label: t.metrics.time,
                value: formatClock(view.movingMs),
                unit: null,
              },
              {
                key: "distance",
                label: t.metrics.distance,
                value: formatDistanceValue(
                  view.distanceM,
                  format.units,
                  format.locale,
                ),
                unit: distanceUnit,
              },
              {
                key: "pace",
                label: t.metrics.pace,
                value: formatPaceValue(view.currentPaceSecPerKm, format.units),
                unit: paceUnit,
              },
            ].map((item) => (
              <View key={item.key} style={styles.cell}>
                <Text style={[styles.metricLabel, label]}>{item.label}</Text>
                <View style={styles.valueRow}>
                  <Text style={[styles.compactValue, value]}>{item.value}</Text>
                  {item.unit ? (
                    <Text style={[styles.compactUnit, label]}>{item.unit}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.center}>
          <Text style={[styles.metricLabel, label]}>{t.metrics.time}</Text>
          <Text
            style={[withPlan ? styles.clockCompact : styles.clock, value]}
            accessibilityLabel={`${t.metrics.time} ${formatClock(view.movingMs)}`}
          >
            {formatClock(view.movingMs)}
          </Text>

          <Text
            style={[
              styles.metricLabel,
              label,
              withPlan ? styles.gapTopCompact : styles.gapTop,
            ]}
          >
            {t.metrics.distance}
          </Text>
          <View style={styles.valueRow}>
            <Text
              style={[
                withPlan ? styles.distanceCompact : styles.distance,
                value,
              ]}
            >
              {formatDistanceValue(view.distanceM, format.units, format.locale)}
            </Text>
            <Text style={[styles.unit, label]}>{distanceUnit}</Text>
          </View>

          <View
            style={[
              styles.grid,
              withPlan ? styles.gapTopCompact : styles.gapTop,
            ]}
          >
            <View style={styles.cell}>
              <Text style={[styles.metricLabel, label]}>{t.metrics.pace}</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.small, value]}>
                  {formatPaceValue(view.currentPaceSecPerKm, format.units)}
                </Text>
                <Text style={[styles.unit, label]}>{paceUnit}</Text>
              </View>
            </View>
            <View style={styles.cell}>
              <Text style={[styles.metricLabel, label]}>{secondary.label}</Text>
              <View style={styles.valueRow}>
                <Text style={[styles.small, value]}>{secondary.value}</Text>
                <Text style={[styles.unit, label]}>{secondary.unit}</Text>
              </View>
            </View>
          </View>
        </View>
      )}

      {locked ? (
        <HoldButton
          accessibilityLabel={t.unlockHint}
          onHold={() => setLocked(false)}
          fillColor={withAlpha(theme.color.foreground, 0.15)}
          style={[
            styles.wide,
            { backgroundColor: theme.color.controlSecondary },
          ]}
        >
          <Lock color={theme.color.foreground} size={20} />
          <Text
            style={[
              styles.buttonLabel,
              { color: theme.color.foreground, fontFamily: semibold },
            ]}
          >
            {t.unlockHint}
          </Text>
        </HoldButton>
      ) : (
        <View style={styles.controls}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t.lock}
            onPress={() => setLocked(true)}
            style={({ pressed }) => [
              styles.round,
              { backgroundColor: theme.color.controlSecondary },
              pressed && styles.pressed,
            ]}
          >
            <Lock color={theme.color.foreground} size={22} />
          </Pressable>

          {paused ? (
            <HoldButton
              accessibilityLabel={t.holdToFinish}
              onHold={() => void recorder.finish()}
              fillColor={withAlpha(theme.color.primaryForeground, 0.25)}
              style={[styles.main, { backgroundColor: theme.color.danger }]}
            >
              <Text
                style={[
                  styles.buttonLabel,
                  {
                    color: theme.color.primaryForeground,
                    fontFamily: semibold,
                  },
                ]}
              >
                {t.finish}
              </Text>
            </HoldButton>
          ) : null}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={paused ? t.resume : t.pause}
            onPress={() => (paused ? recorder.resume() : recorder.pause())}
            style={({ pressed }) => [
              styles.main,
              { backgroundColor: theme.color.primary },
              pressed && styles.pressed,
            ]}
          >
            {paused ? (
              <Play color={theme.color.primaryForeground} size={22} />
            ) : (
              <Pause color={theme.color.primaryForeground} size={22} />
            )}
            <Text
              style={[
                styles.buttonLabel,
                { color: theme.color.primaryForeground, fontFamily: semibold },
              ]}
            >
              {paused ? t.resume : t.pause}
            </Text>
          </Pressable>
        </View>
      )}
      {paused && !locked ? (
        <Text style={[styles.hint, label]}>{t.holdToFinish}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  header: { minHeight: 36, justifyContent: "center" },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  headerButton: {
    position: "absolute",
    right: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  map: { flex: 1, marginTop: 16 },
  compactRow: { flexDirection: "row", paddingVertical: 16 },
  compactValue: { fontSize: 24, lineHeight: 30, fontVariant: ["tabular-nums"] },
  compactUnit: { fontSize: 13, lineHeight: 18, marginLeft: 4, marginBottom: 4 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  status: { fontSize: 14, lineHeight: 18 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  metricLabel: { fontSize: 13, lineHeight: 18 },
  clock: {
    fontSize: 72,
    lineHeight: 80,
    letterSpacing: -2,
    fontVariant: ["tabular-nums"],
  },
  distance: {
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  clockCompact: {
    fontSize: 56,
    lineHeight: 64,
    letterSpacing: -1.5,
    fontVariant: ["tabular-nums"],
  },
  distanceCompact: {
    fontSize: 40,
    lineHeight: 48,
    letterSpacing: -1,
    fontVariant: ["tabular-nums"],
  },
  gapTopCompact: { marginTop: 14 },
  planTitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 4,
  },
  small: { fontSize: 30, lineHeight: 36, fontVariant: ["tabular-nums"] },
  unit: { fontSize: 15, lineHeight: 20, marginLeft: 6, marginBottom: 6 },
  valueRow: { flexDirection: "row", alignItems: "flex-end" },
  gapTop: { marginTop: 24 },
  grid: { flexDirection: "row", alignSelf: "stretch" },
  cell: { flex: 1, alignItems: "center" },
  controls: { flexDirection: "row", alignItems: "center", gap: 12 },
  round: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  main: {
    flex: 1,
    height: 64,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  wide: {
    height: 64,
    borderRadius: 32,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  buttonLabel: { fontSize: 17, lineHeight: 22 },
  hint: { fontSize: 12, lineHeight: 16, textAlign: "center", marginTop: 8 },
  pressed: { opacity: 0.85 },
});
