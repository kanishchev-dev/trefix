import { useEffect, useState } from "react";
import { StyleSheet, TextInput } from "react-native";

import {
  type AthleteProfileUpdate,
  type ExperienceLevel,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Segmented } from "@workspace/ui-native";

import { trackEvent } from "../../../lib/analytics";
import { type MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { useToast } from "../../../shared/ui/toast";
import {
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

/** Level, running since, injuries and limitations. */
export function ExperienceScreen({ theme, themeMode, copy, onBack }: Props) {
  const { data: athlete } = useAthleteProfile();
  const update = useUpdateAthleteProfile();
  const { showToast } = useToast();
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const [text, setText] = useState("");
  const e = copy.profile.experience;

  useEffect(() => {
    setText(athlete?.limitations ?? "");
  }, [athlete?.limitations]);

  const save = async (patch: AthleteProfileUpdate) => {
    try {
      await update.mutateAsync(patch);
      trackEvent("profile_field_updated", {
        field: Object.keys(patch).join(","),
        source: "manual",
      });
    } catch (error) {
      showToast(profileErrorMessage(error, copy));
      throw error;
    }
  };

  if (!athlete) {
    return (
      <ProfileSubScreen
        title={e.title}
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
  const dirty =
    text.trim() !== (athlete.limitations ?? "").trim() &&
    text.trim().length > 0;

  return (
    <ProfileSubScreen
      title={e.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={e.level} theme={theme} />
        <Segmented
          segments={(["beginner", "intermediate", "advanced"] as const).map(
            (value) => ({
              value,
              label: copy.profile.levels[value],
            }),
          )}
          value={athlete.experienceLevel as ExperienceLevel}
          onChange={(value) =>
            void save({ experienceLevel: value }).catch(() => undefined)
          }
          theme={theme}
          themeMode={themeMode}
        />
      </ProfileSection>

      <ListCard theme={theme}>
        <ListRow
          theme={theme}
          title={e.since}
          value={
            athlete.runningSinceYear
              ? String(athlete.runningSinceYear)
              : copy.profile.summary.notSet
          }
          onPress={() =>
            setSheet({
              kind: "number",
              title: e.since,
              value: athlete.runningSinceYear ?? null,
              fallback: year - 2,
              min: 1960,
              max: year,
              majorEvery: 5,
              labelEvery: 10,
              formatValue: (value) => String(value),
              clearable: true,
              onSave: (value) => save({ runningSinceYear: value }),
            })
          }
        />
      </ListCard>

      <ProfileSection>
        <SectionTitle text={e.limitations} theme={theme} />
        <ListCard theme={theme}>
          <ListRow
            theme={theme}
            title={e.none}
            trailing={
              <Switch
                theme={theme}
                value={noLimitations}
                accessibilityLabel={e.none}
                onValueChange={(value) =>
                  void save({ limitations: value ? "" : null }).catch(
                    () => undefined,
                  )
                }
              />
            }
          />
        </ListCard>
        {!noLimitations ? (
          <>
            <TextInput
              multiline
              maxLength={LIMITATIONS_MAX}
              value={text}
              onChangeText={setText}
              placeholder={e.limitationsPlaceholder}
              placeholderTextColor={theme.color.mutedForeground}
              style={[
                styles.input,
                {
                  backgroundColor: theme.color.card,
                  color: theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.regular,
                },
              ]}
            />
            <SheetButton
              label={e.save}
              disabled={!dirty}
              pending={update.isPending}
              onPress={() =>
                void save({ limitations: text.trim() }).catch(() => undefined)
              }
              theme={theme}
              themeMode={themeMode}
            />
          </>
        ) : null}
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
  input: {
    minHeight: 120,
    borderRadius: 24,
    padding: 16,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: "top",
  },
});
