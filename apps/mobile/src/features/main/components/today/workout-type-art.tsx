import React from "react";
import { StyleSheet } from "react-native";
import Svg, {
  Circle,
  Defs,
  G,
  Mask,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from "react-native-svg";
import { type ManualWorkoutType } from "./workout-goal-sheet";

type Props = {
  type: ManualWorkoutType;
  color: string;
};

const WIDTH = 120;
const HEIGHT = 110;

/**
 * Background illustration for the "add workout" tiles: a motif per workout type
 * anchored to the bottom-right corner that fades out towards the centre.
 */
export const WorkoutTypeArt = React.memo(({ type, color }: Props) => {
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
          r={type === "race" ? 115 : 130}
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

      <G mask={`url(#${mask})`} opacity={0.35}>
        <Motif type={type} color={color} />
      </G>
    </Svg>
  );
});

const Motif = ({ type, color }: Props) => {
  switch (type) {
    case "easy":
      // Terrain contour lines.
      return (
        <G fill="none" stroke={color} strokeWidth={1.4}>
          <Path d="M10 112c12-22 34-20 46-40s34-28 70-22" />
          <Path d="M30 112c10-16 28-16 38-30s28-20 58-16" />
          <Path d="M50 112c8-10 20-12 28-22s20-14 48-12" />
          <Path d="M70 112c6-6 14-8 20-14s14-8 36-8" />
          <Path d="M90 112c4-4 8-4 12-8s10-6 24-4" />
        </G>
      );
    case "tempo":
      // Speed streaks.
      return (
        <Path
          d="M50 100h80M30 86h90M66 72h60M44 58h80M84 44h40"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
        />
      );
    case "interval":
      // Stadium track lanes with a start line.
      return (
        <G fill="none" stroke={color} strokeWidth={1.6}>
          {[22, 36, 50, 64, 78].map((r) => (
            <Circle key={r} cx={124} cy={114} r={r} />
          ))}
          <Path d="M70 112V82" strokeWidth={2.4} strokeDasharray="3 4" />
        </G>
      );
    case "hill":
      // Two mountain ridges.
      return (
        <G fill={color}>
          <Path d="M20 114 74 52l22 24 14-12 22 50Z" opacity={0.45} />
          <Path d="M50 114l46-40 16 14 10-8 12 34Z" />
        </G>
      );
    case "race":
      // Chequered board fading out from the corner.
      return <Path d={CHECKERBOARD} fill={color} />;
  }
};

const CHECK_SIZE = 12;

/** Squares aligned to the bottom-right corner, so the corner cell is always filled. */
const CHECKERBOARD = (() => {
  let d = "";
  for (let col = 0; col * CHECK_SIZE < WIDTH; col += 1) {
    for (let row = 0; row * CHECK_SIZE < HEIGHT; row += 1) {
      if ((col + row) % 2 === 0) {
        const x = WIDTH - (col + 1) * CHECK_SIZE;
        const y = HEIGHT - (row + 1) * CHECK_SIZE;
        d += `M${x} ${y}h${CHECK_SIZE}v${CHECK_SIZE}h-${CHECK_SIZE}Z`;
      }
    }
  }
  return d;
})();
