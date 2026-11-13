import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  CirclePause,
  Footprints,
  Lock,
  MapPin,
  Activity,
  Ruler,
  ShieldCheck,
  Route,
} from "lucide-react-native";

import { type ThemeTokens } from "@trefix/tokens";

import type { MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { Glass } from "./glass";

export type AccessKind = "location" | "motion";

type Props = {
  kind: AccessKind | null;
  onAllow: () => void;
  onSkip: () => void;
  copy: MainCopy;
  theme: ThemeTokens;
};

/** Why the tracker asks for a permission, shown once before the system prompt. */
export function AccessScreen({ kind, onAllow, onSkip, copy, theme }: Props) {
  const insets = useSafeAreaInsets();
  const t = copy.tracker.access;
  const content = kind ? t[kind] : null;
  const iconProps = {
    size: 20,
    color: theme.color.foreground,
    strokeWidth: 1.9,
  };
  const icons =
    kind === "motion"
      ? [
          <Ruler key="a" {...iconProps} />,
          <Activity key="b" {...iconProps} />,
          <CirclePause key="c" {...iconProps} />,
        ]
      : [
          <MapPin key="a" {...iconProps} />,
          <Lock key="b" {...iconProps} />,
          <ShieldCheck key="c" {...iconProps} />,
        ];
  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const strong = {
    color: theme.color.foreground,
    fontFamily: theme.typography.fontFamily.sans.medium,
  };
  const bars = [40, 70, 52, 88, 60, 96, 66, 104, 72, 110, 64, 98, 58, 84];
  const ramp = [
    theme.color.intensity1,
    theme.color.intensity2,
    theme.color.intensity3,
  ];

  return (
    <Modal
      visible={kind !== null}
      animationType="slide"
      onRequestClose={onSkip}
    >
      {content ? (
        <View style={[styles.root, { backgroundColor: theme.color.screen }]}>
          <View
            style={[
              styles.top,
              {
                backgroundColor: theme.color.card,
                paddingTop: insets.top + 56,
              },
            ]}
          >
            <Text style={[styles.header, strong, { top: insets.top }]}>
              {t.title}
            </Text>
            <View style={[styles.art, { backgroundColor: theme.color.screen }]}>
              {kind === "motion" ? (
                <View style={styles.bars}>
                  {bars.map((height, index) => (
                    <View
                      key={index}
                      style={[
                        styles.bar,
                        {
                          height,
                          backgroundColor:
                            ramp[index % 3 === 2 ? 2 : index % 3],
                        },
                      ]}
                    />
                  ))}
                </View>
              ) : (
                <Route
                  size={72}
                  color={theme.color.mutedForeground}
                  strokeWidth={1.4}
                />
              )}
              <Glass theme={theme} style={styles.pill}>
                {kind === "motion" ? (
                  <Footprints size={16} color={theme.color.foreground} />
                ) : (
                  <MapPin size={16} color={theme.color.foreground} />
                )}
                <Text style={[styles.pillText, strong]}>{content.title}</Text>
              </Glass>
            </View>
            <Text style={[styles.title, strong]}>{content.title}</Text>
            <Text style={[styles.subtitle, muted]}>{content.subtitle}</Text>
          </View>

          <View style={[styles.list, { backgroundColor: theme.color.card }]}>
            {content.rows.map((row, index) => (
              <View
                key={row.title}
                style={[
                  styles.row,
                  index > 0 && {
                    borderTopWidth: 1,
                    borderTopColor: theme.color.screen,
                  },
                ]}
              >
                <View style={styles.rowIcon}>{icons[index]}</View>
                <View style={styles.rowText}>
                  <Text style={[styles.rowTitle, strong]}>{row.title}</Text>
                  <Text style={[styles.rowSub, muted]}>{row.text}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
            <SheetButton
              label={content.allow}
              onPress={onAllow}
              theme={theme}
              themeMode="light"
              style={styles.footerButton}
            />
            <Pressable
              accessibilityRole="button"
              onPress={onSkip}
              style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
            >
              <Text style={[styles.skipText, strong]}>{t.notNow}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: { paddingHorizontal: 16, paddingBottom: 28 },
  header: {
    position: "absolute",
    left: 60,
    right: 60,
    top: 0,
    height: 56,
    textAlign: "center",
    textAlignVertical: "center",
    fontSize: 17,
    lineHeight: 56,
  },
  art: {
    height: 190,
    borderRadius: 24,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  bars: {
    position: "absolute",
    bottom: 30,
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
  },
  bar: { width: 14, borderRadius: 3, transform: [{ skewX: "-24deg" }] },
  pill: {
    position: "absolute",
    left: 12,
    top: 12,
    height: 32,
    paddingHorizontal: 12,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pillText: { fontSize: 13, lineHeight: 18 },
  title: { marginTop: 16, fontSize: 24, lineHeight: 30, letterSpacing: -0.3 },
  subtitle: { marginTop: 4, fontSize: 15, lineHeight: 22 },
  list: {
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 24,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowIcon: { marginTop: 1 },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { fontSize: 15, lineHeight: 20 },
  rowSub: { marginTop: 2, fontSize: 13, lineHeight: 18 },
  footer: { marginTop: "auto", paddingHorizontal: 16, gap: 6 },
  footerButton: { flex: 0 },
  skip: { height: 52, alignItems: "center", justifyContent: "center" },
  skipText: { fontSize: 15, lineHeight: 20 },
  pressed: { opacity: 0.7 },
});
