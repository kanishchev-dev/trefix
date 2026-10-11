import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import { type ThemeTokens } from "@workspace/tokens";

export type ChartPoint = { x: number; y: number };

type Props = {
  /** Solid line; x in [0, 1]. */
  points: ChartPoint[];
  /** Dashed continuation (forecast). */
  dashed?: ChartPoint[];
  /** Horizontal dashed reference line with a label. */
  reference?: { y: number; label: string };
  /** Smaller value is drawn higher (pace, time). */
  invert?: boolean;
  height?: number;
  theme: ThemeTokens;
  accessibilityLabel: string;
};

const STROKE = 2.5;
const DASH = 5;
const GAP = 4;

/** Minimal line chart made of rotated views: no SVG dependency. */
export function LineChart({
  points,
  dashed = [],
  reference,
  invert = false,
  height = 80,
  theme,
  accessibilityLabel,
}: Props) {
  const [width, setWidth] = useState(0);
  const all = [
    ...points,
    ...dashed,
    ...(reference ? [{ x: 0, y: reference.y }] : []),
  ];
  if (all.length === 0) return <View style={{ height }} />;

  const ys = all.map((point) => point.y);
  const min = Math.min(...ys);
  const max = Math.max(...ys);
  const span = max - min || 1;
  const pad = 8;
  const toPx = (point: ChartPoint) => {
    const ratio = (point.y - min) / span;
    const y = invert
      ? pad + ratio * (height - pad * 2)
      : height - pad - ratio * (height - pad * 2);
    return { left: point.x * Math.max(0, width - 8) + 4, top: y };
  };

  const segment = (
    from: ChartPoint,
    to: ChartPoint,
    color: string,
    key: string,
    thickness: number,
  ) => {
    const a = toPx(from);
    const b = toPx(to);
    const length = Math.hypot(b.left - a.left, b.top - a.top);
    const angle = Math.atan2(b.top - a.top, b.left - a.left);
    return (
      <View
        key={key}
        style={{
          position: "absolute",
          left: (a.left + b.left) / 2 - length / 2,
          top: (a.top + b.top) / 2 - thickness / 2,
          width: length,
          height: thickness,
          borderRadius: thickness / 2,
          backgroundColor: color,
          transform: [{ rotate: `${angle}rad` }],
        }}
      />
    );
  };

  const dashedSegments = (line: ChartPoint[], color: string) =>
    line.slice(1).flatMap((to, index) => {
      const from = line[index];
      const a = toPx(from);
      const b = toPx(to);
      const length = Math.hypot(b.left - a.left, b.top - a.top);
      const steps = Math.max(1, Math.floor(length / (DASH + GAP)));
      return Array.from({ length: steps }, (_, step) => {
        const t0 = (step * (DASH + GAP)) / length;
        const t1 = Math.min(1, (step * (DASH + GAP) + DASH) / length);
        const lerp = (t: number): ChartPoint => ({
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t,
        });
        return segment(lerp(t0), lerp(t1), color, `d-${index}-${step}`, 2);
      });
    });

  const last = points[points.length - 1];
  const lastPx = last ? toPx(last) : null;
  const refTop = reference ? toPx({ x: 0, y: reference.y }).top : null;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={accessibilityLabel}
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
      style={{ height }}
    >
      {width > 0 ? (
        <>
          {reference && refTop !== null ? (
            <>
              {dashedSegments(
                [
                  { x: 0, y: reference.y },
                  { x: 1, y: reference.y },
                ],
                theme.color.border,
              )}
              <Text
                style={[
                  styles.refLabel,
                  {
                    top: Math.max(0, refTop - 16),
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {reference.label}
              </Text>
            </>
          ) : null}
          {points
            .slice(1)
            .map((to, index) =>
              segment(
                points[index],
                to,
                theme.color.foreground,
                `s-${index}`,
                STROKE,
              ),
            )}
          {dashed.length > 1
            ? dashedSegments(dashed, theme.color.mutedForeground)
            : null}
          {lastPx ? (
            <View
              style={[
                styles.dot,
                {
                  left: lastPx.left - 4,
                  top: lastPx.top - 4,
                  backgroundColor: theme.color.foreground,
                },
              ]}
            />
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  refLabel: {
    position: "absolute",
    right: 0,
    fontSize: 10,
    lineHeight: 14,
  },
  dot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
