import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check } from "lucide-react-native";

import {
  getMobileThemeTokens,
  type ThemeMode,
  type ThemeTokens,
} from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import { Pill, SectionTitle } from "../../../shared/ui/list-card";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../../profile/components/profile-sub-screen";
import { useAppSettings } from "../context/app-settings-context";

export type ThemePreference = "system" | "dark" | "light";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

const OPTIONS: ThemePreference[] = ["light", "dark", "system"];
/** Accent colours coming later; shown dimmed until then. */
const ACCENTS = ["#2563eb", "#16a34a", "#ea580c", "#7c3aed", "#db2777"];

/** Light, dark or follow the phone — picked from three phone previews; accent colour is "soon". */
export function ThemeSettingsScreen({ theme, themeMode, copy, onBack }: Props) {
  const { userTheme, selectTheme } = useAppSettings();
  const t = copy.profile.themeScreen;
  const fg = theme.color.foreground;

  return (
    <ProfileSubScreen
      title={t.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={t.appearance} theme={theme} />
        <View
          accessibilityRole="radiogroup"
          style={[styles.modes, { backgroundColor: theme.color.card }]}
        >
          {OPTIONS.map((option) => {
            const selected = userTheme === option;
            return (
              <Pressable
                key={option}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={copy.profile.settings.themes[option]}
                onPress={() => selectTheme(option)}
                style={styles.mode}
              >
                <View
                  style={[
                    styles.phone,
                    {
                      borderColor: selected ? fg : theme.color.border,
                      borderWidth: selected ? 2 : 1,
                    },
                  ]}
                >
                  {option === "system" ? (
                    <>
                      <MiniScreen mode="light" />
                      <View style={styles.half}>
                        <View style={styles.halfInner}>
                          <MiniScreen mode="dark" />
                        </View>
                      </View>
                    </>
                  ) : (
                    <MiniScreen mode={option} />
                  )}
                </View>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.label,
                    {
                      color: fg,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {copy.profile.settings.themes[option]}
                </Text>
                <View
                  style={[
                    styles.radio,
                    selected
                      ? { backgroundColor: fg }
                      : { borderWidth: 1.5, borderColor: theme.color.border },
                  ]}
                >
                  {selected ? (
                    <Check color={theme.color.card} size={13} strokeWidth={3} />
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
        <Footnote text={t.hint} theme={theme} />
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={t.accent} theme={theme} />
        <View style={[styles.accent, { backgroundColor: theme.color.card }]}>
          <View style={styles.accentHead}>
            <View style={styles.flex}>
              <Text
                numberOfLines={1}
                style={[
                  styles.accentTitle,
                  {
                    color: fg,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {t.accentBw}
              </Text>
              <Text
                numberOfLines={1}
                style={[
                  styles.accentDescription,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {t.accentDescription}
              </Text>
            </View>
            <Pill theme={theme} text={t.soon} />
          </View>
          <View style={styles.swatches} accessibilityElementsHidden>
            <View
              style={[
                styles.swatch,
                styles.swatchSelected,
                { borderColor: fg },
              ]}
            >
              <View style={styles.bw}>
                <View style={[styles.bwHalf, { backgroundColor: "#09090b" }]} />
                <View style={[styles.bwHalf, { backgroundColor: "#fafafa" }]} />
              </View>
            </View>
            {ACCENTS.map((color) => (
              <View
                key={color}
                style={[
                  styles.swatch,
                  styles.swatchOff,
                  { backgroundColor: color },
                ]}
              />
            ))}
          </View>
        </View>
      </ProfileSection>
    </ProfileSubScreen>
  );
}

/** Tiny profile screen in the colours of a theme. */
function MiniScreen({ mode }: { mode: ThemeMode }) {
  const c = getMobileThemeTokens(mode).color;
  const muted = mode === "dark" ? "#3f3f46" : "#d4d4d8";
  return (
    <View style={[styles.mini, { backgroundColor: c.screen }]}>
      <View style={[styles.miniAvatar, { backgroundColor: c.card }]} />
      <View style={[styles.miniName, { backgroundColor: c.foreground }]} />
      <View style={[styles.miniSub, { backgroundColor: muted }]} />
      {[2, 3].map((lines) => (
        <View
          key={lines}
          style={[styles.miniCard, { backgroundColor: c.card }]}
        >
          <View style={[styles.miniLine, { backgroundColor: c.foreground }]} />
          {Array.from({ length: lines - 1 }, (_, index) => (
            <View
              key={index}
              style={[
                styles.miniLine,
                styles.miniLineShort,
                { backgroundColor: muted },
              ]}
            />
          ))}
        </View>
      ))}
      <View style={[styles.miniTab, { backgroundColor: c.card }]}>
        <View style={[styles.miniDot, { backgroundColor: c.foreground }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  modes: {
    borderRadius: 24,
    flexDirection: "row",
    paddingTop: 20,
    paddingBottom: 18,
    paddingHorizontal: 12,
  },
  mode: {
    flex: 1,
    alignItems: "center",
    gap: 10,
  },
  phone: {
    width: 84,
    height: 168,
    borderRadius: 18,
    overflow: "hidden",
  },
  half: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: "50%",
    right: 0,
    overflow: "hidden",
  },
  halfInner: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 84,
    right: 0,
  },
  label: {
    fontSize: 14,
    lineHeight: 18,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  mini: {
    ...StyleSheet.absoluteFill,
    paddingTop: 22,
    paddingHorizontal: 7,
    gap: 5,
  },
  miniAvatar: {
    alignSelf: "center",
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  miniName: {
    alignSelf: "center",
    width: 34,
    height: 4,
    borderRadius: 2,
  },
  miniSub: {
    alignSelf: "center",
    width: 24,
    height: 3,
    borderRadius: 2,
    marginBottom: 3,
  },
  miniCard: {
    borderRadius: 7,
    padding: 5,
    gap: 4,
  },
  miniLine: {
    height: 3,
    borderRadius: 2,
    width: "60%",
  },
  miniLineShort: {
    width: "80%",
  },
  miniTab: {
    position: "absolute",
    left: 8,
    right: 8,
    bottom: 7,
    height: 13,
    borderRadius: 7,
  },
  miniDot: {
    position: "absolute",
    right: 4,
    top: 3,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  accent: {
    borderRadius: 24,
    padding: 16,
    gap: 14,
  },
  accentHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  accentTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  accentDescription: {
    fontSize: 13,
    lineHeight: 18,
  },
  swatches: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  swatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  swatchSelected: {
    borderWidth: 2,
    padding: 2,
  },
  swatchOff: {
    opacity: 0.45,
  },
  bw: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
    flexDirection: "row",
    transform: [{ rotate: "45deg" }],
  },
  bwHalf: {
    flex: 1,
  },
});
