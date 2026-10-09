import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Check, Moon, Sparkles, Trash2, X } from "lucide-react-native";

import { type CoachAdaptationMode } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { trackEvent } from "../../../lib/analytics";
import { clearCoachHistory } from "../../../lib/coach-api";
import { type MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { IconCircle, ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { useToast } from "../../../shared/ui/toast";
import { ConfirmSheet } from "../../plans/components/confirm-sheet";
import { ProfileSection, ProfileSubScreen } from "../components/profile-sub-screen";
import { QuietHoursSheet } from "../components/quiet-hours-sheet";
import { usePreferences, useUpdatePreferences } from "../hooks/use-preferences";
import { profileErrorMessage } from "../lib/profile-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

const MODES: CoachAdaptationMode[] = ["auto", "confirm", "suggest"];

/** D2 — turn the coach on/off, how it adapts the plan, quiet hours and chat history. */
export function CoachSettingsScreen({ theme, themeMode, copy, onBack }: Props) {
  const { preferences } = usePreferences();
  const update = useUpdatePreferences();
  const { showToast } = useToast();
  const [quietVisible, setQuietVisible] = useState(false);
  const [clearVisible, setClearVisible] = useState(false);
  const c = copy.profile.coach;
  const enabled = preferences.coachEnabled;

  const toggle = (value: boolean) => {
    trackEvent("coach_toggled", { enabled: value });
    update.mutate({ coachEnabled: value });
  };

  const quiet = preferences.coachQuietHours;

  return (
    <ProfileSubScreen title={c.title} onBack={onBack} theme={theme} themeMode={themeMode}>
      <ListCard theme={theme}>
        <ListRow
          theme={theme}
          icon={<Sparkles color={theme.color.foreground} size={20} />}
          title={c.name}
          description={enabled ? c.statusOn : c.statusOff}
          trailing={<Switch theme={theme} value={enabled} onValueChange={toggle} accessibilityLabel={c.title} />}
        />
      </ListCard>

      {enabled ? (
        <>
          <ProfileSection>
            <SectionTitle text={c.adaptation} theme={theme} />
            <ListCard theme={theme}>
              {MODES.map((mode) => (
                <ListRow
                  key={mode}
                  theme={theme}
                  title={c.modes[mode].title}
                  description={c.modes[mode].description}
                  chevron={false}
                  trailing={
                    preferences.coachAdaptationMode === mode ? (
                      <Check color={theme.color.foreground} size={18} strokeWidth={2.4} />
                    ) : undefined
                  }
                  onPress={() => {
                    trackEvent("coach_mode_changed", { mode });
                    update.mutate({ coachAdaptationMode: mode });
                  }}
                />
              ))}
            </ListCard>
          </ProfileSection>

          <ProfileSection>
            <SectionTitle text={c.messages} theme={theme} />
            <ListCard theme={theme}>
              <ListRow
                theme={theme}
                icon={<Moon color={theme.color.foreground} size={20} />}
                title={c.quietHours}
                description={c.quietHoursDescription}
                value={quiet ? `${quiet.from} – ${quiet.to}` : copy.profile.summary.off}
                onPress={() => setQuietVisible(true)}
              />
            </ListCard>
          </ProfileSection>

          <ProfileSection>
            <SectionTitle text={c.data} theme={theme} />
            <ListCard theme={theme}>
              <ListRow
                theme={theme}
                icon={<Trash2 color={theme.color.foreground} size={20} />}
                title={c.clearHistory}
                description={c.clearHistoryDescription}
                chevron={false}
                onPress={() => setClearVisible(true)}
              />
            </ListCard>
          </ProfileSection>
        </>
      ) : (
        <>
          <View style={[styles.offCard, { backgroundColor: theme.color.card }]}>
            <Text style={[styles.offTitle, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
              {c.offTitle}
            </Text>
            {c.off.map((line, index) => {
              const Icon = index < 2 ? X : Check;
              return (
                <View key={line} style={styles.offItem}>
                  <IconCircle theme={theme} size={28}>
                    <Icon color={theme.color.mutedForeground} size={14} strokeWidth={2.4} />
                  </IconCircle>
                  <Text style={[styles.offText, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
                    {line}
                  </Text>
                </View>
              );
            })}
          </View>
          <SheetButton label={c.enable} onPress={() => toggle(true)} theme={theme} themeMode={themeMode} />
        </>
      )}

      <QuietHoursSheet
        visible={quietVisible}
        value={quiet}
        onSave={(value) => update.mutate({ coachQuietHours: value })}
        onClose={() => setQuietVisible(false)}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
      <ConfirmSheet
        visible={clearVisible}
        title={c.clearTitle}
        body={c.clearBody}
        confirmLabel={c.clearConfirm}
        cancelLabel={copy.profile.valueSheet.cancel}
        onConfirm={async () => {
          await clearCoachHistory();
        }}
        onClose={(confirmed) => {
          setClearVisible(false);
          if (confirmed) showToast(c.cleared);
        }}
        errorMessage={(error) => profileErrorMessage(error, copy)}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  offCard: {
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  offTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  offItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  offText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
});
