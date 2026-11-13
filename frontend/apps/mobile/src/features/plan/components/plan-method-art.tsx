import React from "react";
import { StyleSheet } from "react-native";
import Svg, {
  Defs,
  G,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from "react-native-svg";

type Props = {
  kind: "coach" | "manual";
  color: string;
  /** Short weekday names, Monday first; the manual motif labels its grid with them. */
  dayNames: readonly string[];
};

const WIDTH = 120;
const HEIGHT = 110;

const fixed = (value: number) => Math.round(value * 10) / 10;
const polyline = (points: Array<[number, number]>) =>
  `M${points.map(([x, y]) => `${fixed(x)} ${fixed(y)}`).join(" L")}`;

/** Nested warped loops drifting to one side: a route that gathers towards a point. */
const CONTOURS = Array.from({ length: 18 }, (_, index) => {
  const k = index + 1;
  const base = 4 + k * 5.2;
  const cx = 96 - k * 1.4;
  const cy = 84 - k * 0.9;
  const points = Array.from({ length: 73 }, (__, step): [number, number] => {
    const angle = (step / 72) * 2 * Math.PI;
    const radius =
      base *
      (1 +
        0.16 * Math.sin(2 * angle + 0.25 * k) +
        0.09 * Math.sin(3 * angle + 1.3 - 0.12 * k) +
        0.05 * Math.sin(5 * angle + 0.4 * k));
    return [
      cx + radius * Math.cos(angle) * 1.15,
      cy + radius * Math.sin(angle) * 0.85,
    ];
  });
  return `${polyline(points)}Z`;
}).join("");

/** Soft wavy lines under the week grid. */
const WAVES = Array.from({ length: 16 }, (_, index) => {
  const y0 = -4 + index * 7.5;
  const points = Array.from({ length: 31 }, (__, step): [number, number] => {
    const x = step * 4;
    return [
      x,
      y0 +
        3.2 * Math.sin(x / 13 + index * 0.55) +
        1.6 * Math.sin(x / 5.5 + index),
    ];
  });
  return polyline(points);
}).join("");

const COLUMN = 40;
const ROW = HEIGHT / 3;
const GRID_LINES = `M40 0V${HEIGHT}M80 0V${HEIGHT}M0 ${fixed(ROW)}H${WIDTH}M0 ${fixed(2 * ROW)}H${WIDTH}`;
/** Training days of the sample week: Monday, Wednesday, Friday, Sunday. */
const TRAINING_CELLS: Array<[number, number]> = [
  [0, 0],
  [2, 0],
  [1, 1],
  [0, 2],
];

/**
 * Background of the plan creation tiles, in the manner of WorkoutTypeArt:
 * thin lines anchored to the bottom-right corner, fading towards the centre.
 */
export const PlanMethodArt = React.memo(({ kind, color, dayNames }: Props) => {
  const id = React.useId().replace(/[^a-zA-Z0-9]/g, "");
  const fade = `fade${id}`;
  const mask = `mask${id}`;

  return (
    <Svg
      pointerEvents="none"
      style={StyleSheet.absoluteFill}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="xMaxYMax slice"
    >
      <Defs>
        <RadialGradient
          id={fade}
          cx={WIDTH}
          cy={HEIGHT}
          r={130}
          gradientUnits="userSpaceOnUse"
        >
          <Stop offset="0" stopColor="#fff" stopOpacity={1} />
          <Stop offset="0.2" stopColor="#fff" stopOpacity={0.8} />
          <Stop offset="0.4" stopColor="#fff" stopOpacity={0.55} />
          <Stop offset="0.6" stopColor="#fff" stopOpacity={0.3} />
          <Stop offset="0.8" stopColor="#fff" stopOpacity={0.12} />
          <Stop offset="1" stopColor="#fff" stopOpacity={0} />
        </RadialGradient>
        <Mask id={mask}>
          <Rect width={WIDTH} height={HEIGHT} fill={`url(#${fade})`} />
        </Mask>
      </Defs>

      <G mask={`url(#${mask})`} opacity={0.55}>
        {kind === "coach" ? (
          <Path d={CONTOURS} fill="none" stroke={color} strokeWidth={0.7} />
        ) : (
          <>
            {TRAINING_CELLS.map(([column, row]) => (
              <Rect
                key={`${column}-${row}`}
                x={column * COLUMN}
                y={row * ROW}
                width={COLUMN}
                height={ROW}
                fill={color}
                opacity={0.12}
              />
            ))}
            <Path
              d={WAVES}
              fill="none"
              stroke={color}
              strokeWidth={0.6}
              opacity={0.7}
            />
            <Path d={GRID_LINES} stroke={color} strokeWidth={0.9} />
            {dayNames.slice(0, 7).map((name, index) => (
              <SvgText
                key={name}
                x={(index % 3) * COLUMN + 3}
                y={Math.floor(index / 3) * ROW + 6.5}
                fill={color}
                fontSize={4.5}
                fontWeight="500"
              >
                {name}
              </SvgText>
            ))}
          </>
        )}
      </G>
    </Svg>
  );
});
