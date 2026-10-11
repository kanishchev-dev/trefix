import { haversineM } from "./geo";

export type TrackPoint = { t: number; lat: number; lng: number };
/** [lng, lat], the order maps want. */
export type LngLat = [number, number];

/**
 * A silence between fixes longer than this means the GPS was lost and the
 * pedometer counted that stretch: it is drawn as a straight dashed line.
 */
export const TRACK_GAP_MS = 20_000;

export type TrackLines = {
  /** Stretches measured by GPS. */
  solid: LngLat[][];
  /** Straight jumps over the stretches without GPS. */
  gaps: LngLat[][];
};

export type DistanceMarker = { n: number; coordinate: LngLat };

const toLngLat = (point: { lat: number; lng: number }): LngLat => [
  point.lng,
  point.lat,
];

export function splitTrack(
  points: TrackPoint[],
  gapMs = TRACK_GAP_MS,
): TrackLines {
  const solid: LngLat[][] = [];
  const gaps: LngLat[][] = [];
  let current: LngLat[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const point = points[i]!;
    const prev = points[i - 1];
    if (prev && point.t - prev.t > gapMs) {
      if (current.length >= 2) solid.push(current);
      gaps.push([toLngLat(prev), toLngLat(point)]);
      current = [];
    }
    current.push(toLngLat(point));
  }
  if (current.length >= 2) solid.push(current);
  return { solid, gaps };
}

/** Where each whole kilometre (or mile, with `unitM`) was passed, along the drawn line. */
export function distanceMarkers(
  points: Array<{ lat: number; lng: number }>,
  unitM = 1000,
): DistanceMarker[] {
  const markers: DistanceMarker[] = [];
  let covered = 0;
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!;
    const b = points[i]!;
    const d = haversineM(a, b);
    if (d <= 0) continue;
    while (covered + d >= (markers.length + 1) * unitM) {
      const k = ((markers.length + 1) * unitM - covered) / d;
      markers.push({
        n: markers.length + 1,
        coordinate: [a.lng + (b.lng - a.lng) * k, a.lat + (b.lat - a.lat) * k],
      });
    }
    covered += d;
  }
  return markers;
}
