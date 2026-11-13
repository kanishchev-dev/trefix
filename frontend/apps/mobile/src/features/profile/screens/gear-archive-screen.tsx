import { Pressable, StyleSheet, Text, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  formatSinceMonthYear,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { useToast } from "../../../shared/ui/toast";
import { BodyTitle, Meta } from "../components/profile-ui";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import { useGear, useGearMutation } from "../hooks/use-gear";
import { useUnitFormat } from "../hooks/use-unit-format";
import { gearName, profileErrorMessage } from "../lib/profile-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
  onOpen: (gearId: string) => void;
};

/** Retired gear with its stats; a pair can be returned to use. */
export function GearArchiveScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
  onOpen,
}: Props) {
  const { data: retired = [] } = useGear("retired");
  const mutation = useGearMutation();
  const { showToast } = useToast();
  const format = useUnitFormat(copy, language);
  const a = copy.profile.gearScreen.archive;

  return (
    <ProfileSubScreen
      title={a.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <View style={[styles.card, { backgroundColor: theme.color.card }]}>
          {retired.length === 0 ? (
            <View style={styles.item}>
              <Meta theme={theme} text={a.empty} />
            </View>
          ) : (
            retired.map((item, index) => (
              <Pressable
                key={item.id}
                accessibilityRole="button"
                onPress={() => onOpen(item.id)}
                style={({ pressed }) => [
                  styles.item,
                  styles.row,
                  index > 0 && {
                    borderTopWidth: 1,
                    borderTopColor: theme.color.screen,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.flex}>
                  <BodyTitle theme={theme} text={gearName(item)} />
                  <Meta
                    theme={theme}
                    text={fillTemplate(a.meta, {
                      distance: format.distance(item.distanceKm, 0),
                      count: item.workoutsCount,
                      date: item.retiredAt
                        ? formatSinceMonthYear(item.retiredAt, language)
                        : "—",
                    })}
                  />
                </View>
                <Pressable
                  accessibilityRole="button"
                  hitSlop={6}
                  onPress={() =>
                    void mutation
                      .mutateAsync({ kind: "restore", gearId: item.id })
                      .catch((error) =>
                        showToast(profileErrorMessage(error, copy)),
                      )
                  }
                  style={({ pressed }) => [
                    styles.pill,
                    { backgroundColor: theme.color.iconSurface },
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: theme.color.foreground,
                        fontFamily: theme.typography.fontFamily.sans.medium,
                      },
                    ]}
                  >
                    {a.restore}
                  </Text>
                </Pressable>
              </Pressable>
            ))
          )}
        </View>
        <Footnote text={a.footnote} theme={theme} />
      </ProfileSection>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
  },
  item: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  pill: {
    height: 28,
    paddingHorizontal: 12,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pillText: {
    fontSize: 13,
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.82,
  },
});
