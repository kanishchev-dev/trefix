import { useEffect, useState, type ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";
import { GlassView } from "expo-glass-effect";

import { isDarkTheme, type ThemeTokens } from "@trefix/tokens";

type Props = {
  theme: ThemeTokens;
  style?: StyleProp<ViewStyle>;
  interactive?: boolean;
  children?: ReactNode;
};

/**
 * Liquid Glass surface of the tracker chrome (status pill, lock and voice
 * buttons, map stats). Same recipe as the header buttons: the glass is mounted
 * a moment later, a plain chrome fill stands in until then.
 */
export function Glass({ theme, style, interactive = false, children }: Props) {
  const [mounted, setMounted] = useState(false);
  const dark = isDarkTheme(theme);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!mounted) {
    return (
      <View
        style={[
          {
            borderWidth: 0.5,
            borderColor: theme.color.chromeBorder,
            backgroundColor: theme.color.chromeFill,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }
  return (
    <GlassView
      key={dark ? "dark" : "light"}
      colorScheme={dark ? "dark" : "light"}
      glassEffectStyle="regular"
      isInteractive={interactive}
      tintColor={theme.color.chromeTint}
      style={[
        {
          borderWidth: 0.5,
          borderColor: theme.color.chromeGlassBorder,
          backgroundColor: theme.color.chromeFill,
        },
        style,
      ]}
    >
      {children}
    </GlassView>
  );
}
