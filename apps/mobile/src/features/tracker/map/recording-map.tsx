import { useMemo } from "react";
import { StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";

import type { ThemeTokens } from "@workspace/tokens";

import { getWorkoutSources } from "../../../lib/integrations-api";
import { getWorkoutRecording } from "../../../lib/training-api";
import type { UnitSystem } from "../../../shared/lib/units";
import { decodePolyline } from "../engine/geo";
import type { TrackPoint } from "../engine/track";
import { mapsEnabled, TrackMap } from "./track-map";
import { useTrackLines } from "./use-track-lines";

type Props = {
  workoutId: string;
  theme: ThemeTokens;
  units: UnitSystem;
};

/** Route of a workout recorded with the tracker; nothing for other workouts or runs without GPS. */
export function RecordingMap({ workoutId, theme, units }: Props) {
  const sources = useQuery({
    queryKey: ["workouts", "sources", workoutId],
    queryFn: () => getWorkoutSources(workoutId),
    staleTime: 60_000,
    enabled: mapsEnabled,
  });
  const recorded = sources.data?.items.some((item) => item.provider === "trefix") ?? false;
  const recording = useQuery({
    queryKey: ["workouts", "recording", workoutId],
    queryFn: () => getWorkoutRecording(workoutId),
    enabled: mapsEnabled && recorded,
    staleTime: 5 * 60_000,
  });

  const routeLine = recording.data?.routeLine ?? null;
  // The route line has no times: drawn as one solid line.
  const points = useMemo<TrackPoint[]>(
    () => (routeLine ? decodePolyline(routeLine).map((point, index) => ({ ...point, t: index })) : []),
    [routeLine],
  );
  const { lines, markers } = useTrackLines(points, units);

  if (points.length < 2) return null;
  return <TrackMap theme={theme} lines={lines} markers={markers} mode="fit" points={points} interactive={false} style={styles.map} />;
}

const styles = StyleSheet.create({
  map: { height: 200, marginBottom: 12 },
});
