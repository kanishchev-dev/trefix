import { StyleSheet, View, type ColorValue, type ViewProps } from "react-native";
import {
  GlassView,
  GlassContainer as ExpoGlassContainer,
  isGlassEffectAPIAvailable,
  isLiquidGlassAvailable,
  type GlassColorScheme,
  type GlassEffectStyleConfig,
  type GlassStyle,
  type GlassContainerProps,
} from "expo-glass-effect";

type Props = ViewProps & {
  interactive?: boolean;
  glassEffectStyle?: GlassStyle | GlassEffectStyleConfig;
  tintColor?: ColorValue;
  colorScheme?: GlassColorScheme;
};

export function ExpoGlassSurface({
  children,
  interactive = false,
  glassEffectStyle = "regular",
  tintColor,
  colorScheme = "auto",
  style,
  ...props
}: Props) {
  if (!isLiquidGlassAvailable() || !isGlassEffectAPIAvailable()) {
    return (
      <View
        style={[
          styles.fallback,
          style
        ]}
        {...props}
      >
        {children}
      </View>
    );
  }

  return (
    <GlassView
      {...props}
      isInteractive={interactive}
      glassEffectStyle={glassEffectStyle}
      tintColor={tintColor}
      colorScheme={colorScheme}
      style={[styles.base, style]}
    >
      {children}
    </GlassView>
  );
}

export function GlassContainer({ children, style, ...props }: GlassContainerProps) {
  if (!isLiquidGlassAvailable() || !isGlassEffectAPIAvailable()) {
    return <View style={style} {...props}>{children}</View>;
  }

  return (
    <ExpoGlassContainer style={style} {...props}>
      {children}
    </ExpoGlassContainer>
  );
}

const styles = StyleSheet.create({
  base: {
    overflow: "hidden",
  },
  fallback: {
    overflow: "hidden",
    borderRadius: 18,
  },
});
