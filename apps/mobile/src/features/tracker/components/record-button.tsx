import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Circle, Play } from "lucide-react-native";

import { type ThemeTokens } from "@workspace/tokens";

import type { AppLanguage, MainCopy } from "../../../locales";
import { pushSubScreen } from "../../main/main-routes";
import { useUnitFormat } from "../../profile/hooks/use-unit-format";
import { formatClock, formatDistanceValue } from "../format";
import { useRecorder } from "../hooks";

/** Height of the glass tab bar; the button floats just above it. */
const TAB_BAR_HEIGHT = 64;

type Props = { theme: ThemeTokens; copy: MainCopy; language: AppLanguage };

/** "Record" on Today; while a run is recorded it shows the run and leads back to it. */
export function RecordButton({ theme, copy, language }: Props) {
  const insets = useSafeAreaInsets();
  const snapshot = useRecorder();
  const format = useUnitFormat(copy, language);
  const t = copy.tracker;
  const bottom = Math.max(insets.bottom - 18, 4) + TAB_BAR_HEIGHT + 14;

  const live = snapshot !== null;
  const label = live
    ? snapshot.view.status === "finished"
      ? t.summaryTitle
      : `${formatClock(snapshot.view.movingMs)} · ${formatDistanceValue(snapshot.view.distanceM, format.units, format.locale)} ${
          format.units === "imperial" ? format.labels.mi : format.labels.km
        }`
    : t.record;

  return (
    <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() =>
          pushSubScreen({
            kind: !live
              ? "tracker-setup"
              : snapshot.view.status === "finished"
                ? "tracker-summary"
                : "tracker-recording",
          })
        }
        style={({ pressed }) => [
          styles.button,
          { backgroundColor: theme.color.primary },
          pressed && styles.pressed,
        ]}
      >
        {live ? (
          <Circle
            color={theme.color.danger}
            fill={theme.color.danger}
            size={10}
          />
        ) : (
          <Play
            color={theme.color.primaryForeground}
            size={18}
            fill={theme.color.primaryForeground}
          />
        )}
        <Text
          style={[
            styles.label,
            {
              color: theme.color.primaryForeground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", left: 0, right: 0, alignItems: "center" },
  button: {
    height: 48,
    paddingHorizontal: 22,
    borderRadius: 24,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    shadowColor: "#000000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  label: { fontSize: 15, lineHeight: 20, fontVariant: ["tabular-nums"] },
  pressed: { opacity: 0.85 },
});
