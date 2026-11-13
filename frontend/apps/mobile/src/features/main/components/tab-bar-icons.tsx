import { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Sparkles, type LucideIcon } from "lucide-react-native";
import { type ThemeTokens } from "@trefix/tokens";
import { ICON_SIZE, styles } from "./tab-bar.styles";

/** Line icon that crossfades from the muted to the active colour. */
export function TabIcon({
  icon: Icon,
  active,
  theme,
}: {
  icon: LucideIcon;
  active: boolean;
  theme: ThemeTokens;
}) {
  const shown = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    shown.value = withTiming(active ? 1 : 0, { duration: active ? 220 : 120 });
  }, [active, shown]);
  const activeStyle = useAnimatedStyle(() => ({ opacity: shown.value }));
  const inactiveStyle = useAnimatedStyle(() => ({ opacity: 1 - shown.value }));

  return (
    <View style={styles.tabIcon}>
      <Animated.View style={inactiveStyle}>
        <Icon
          size={ICON_SIZE}
          color={theme.color.mutedForeground}
          strokeWidth={1.9}
        />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, activeStyle]}>
        <Icon
          size={ICON_SIZE}
          color={theme.color.foreground}
          strokeWidth={2.1}
        />
      </Animated.View>
    </View>
  );
}

/** The coach opens a chat rather than a tab, so it stands out as an action: sparkles on a contrasting disc. */
export function TrefixIcon({ theme }: { theme: ThemeTokens }) {
  return (
    <View
      style={[styles.trefixDisc, { backgroundColor: theme.color.foreground }]}
    >
      <Sparkles size={16} color={theme.color.background} strokeWidth={2.1} />
    </View>
  );
}

export function ProfileIcon({
  theme,
  fallback,
  avatarUri,
  active,
}: {
  theme: ThemeTokens;
  fallback: string;
  avatarUri: string | null;
  active: boolean;
}) {
  return (
    <View
      style={[
        avatarUri ? styles.profileAvatarBadge : styles.profileBadge,
        avatarUri
          ? { opacity: active ? 1 : 0.7 }
          : {
              borderColor: theme.color.foreground,
              borderWidth: active ? 1.6 : 1,
              opacity: active ? 1 : 0.7,
            },
      ]}
    >
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={styles.profileAvatar} />
      ) : (
        <Text
          style={[
            styles.profileFallback,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.extrabold,
            },
          ]}
        >
          {fallback}
        </Text>
      )}
    </View>
  );
}
