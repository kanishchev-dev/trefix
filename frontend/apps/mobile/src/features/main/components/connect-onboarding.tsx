import { type ReactNode } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import {
  Activity,
  Footprints,
  Link2,
  Moon,
  Weight,
  type LucideIcon,
} from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  IntegrationLogo,
  type IntegrationLogoProvider,
} from "../../../shared/ui/integration-logo";

export type ConnectBenefit = { title: string; description: string };

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  provider: IntegrationLogoProvider;
  title: string;
  lede: string;
  /** Four labels floating around the logos. */
  chips: string[];
  benefits: ConnectBenefit[];
  /** Icons of the benefits, in order. */
  benefitIcons: LucideIcon[];
  /** The connect button; Strava requires its official one. */
  cta: ReactNode;
  fine: string;
  /** Extra content between the benefits and the button (hints, errors). */
  children?: ReactNode;
};

const APP_ICON = require("../../../../assets/trefix-appicon.png");
const CHIP_ICONS: LucideIcon[] = [Activity, Footprints, Moon, Weight];
const CHIP_PLACES = [
  { left: 18, top: 46 },
  { right: 22, top: 70 },
  { left: 34, bottom: 54 },
  { right: 30, bottom: 34 },
] as const;
const RINGS = [300, 400, 520];

/** First screen of connecting a service: Trefix ↔ service, what it brings, the connect button. */
export function ConnectOnboarding({
  theme,
  themeMode,
  provider,
  title,
  lede,
  chips,
  benefits,
  benefitIcons,
  cta,
  fine,
  children,
}: Props) {
  const fg = theme.color.foreground;
  const muted = theme.color.mutedForeground;
  return (
    <View style={styles.root}>
      <View
        style={styles.hero}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        {RINGS.map((size) => (
          <View
            key={size}
            style={[
              styles.ring,
              {
                width: size,
                height: size,
                marginLeft: -size / 2,
                marginTop: -size / 2,
                borderRadius: size / 2,
                borderColor: theme.color.border,
              },
            ]}
          />
        ))}
        <View style={styles.pair}>
          <Image source={APP_ICON} style={styles.appIcon} />
          <View style={[styles.dash, { borderColor: muted }]} />
          <IntegrationLogo
            provider={provider}
            themeMode={themeMode}
            size={84}
          />
        </View>
        <View style={[styles.link, { backgroundColor: theme.color.card }]}>
          <Link2 color={fg} size={18} strokeWidth={2.2} />
        </View>
        {chips.slice(0, 4).map((chip, index) => {
          const Icon = CHIP_ICONS[index] ?? Activity;
          return (
            <View
              key={chip}
              style={[
                styles.chip,
                CHIP_PLACES[index],
                { backgroundColor: theme.color.card },
              ]}
            >
              <Icon color={fg} size={14} strokeWidth={2.2} />
              <Text
                style={[
                  styles.chipText,
                  {
                    color: fg,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {chip}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.intro}>
        <Text
          style={[
            styles.title,
            { color: fg, fontFamily: theme.typography.fontFamily.sans.medium },
          ]}
        >
          {title}
        </Text>
        <Text
          style={[
            styles.lede,
            {
              color: muted,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {lede}
        </Text>
      </View>

      <View style={[styles.benefits, { backgroundColor: theme.color.card }]}>
        {benefits.map((benefit, index) => {
          const Icon = benefitIcons[index] ?? Activity;
          return (
            <View key={benefit.title} style={styles.benefit}>
              <View
                style={[
                  styles.benefitIcon,
                  { backgroundColor: theme.color.iconSurface },
                ]}
              >
                <Icon color={fg} size={18} strokeWidth={2} />
              </View>
              <View style={styles.flex}>
                <Text
                  style={[
                    styles.benefitTitle,
                    {
                      color: fg,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {benefit.title}
                </Text>
                <Text
                  style={[
                    styles.benefitText,
                    {
                      color: muted,
                      fontFamily: theme.typography.fontFamily.sans.regular,
                    },
                  ]}
                >
                  {benefit.description}
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      {children}

      <View style={styles.cta}>
        {cta}
        <Text
          style={[
            styles.fine,
            {
              color: muted,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {fine}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    gap: 24,
  },
  hero: {
    height: 300,
    marginHorizontal: -16,
    overflow: "hidden",
  },
  ring: {
    position: "absolute",
    left: "50%",
    top: "50%",
    borderWidth: 1,
  },
  pair: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 208,
    height: 84,
    marginLeft: -104,
    marginTop: -42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  appIcon: {
    width: 84,
    height: 84,
    borderRadius: 20,
  },
  dash: {
    position: "absolute",
    left: 74,
    right: 74,
    top: 42,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    opacity: 0.5,
  },
  link: {
    position: "absolute",
    left: "50%",
    top: "50%",
    width: 36,
    height: 36,
    marginLeft: -18,
    marginTop: -18,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  chip: {
    position: "absolute",
    height: 32,
    paddingLeft: 10,
    paddingRight: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
  chipText: {
    fontSize: 13,
    lineHeight: 18,
  },
  intro: {
    gap: 10,
    paddingHorizontal: 12,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.6,
    textAlign: "center",
  },
  lede: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  benefits: {
    borderRadius: 24,
    padding: 20,
    gap: 18,
  },
  benefit: {
    flexDirection: "row",
    gap: 14,
  },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: {
    flex: 1,
    gap: 2,
  },
  benefitTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  benefitText: {
    fontSize: 13,
    lineHeight: 18,
  },
  cta: {
    alignItems: "center",
    gap: 12,
    paddingBottom: 16,
  },
  fine: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 12,
  },
});
