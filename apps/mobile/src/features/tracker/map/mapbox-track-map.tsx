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
  StyleImport,
  SymbolLayer,
} from "@rnmapbox/maps";
import { LocateFixed } from "lucide-react-native";

import { isDarkTheme, type ThemeTokens } from "@trefix/tokens";

import { Glass } from "../components/glass";
import { boundsOf, type LatLng } from "../engine/geo";
import type { DistanceMarker, LngLat, TrackLines } from "../engine/track";

// Loaded only through `./track-map`, after the token and the native module are checked.
void Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? "");
Mapbox.setTelemetryEnabled(false);

/** Mapbox Standard: day / night light preset, no POI or transit labels. */
const STYLE_STANDARD = "mapbox://styles/mapbox/standard";
const FOLLOW_ZOOM = 16;
const FIT_PADDING = 32;

export type TrackMapProps = {
  theme: ThemeTokens;
  lines: TrackLines;
  markers: DistanceMarker[];
  /** `follow`: the runner's position, live. `fit`: the whole route in view. */
  mode: "follow" | "fit";
  /** Route points for `fit`. */
  points?: LatLng[];
  interactive?: boolean;
  centerLabel?: string;
  /** Where the "back to my position" button sits; top right by default. */
  centerButtonStyle?: StyleProp<ViewStyle>;
  /** Hides the attribution and logo margins under overlays (full-screen map). */
  ornamentsBottom?: number;
  style?: StyleProp<ViewStyle>;
};

type Feature = GeoJSON.Feature<GeoJSON.Geometry, { kind?: string; n?: string }>;

const multiLine = (kind: string, lines: LngLat[][]): Feature => ({
  type: "Feature",
  properties: { kind },
  geometry: { type: "MultiLineString", coordinates: lines },
});

/** The route on a Mapbox map: GPS stretches solid, pedometer stretches dashed, a mark at every kilometre. */
export function MapboxTrackMap({
  theme,
  lines,
  markers,
  mode,
  points = [],
  interactive = mode === "follow",
  centerLabel,
  centerButtonStyle,
  ornamentsBottom = 8,
  style,
}: TrackMapProps) {
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
        styleURL={STYLE_STANDARD}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        scaleBarEnabled={false}
        compassEnabled={false}
        logoPosition={{ bottom: ornamentsBottom, left: 8 }}
        attributionPosition={{ bottom: ornamentsBottom, right: 8 }}
      >
        <StyleImport
          id="basemap"
          existing
          config={{
            lightPreset: dark ? "night" : "day",
            showPointOfInterestLabels: false,
            showTransitLabels: false,
          }}
        />
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
              circleColor: theme.color.foreground,
              circleStrokeColor: theme.color.card,
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
            centerButtonStyle,
            pressed && styles.pressed,
          ]}
        >
          <Glass theme={theme} interactive style={styles.centerGlass}>
            <LocateFixed color={theme.color.foreground} size={20} />
          </Glass>
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
  },
  centerGlass: {
    flex: 1,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: { opacity: 0.85 },
});
