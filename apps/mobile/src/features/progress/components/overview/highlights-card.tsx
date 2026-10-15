import { StyleSheet, Text, View } from "react-native";
import { ArrowRight } from "lucide-react-native";

import { type ThemeTokens } from "@trefix/tokens";

import {
  type ProgressPeriod,
  type ProgressSnapshot,
} from "../../data/progress-model";
import {
  highlightsFor,
  type ProgressHighlightItem,
} from "../../lib/progress-selectors";
import {
  highlightItemText,
  highlightMainText,
  highlightTitle,
  type ProgressTextContext,
} from "../../lib/progress-text";
import {
  Caption,
  Kicker,
  Medal,
  ProgressCard,
  fonts,
  progressPalette,
  type ProgressPalette,
} from "../progress-ui";

/** Heart rate range mapped onto the zone strip of the infographic. */
const HR_MIN = 100;
const HR_MAX = 190;

type Props = {
  theme: ThemeTokens;
  ctx: ProgressTextContext;
  snapshot: ProgressSnapshot;
  period: ProgressPeriod;
};

/** The most notable change of the period and two facts with small infographics. */
export function HighlightsCard({ theme, ctx, snapshot, period }: Props) {
  const highlights = highlightsFor(snapshot, period);
  if (!highlights) return null;
  const palette = progressPalette(theme);
  const font = fonts(theme);
  const main = highlightMainText(
    ctx,
    highlights.main,
    snapshot.firstWorkoutDate,
  );
  const [from, to] = main.value.includes(" → ")
    ? main.value.split(" → ")
    : [null, main.value];

  return (
    <ProgressCard theme={theme} style={styles.card}>
      <Kicker theme={theme}>
        {highlightTitle(ctx, period, snapshot.asOf)}
      </Kicker>
      <View style={styles.mainRow}>
        {from ? (
          <>
            <Text
              numberOfLines={1}
              style={[
                styles.from,
                { color: palette.muted, fontFamily: font.regular },
              ]}
            >
              {from}
            </Text>
            <ArrowRight size={16} strokeWidth={2.4} color={palette.muted} />
          </>
        ) : null}
        <Text
          numberOfLines={1}
          style={[styles.to, { color: palette.fg, fontFamily: font.medium }]}
        >
          {to}
        </Text>
      </View>
      <Text
        style={[styles.text, { color: palette.fg, fontFamily: font.regular }]}
      >
        {main.text}
      </Text>

      {highlights.items.length > 0 ? (
        <View style={styles.items}>
          {highlights.items.map((item) => {
            const text = highlightItemText(ctx, item);
            return (
              <View key={item.kind} style={styles.item}>
                <View
                  style={styles.graphic}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                >
                  <ItemGraphic item={item} palette={palette} />
                </View>
                <Kicker theme={theme}>{text.label}</Kicker>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.value,
                    { color: palette.fg, fontFamily: font.medium },
                  ]}
                >
                  {text.value}
                </Text>
                {text.note ? (
                  <Caption theme={theme} numberOfLines={1}>
                    {text.note}
                  </Caption>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null}
    </ProgressCard>
  );
}

function hrPosition(value: number): number {
  return Math.max(
    0,
    Math.min(100, ((value - HR_MIN) / (HR_MAX - HR_MIN)) * 100),
  );
}

function ItemGraphic({
  item,
  palette,
}: {
  item: ProgressHighlightItem;
  palette: ProgressPalette;
}) {
  if (item.kind === "longest") {
    const previous = item.previousKm
      ? Math.min(100, (item.previousKm / item.km) * 100)
      : null;
    return (
      <View style={styles.longest}>
        {previous !== null ? (
          <View
            style={[
              styles.skewBar,
              { width: `${previous}%`, backgroundColor: palette.faint },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.skewBar,
            { width: "100%", backgroundColor: palette.fg },
          ]}
        />
      </View>
    );
  }
  if (item.kind === "heartRate") {
    const zones = [
      palette.chip,
      palette.faint,
      palette.mid,
      palette.muted,
      palette.fg,
    ];
    return (
      <View style={styles.hr}>
        <View style={styles.zones}>
          {zones.map((color, index) => (
            <View
              key={index}
              style={[styles.zone, { backgroundColor: color }]}
            />
          ))}
        </View>
        {item.previous !== null ? (
          <View
            style={[
              styles.prevMark,
              {
                left: `${hrPosition(item.previous)}%`,
                backgroundColor: palette.faint,
              },
            ]}
          />
        ) : null}
        <View
          style={[
            styles.marker,
            { left: `${hrPosition(item.value)}%`, borderTopColor: palette.fg },
          ]}
        />
      </View>
    );
  }
  return <Medal size={40} color={palette.fg} cutout={palette.card} />;
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 22,
    alignItems: "center",
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "center",
    gap: 10,
    marginTop: 12,
  },
  from: { fontSize: 22, lineHeight: 28 },
  to: { fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  text: {
    fontSize: 15,
    lineHeight: 20,
    marginTop: 10,
    maxWidth: 300,
    textAlign: "center",
  },
  items: { alignSelf: "stretch", flexDirection: "row", gap: 12, marginTop: 28 },
  item: { flex: 1, minWidth: 0, alignItems: "center", gap: 6 },
  graphic: {
    height: 40,
    width: 96,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  value: { fontSize: 17, lineHeight: 22 },
  longest: { width: 96, gap: 5 },
  skewBar: { height: 8, borderRadius: 4, transform: [{ skewX: "-24deg" }] },
  hr: { width: 96, height: 24 },
  zones: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 12,
    flexDirection: "row",
    gap: 2,
  },
  zone: { flex: 1, height: 6, borderRadius: 3 },
  prevMark: {
    position: "absolute",
    top: 0,
    width: 2,
    height: 10,
    marginLeft: -1,
    borderRadius: 1,
  },
  marker: {
    position: "absolute",
    top: 0,
    width: 0,
    height: 0,
    marginLeft: -5,
    borderLeftWidth: 5,
    borderRightWidth: 5,
    borderTopWidth: 8,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },
});
