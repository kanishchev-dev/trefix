import { describe, expect, it } from "vitest";

import { distanceMarkers, splitTrack, type TrackPoint } from "./track";

/** Points going north from (55, 37), `stepM` metres apart, one per second. */
function line(count: number, stepM: number, start = { t: 0, lat: 55 }): TrackPoint[] {
  const dLat = stepM / 111_195;
  return Array.from({ length: count }, (_, i) => ({ t: start.t + i * 1000, lat: start.lat + i * dLat, lng: 37 }));
}

describe("track lines", () => {
  it("cuts the line where the GPS was silent and bridges the hole with a gap", () => {
    const before = line(10, 3);
    const last = before[before.length - 1]!;
    const after = line(10, 3, { t: last.t + 60_000, lat: last.lat + 0.002 });
    const { solid, gaps } = splitTrack([...before, ...after]);
    expect(solid).toHaveLength(2);
    expect(solid[0]).toHaveLength(10);
    expect(gaps).toEqual([[[37, last.lat], [37, after[0]!.lat]]]);
  });

  it("drops a lone point left between two holes", () => {
    const points: TrackPoint[] = [
      { t: 0, lat: 55, lng: 37 },
      { t: 1000, lat: 55.0001, lng: 37 },
      { t: 60_000, lat: 55.002, lng: 37 },
      { t: 120_000, lat: 55.004, lng: 37 },
      { t: 121_000, lat: 55.0041, lng: 37 },
    ];
    const { solid, gaps } = splitTrack(points);
    expect(solid).toHaveLength(2);
    expect(gaps).toHaveLength(2);
  });

  it("puts a marker at every whole kilometre", () => {
    const markers = distanceMarkers(line(251, 10));
    expect(markers.map((marker) => marker.n)).toEqual([1, 2]);
    expect(markers[0]!.coordinate[1]).toBeCloseTo(55 + 1000 / 111_195, 4);
    expect(distanceMarkers(line(251, 10), 1609.344).map((marker) => marker.n)).toEqual([1]);
  });
});
