import { useEffect, useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";

import {
  type AthleteProfileUpdate,
  type ExperienceLevel,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { trackEvent } from "../../../lib/analytics";
import { fillTemplate, type MainCopy } from "../../../locales";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { useToast } from "../../../shared/ui/toast";
import { SelectedMark } from "../components/profile-ui";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "../components/profile-value-sheet";
import {
  useAthleteProfile,
  useUpdateAthleteProfile,
} from "../hooks/use-athlete-profile";
import { profileErrorMessage } from "../lib/profile-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

const LIMITATIONS_MAX = 500;
/** Pause after typing before the limitations text is saved. */
const AUTOSAVE_DELAY_MS = 800;
const LEVELS: ExperienceLevel[] = ["beginner", "intermediate", "advanced"];

/** Level, running since, injuries and limitations; every change is saved right away. */
export function ExperienceScreen({ theme, themeMode, copy, onBack }: Props) {
  const { data: athlete } = useAthleteProfile();
  const update = useUpdateAthleteProfile();
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const [text, setText] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const e = copy.profile.experience;
  const x = copy.profile.experienceScreen;

  useEffect(() => {
    setText(athlete?.limitations ?? "");
  }, [athlete?.limitations]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const save = async (patch: AthleteProfileUpdate) => {
    try {
      const before = athlete;
      const after = await update.mutateAsync(patch);
      trackEvent("profile_field_updated", {
        field: Object.keys(patch).join(","),
        source: "manual",
      });
      // The server lowers the schedule when the level goes down; say what changed.
      if (before?.allowDoubles && after && !after.allowDoubles) {
        showToast(copy.profile.scheduleScreen.doublesReset);
      } else if (
        before &&
        after &&
        after.sessionsPerWeek < before.sessionsPerWeek
      ) {
        showToast(
          fillTemplate(copy.profile.scheduleScreen.lowered, {
            count: after.sessionsPerWeek,
          }),
        );
      }
    } catch (error) {
      showToast(profileErrorMessage(error, copy));
    }
  };

  if (!athlete) {
    return (
      <ProfileSubScreen
        title={x.title}
        onBack={onBack}
        theme={theme}
        themeMode={themeMode}
      >
        {null}
      </ProfileSubScreen>
    );
  }

  const year = new Date().getFullYear();
  const noLimitations = athlete.limitations === "";

  const changeText = (value: string) => {
    setText(value);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const trimmed = value.trim();
      if (trimmed !== (athlete.limitations ?? "").trim()) {
        void save({ limitations: trimmed.length > 0 ? trimmed : null });
      }
    }, AUTOSAVE_DELAY_MS);
  };

  return (
    <ProfileSubScreen
      title={x.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={e.level} theme={theme} />
        <ListCard theme={theme} bare>
          {LEVELS.map((level) => (
            <ListRow
              key={level}
              theme={theme}
              title={copy.profile.levels[level]}
              description={x.levelDescriptions[level]}
              trailing={
                athlete.experienceLevel === level ? (
                  <SelectedMark theme={theme} />
                ) : undefined
              }
              chevron={false}
              onPress={() => {
                if (athlete.experienceLevel !== level)
                  void save({ experienceLevel: level });
              }}
            />
          ))}
        </ListCard>
      </ProfileSection>

      <ListCard theme={theme} bare>
        <ListRow
          theme={theme}
          title={e.since}
          value={
            athlete.runningSinceYear
              ? String(athlete.runningSinceYear)
              : copy.profile.summary.notSet
          }
          chevron={false}
          onPress={() =>
            setSheet({
              kind: "number",
              title: e.since,
              value: athlete.runningSinceYear ?? null,
              fallback: year - 2,
              min: 1960,
              max: year,
              unit: x.yearUnit,
              formatValue: (value) => String(value),
              clearable: true,
              onSave: async (value) => {
                await update.mutateAsync({ runningSinceYear: value });
              },
            })
          }
        />
      </ListCard>

      <ProfileSection>
        <SectionTitle text={e.limitations} theme={theme} />
        {!noLimitations ? (
          <View style={[styles.area, { backgroundColor: theme.color.card }]}>
            <TextInput
              multiline
              maxLength={LIMITATIONS_MAX}
              value={text}
              onChangeText={changeText}
              placeholder={e.limitationsPlaceholder}
              placeholderTextColor={theme.color.mutedForeground}
              accessibilityLabel={e.limitations}
              style={[
                styles.input,
                {
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            />
          </View>
        ) : null}
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            title={e.none}
            description={x.noneDescription}
            trailing={
              <Switch
                theme={theme}
                value={noLimitations}
                accessibilityLabel={e.none}
                onValueChange={(value) =>
                  void save({ limitations: value ? "" : null })
                }
              />
            }
          />
        </ListCard>
        <Footnote text={x.footnote} theme={theme} />
      </ProfileSection>

      <ProfileValueSheet
        config={sheet}
        onClose={() => setSheet(null)}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  area: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  input: {
    minHeight: 88,
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: "top",
    padding: 0,
  },
});
