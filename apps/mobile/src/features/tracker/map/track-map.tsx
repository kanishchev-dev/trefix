import type { ComponentType } from "react";
import { NativeModules } from "react-native";

import type { TrackMapProps } from "./mapbox-track-map";

const hasToken = (process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "").length > 0;

/** Mapbox native code is in this build (not in Expo Go); `@rnmapbox/maps` throws on import without it. */
const hasNativeMaps = NativeModules.RNMBXModule != null;

/** Maps need a public Mapbox token and a native build; otherwise every map is simply not shown. */
export const mapsEnabled = hasToken && hasNativeMaps;

const MapImpl: ComponentType<TrackMapProps> | null = mapsEnabled
  ? (require("./mapbox-track-map") as typeof import("./mapbox-track-map"))
      .MapboxTrackMap
  : null;

/** The route on a Mapbox map: GPS stretches solid, pedometer stretches dashed, a mark at every kilometre. */
export function TrackMap(props: TrackMapProps) {
  return MapImpl ? <MapImpl {...props} /> : null;
}
