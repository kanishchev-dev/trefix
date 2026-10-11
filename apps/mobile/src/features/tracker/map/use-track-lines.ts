import { useMemo } from "react";

import type { UnitSystem } from "../../../shared/lib/units";
import {
  distanceMarkers,
  splitTrack,
  type DistanceMarker,
  type TrackLines,
  type TrackPoint,
} from "../engine/track";

const METRES_PER_MILE = 1609.344;

/**
 * Lines and kilometre marks of a route. `version` re-runs it for an array
 * that grows in place (the live recording).
 */
export function useTrackLines(
  points: TrackPoint[],
  units: UnitSystem,
  version: number = points.length,
): { lines: TrackLines; markers: DistanceMarker[] } {
  return useMemo(
    () => ({
      lines: splitTrack(points),
      markers: distanceMarkers(
        points,
        units === "imperial" ? METRES_PER_MILE : 1000,
      ),
    }),
    // `version` stands for the content of `points`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points, units, version],
  );
}
