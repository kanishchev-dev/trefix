import { useState, type ReactNode } from "react";
import { Linking, StyleSheet, Text, View } from "react-native";
import {
  Activity,
  CalendarDays,
  Info,
  Moon,
  ShieldCheck,
  Smile,
  Sparkles,
  Target,
  Trash2,
  History,
} from "lucide-react-native";

import {
  type CoachAdaptationMode,
  type UserPreferences,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { trackEvent } from "../../../lib/analytics";
import { clearCoachHistory } from "../../../lib/coach-api";
import { type MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { SheetTabs } from "../../../shared/ui/sheet-controls";
import { Switch } from "../../../shared/ui/switch";
import { useToast } from "../../../shared/ui/toast";
import { ProfileSheet } from "../components/profile-sheet";
import { ICON_STROKE, ROW_ICON, SelectedMark } from "../components/profile-ui";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import { QuietHoursSheet } from "../components/quiet-hours-sheet";
import { usePreferences, useUpdatePreferences } from "../hooks/use-preferences";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

const MODES: CoachAdaptationMode[] = ["auto", "confirm", "suggest"];
const TOPICS = [
  "preWorkout",
  "workoutReview",
  "wellbeingCheck",
  "weeklySummary",
  "missedSupport",
] as const satisfies ReadonlyArray<keyof UserPreferences["coachProactive"]>;
const TONES = ["soft", "neutral", "strict"] as const;
/** Icons of the "what the coach considers" rows, in their order. */
const CONSIDER_ICONS = [Activity, Target, History, CalendarDays, Smile];
const PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://trefix.app/privacy";

/** AI coach: on/off, plan adaptation, what it writes on its own, tone, quiet hours and chat history. */
export function CoachSettingsScreen({ theme, themeMode, copy, onBack }: Props) {
  const { preferences } = usePreferences();
  const update = useUpdatePreferences();
  const { showToast } = useToast();
  const [quietVisible, setQuietVisible] = useState(false);
  const [clearVisible, setClearVisible] = useState(false);
  const c = copy.profile.coach;
  const x = copy.profile.coachScreen;
  const fg = theme.color.foreground;
  const enabled = preferences.coachEnabled;
  const quiet = preferences.coachQuietHours;

  const toggle = (value: boolean) => {
    trackEvent("coach_toggled", { enabled: value });
    update.mutate({ coachEnabled: value });
  };

  const hero = (
    <View style={[styles.hero, { backgroundColor: theme.color.card }]}>
      <View style={styles.heroTop}>
        <Sparkles color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
        <Text
          numberOfLines={1}
          style={[
            styles.heroTitle,
            { color: fg, fontFamily: theme.typography.fontFamily.sans.medium },
          ]}
        >
          {x.hero}
        </Text>
        <Switch
          theme={theme}
          value={enabled}
          onValueChange={toggle}
          accessibilityLabel={c.title}
        />
      </View>
      <Text style={[styles.paragraph, styles.heroText, mutedText(theme)]}>
        {enabled ? x.heroOn : x.heroOff}
      </Text>
    </View>
  );

  if (!enabled) {
    return (
      <ProfileSubScreen
        title={c.title}
        onBack={onBack}
        theme={theme}
        themeMode={themeMode}
        footer={
          <SheetButton
            label={c.enable}
            onPress={() => toggle(true)}
            theme={theme}
            themeMode={themeMode}
          />
        }
      >
        {hero}
        <ProfileSection>
          <SectionTitle text={c.offTitle} theme={theme} />
          <View style={[styles.offList, { backgroundColor: theme.color.card }]}>
            {c.off.map((item) => (
              <View key={item} style={styles.offItem}>
                <View
                  style={[
                    styles.bullet,
                    { backgroundColor: theme.color.mutedForeground },
                  ]}
                />
                <Text
                  style={[
                    styles.paragraph,
                    styles.flex,
                    {
                      color: fg,
                      fontFamily: theme.typography.fontFamily.sans.regular,
                    },
                  ]}
                >
                  {item}
                </Text>
              </View>
            ))}
          </View>
        </ProfileSection>
      </ProfileSubScreen>
    );
  }

  return (
    <ProfileSubScreen
      title={c.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      {hero}
      <InfoBlock
        theme={theme}
        icon={<Info color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />}
        title={x.howTitle}
        text={x.how}
      />

      <ProfileSection>
        <SectionTitle text={c.adaptation} theme={theme} />
        <ListCard theme={theme} bare>
          {MODES.map((mode) => (
            <ListRow
              key={mode}
              theme={theme}
              title={c.modes[mode].title}
              description={c.modes[mode].description}
              chevron={false}
              trailing={
                preferences.coachAdaptationMode === mode ? (
                  <SelectedMark theme={theme} />
                ) : undefined
              }
              onPress={() => update.mutate({ coachAdaptationMode: mode })}
            />
          ))}
        </ListCard>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={x.proactive} theme={theme} />
        <ListCard theme={theme} bare>
          {TOPICS.map((topic) => (
            <ListRow
              key={topic}
              theme={theme}
              title={x.topics[topic].title}
              description={x.topics[topic].description}
              trailing={
                <Switch
                  theme={theme}
                  value={preferences.coachProactive[topic]}
                  accessibilityLabel={x.topics[topic].title}
                  onValueChange={(value) =>
                    update.mutate({ coachProactive: { [topic]: value } })
                  }
                />
              }
            />
          ))}
        </ListCard>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={x.tone} theme={theme} />
        <SheetTabs
          tabs={TONES.map((key) => ({ key, label: x.tones[key] }))}
          value={preferences.coachTone}
          onChange={(value) => update.mutate({ coachTone: value })}
          theme={theme}
          trackColor={theme.color.card}
          accessibilityLabel={x.tone}
        />
        <Footnote text={x.toneHints[preferences.coachTone]} theme={theme} />
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={x.considers} theme={theme} />
        <ListCard theme={theme} bare>
          {x.considerItems.map((item, index) => {
            const Icon = CONSIDER_ICONS[index] ?? Activity;
            return (
              <ListRow
                key={item.title}
                theme={theme}
                icon={
                  <Icon color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
                }
                title={item.title}
                description={item.description}
              />
            );
          })}
        </ListCard>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={c.messages} theme={theme} />
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            icon={<Moon color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />}
            title={c.quietHours}
            description={c.quietHoursDescription}
            value={
              quiet ? `${quiet.from} – ${quiet.to}` : copy.profile.summary.off
            }
            chevron={false}
            onPress={() => setQuietVisible(true)}
          />
        </ListCard>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={c.data} theme={theme} />
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            icon={
              <Trash2 color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
            }
            title={c.clearHistory}
            description={c.clearHistoryDescription}
            chevron={false}
            onPress={() => setClearVisible(true)}
          />
        </ListCard>
      </ProfileSection>

      <InfoBlock
        theme={theme}
        icon={
          <ShieldCheck color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
        }
        title={x.safetyTitle}
        text={x.safety}
        link={{
          label: x.safetyLink,
          onPress: () => void Linking.openURL(PRIVACY_URL),
        }}
      />

      <QuietHoursSheet
        visible={quietVisible}
        value={quiet}
        onSave={(value) => update.mutate({ coachQuietHours: value })}
        onClose={() => setQuietVisible(false)}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
      <ProfileSheet
        visible={clearVisible}
        onClose={() => setClearVisible(false)}
        title={c.clearTitle}
        body={c.clearBody}
        buttons={[
          {
            label: c.clearConfirm,
            variant: "destructive",
            onPress: async () => {
              await clearCoachHistory();
              showToast(c.cleared);
            },
          },
          { label: copy.profile.valueSheet.cancel, variant: "secondary" },
        ]}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

function mutedText(theme: ThemeTokens) {
  return {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
}

/** Icon, title and a paragraph straight on the page (no card). */
function InfoBlock({
  theme,
  icon,
  title,
  text,
  link,
}: {
  theme: ThemeTokens;
  icon: ReactNode;
  title: string;
  text: string;
  link?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.info}>
      <View style={styles.infoIcon}>{icon}</View>
      <View style={[styles.flex, styles.infoText]}>
        <Text
          numberOfLines={1}
          style={[
            styles.infoTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {title}
        </Text>
        <Text style={[styles.paragraph, mutedText(theme)]}>
          {text}
          {link ? (
            <>
              {" "}
              <Text
                accessibilityRole="link"
                onPress={link.onPress}
                style={[styles.link, { color: theme.color.foreground }]}
              >
                {link.label}
              </Text>
              .
            </>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 24,
    padding: 16,
    gap: 6,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  heroTitle: {
    flex: 1,
    fontSize: 17,
    lineHeight: 22,
  },
  heroText: {
    paddingLeft: 34,
  },
  paragraph: {
    fontSize: 13,
    lineHeight: 18,
  },
  flex: {
    flex: 1,
    minWidth: 0,
  },
  offList: {
    borderRadius: 24,
    padding: 16,
    gap: 12,
  },
  offItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  bullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  info: {
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
  },
  infoIcon: {
    marginTop: 1,
  },
  infoText: {
    gap: 4,
  },
  infoTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  link: {
    textDecorationLine: "underline",
  },
});
