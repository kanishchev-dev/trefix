import { useMemo, useState } from "react";
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Mapbox, {
  Camera,
  CircleLayer,
  LineLayer,
  LocationPuck,
  MapView,
  ShapeSource,
  SymbolLayer,
} from "@rnmapbox/maps";
import { LocateFixed } from "lucide-react-native";

import { isDarkTheme, type ThemeTokens } from "@trefix/tokens";

import { boundsOf, type LatLng } from "../engine/geo";
import type { DistanceMarker, LngLat, TrackLines } from "../engine/track";

const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "";

/** Maps need a public Mapbox token; without it every map is simply not shown. */
export const mapsEnabled = TOKEN.length > 0;

if (mapsEnabled) {
  void Mapbox.setAccessToken(TOKEN);
  Mapbox.setTelemetryEnabled(false);
}

const STYLE_LIGHT = "mapbox://styles/mapbox/light-v11";
const STYLE_DARK = "mapbox://styles/mapbox/dark-v11";
const FOLLOW_ZOOM = 16;
const FIT_PADDING = 32;

type Props = {
  theme: ThemeTokens;
  lines: TrackLines;
  markers: DistanceMarker[];
  /** `follow`: the runner's position, live. `fit`: the whole route in view. */
  mode: "follow" | "fit";
  /** Route points for `fit`. */
  points?: LatLng[];
  interactive?: boolean;
  centerLabel?: string;
  style?: StyleProp<ViewStyle>;
};

type Feature = GeoJSON.Feature<GeoJSON.Geometry, { kind?: string; n?: string }>;

const multiLine = (kind: string, lines: LngLat[][]): Feature => ({
  type: "Feature",
  properties: { kind },
  geometry: { type: "MultiLineString", coordinates: lines },
});

/** The route on a Mapbox map: GPS stretches solid, pedometer stretches dashed, a mark at every kilometre. */
export function TrackMap({
  theme,
  lines,
  markers,
  mode,
  points = [],
  interactive = mode === "follow",
  centerLabel,
  style,
}: Props) {
  const [following, setFollowing] = useState(true);
  const dark = isDarkTheme(theme);

  const routeShape = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: [multiLine("solid", lines.solid), multiLine("gap", lines.gaps)],
    }),
    [lines],
  );

  const endsShape = useMemo<GeoJSON.FeatureCollection>(() => {
    const first = lines.solid[0]?.[0];
    const lastLine = lines.solid[lines.solid.length - 1];
    const last = lastLine?.[lastLine.length - 1];
    const features: Feature[] = [];
    if (first)
      features.push({
        type: "Feature",
        properties: { kind: "start" },
        geometry: { type: "Point", coordinates: first },
      });
    if (last && mode === "fit") {
      features.push({
        type: "Feature",
        properties: { kind: "finish" },
        geometry: { type: "Point", coordinates: last },
      });
    }
    return { type: "FeatureCollection", features };
  }, [lines, mode]);

  const markerShape = useMemo<GeoJSON.FeatureCollection>(
    () => ({
      type: "FeatureCollection",
      features: markers.map<Feature>((marker) => ({
        type: "Feature",
        properties: { n: String(marker.n) },
        geometry: { type: "Point", coordinates: marker.coordinate },
      })),
    }),
    [markers],
  );

  const bounds = useMemo(() => {
    const box = mode === "fit" ? boundsOf(points) : null;
    return box
      ? {
          ne: [box.maxLng, box.maxLat] as LngLat,
          sw: [box.minLng, box.minLat] as LngLat,
        }
      : undefined;
  }, [mode, points]);

  if (!mapsEnabled) return null;

  const primary = theme.color.primary;
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.color.segmentedTrack },
        style,
      ]}
    >
      <MapView
        style={StyleSheet.absoluteFill}
        styleURL={dark ? STYLE_DARK : STYLE_LIGHT}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
        logoPosition={{ bottom: 8, left: 8 }}
        attributionPosition={{ bottom: 8, right: 8 }}
      >
        {mode === "follow" ? (
          <Camera
            followUserLocation={following}
            followZoomLevel={FOLLOW_ZOOM}
            onUserTrackingModeChange={(event) =>
              setFollowing(event.nativeEvent.payload.followUserLocation)
            }
          />
        ) : (
          <Camera
            bounds={bounds}
            padding={{
              paddingTop: FIT_PADDING,
              paddingBottom: FIT_PADDING,
              paddingLeft: FIT_PADDING,
              paddingRight: FIT_PADDING,
            }}
            animationDuration={0}
          />
        )}
        {mode === "follow" ? (
          <LocationPuck
            puckBearingEnabled
            puckBearing="course"
            pulsing={{ isEnabled: false }}
          />
        ) : null}

        <ShapeSource id="trefix-route" shape={routeShape}>
          <LineLayer
            id="trefix-route-gap"
            filter={["==", ["get", "kind"], "gap"]}
            style={{
              lineColor: primary,
              lineWidth: 3,
              lineOpacity: 0.6,
              lineDasharray: [1, 2],
              lineCap: "round",
            }}
          />
          <LineLayer
            id="trefix-route-solid"
            filter={["==", ["get", "kind"], "solid"]}
            style={{
              lineColor: primary,
              lineWidth: 4,
              lineCap: "round",
              lineJoin: "round",
            }}
          />
        </ShapeSource>

        <ShapeSource id="trefix-markers" shape={markerShape}>
          <CircleLayer
            id="trefix-marker-circle"
            style={{
              circleRadius: 9,
              circleColor: theme.color.background,
              circleStrokeColor: primary,
              circleStrokeWidth: 2,
            }}
          />
          <SymbolLayer
            id="trefix-marker-label"
            style={{
              textField: ["get", "n"],
              textSize: 10,
              textColor: theme.color.foreground,
              textFont: ["DIN Pro Medium", "Arial Unicode MS Regular"],
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
        </ShapeSource>

        <ShapeSource id="trefix-ends" shape={endsShape}>
          <CircleLayer
            id="trefix-ends-circle"
            style={{
              circleRadius: 6,
              circleColor: [
                "match",
                ["get", "kind"],
                "start",
                theme.color.success,
                theme.color.danger,
              ],
              circleStrokeColor: theme.color.background,
              circleStrokeWidth: 2,
            }}
          />
        </ShapeSource>
      </MapView>

      {mode === "follow" && !following ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={centerLabel}
          onPress={() => setFollowing(true)}
          style={({ pressed }) => [
            styles.center,
            {
              backgroundColor: theme.color.floating,
              borderColor: theme.color.border,
            },
            pressed && styles.pressed,
          ]}
        >
          <LocateFixed color={theme.color.foreground} size={20} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { overflow: "hidden", borderRadius: 20 },
  center: {
    position: "absolute",
    right: 12,
    top: 12,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85 },
});
