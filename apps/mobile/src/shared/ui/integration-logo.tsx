import { ActivityIndicator, Image, Pressable, StyleSheet, View } from "react-native";

import { type ThemeMode } from "@workspace/tokens";

/**
 * Official partner artwork, used exactly as the partners ship it. Every brand
 * forbids altering its marks, so no masks, tints, backgrounds or borders here.
 *
 * - Apple Health — HealthKit design resources; clear space of 1/10 of the height.
 * - Health Connect — Google's logo; the white variant is for dark backgrounds.
 * - Garmin Connect — the app tile from Garmin's developer brand assets.
 * - Strava — the app icon for lists; the API guidelines additionally require
 *   the "Compatible with Strava" logo and the "Connect with Strava" button.
 */
const LOGOS = {
  apple_health: { light: require("../../../assets/integrations/apple-health.png"), dark: null },
  health_connect: {
    light: require("../../../assets/integrations/health-connect.png"),
    dark: require("../../../assets/integrations/health-connect-white.png"),
  },
  garmin: { light: require("../../../assets/integrations/garmin-connect.png"), dark: null },
  strava: { light: require("../../../assets/integrations/strava.png"), dark: null },
} as const;

/** Square full-bleed artwork gets the same corner rounding as the tiles next to it. */
const ROUNDED: ReadonlySet<IntegrationLogoProvider> = new Set(["strava"]);

const STRAVA_COMPATIBLE = {
  light: require("../../../assets/integrations/strava-compatible-orange.png"),
  dark: require("../../../assets/integrations/strava-compatible-white.png"),
};
const STRAVA_CONNECT = require("../../../assets/integrations/strava-connect.png");

export type IntegrationLogoProvider = keyof typeof LOGOS;

export function IntegrationLogo({
  provider,
  themeMode,
  size = 32,
}: {
  provider: IntegrationLogoProvider;
  themeMode: ThemeMode;
  size?: number;
}) {
  const logo = LOGOS[provider];
  const source = themeMode === "dark" && logo.dark ? logo.dark : logo.light;
  return (
    <Image
      source={source}
      style={{
        width: size,
        height: size,
        margin: Math.round(size / 10),
        borderRadius: ROUNDED.has(provider) ? Math.round(size * 0.22) : 0,
      }}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

/** "Compatible with Strava" (218×18.5 pt at its native size). */
export function StravaCompatibleLogo({ themeMode, width = 218 }: { themeMode: ThemeMode; width?: number }) {
  return (
    <Image
      source={themeMode === "dark" ? STRAVA_COMPATIBLE.dark : STRAVA_COMPATIBLE.light}
      style={{ width, height: (width * 37) / 437 }}
      resizeMode="contain"
      accessibilityLabel="Compatible with Strava"
      accessibilityIgnoresInvertColors
    />
  );
}

/** Strava requires its own "Connect with Strava" button for the OAuth link (237×48 pt). */
export function StravaConnectButton({
  onPress,
  pending = false,
  disabled = false,
  accessibilityLabel,
}: {
  onPress: () => void;
  pending?: boolean;
  disabled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      disabled={disabled || pending}
      onPress={onPress}
      style={({ pressed }) => [styles.stravaButton, pressed && styles.pressed]}
    >
      <Image source={STRAVA_CONNECT} style={styles.stravaButtonImage} resizeMode="contain" accessibilityIgnoresInvertColors />
      {pending ? (
        <View style={styles.pending}>
          <ActivityIndicator color="#FFFFFF" size="small" />
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stravaButton: {
    alignSelf: "center",
  },
  stravaButtonImage: {
    width: 237,
    height: 48,
  },
  pending: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 4,
  },
  pressed: {
    opacity: 0.85,
  },
});
