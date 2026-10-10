import { useMemo, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Activity,
  Bell,
  Footprints,
  Gauge,
  HeartPulse,
  KeyRound,
  Languages,
  LogOut,
  Palette,
  Ruler as RulerIcon,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
  CalendarDays,
} from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import appConfig from "../../../../app.json";
import { fillTemplate, formatProfileJoinedDate, type AppLanguage, type MainCopy } from "../../../locales";
import { trackEvent } from "../../../lib/analytics";
import { resolveBackendMediaUrl } from "../../../lib/backend-url";
import { ListCard, ListRow, Pill, SectionTitle, SourceBadge } from "../../../shared/ui/list-card";
import { HeaderLogo, HeaderQrButton, HeaderTextButton } from "../../main/components/header";
import { QrDialog } from "../../main/components/qr-dialog";
import { SectionLayout } from "../../main/components/section-layout";
import { useHeaderOptions } from "../../main/context/header-context";
import { useStravaIntegration } from "../../main/hooks/use-integrations";
import { useProfile } from "../../main/hooks/use-profile";
import { DeleteAccountSheet } from "../components/delete-account-sheet";
import { useAthleteProfile } from "../hooks/use-athlete-profile";
import { useGear } from "../hooks/use-gear";
import { usePreferences } from "../hooks/use-preferences";
import {
  bodySummary,
  createFormatter,
  experienceSummary,
  formatAgo,
  gearName,
  heartSummary,
  heroSubtitle,
  missingGroups,
  mostWorn,
  scheduleSummary,
} from "../lib/profile-format";
import { type ProfileNavigate } from "../profile-routes";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  userLanguage: AppLanguage;
  userTheme: "system" | "dark" | "light";
  onLogout: () => void;
  onEdit: () => void;
  onOpenNotifications: () => void;
  onOpenLanguage: () => void;
  onOpenTheme: () => void;
  onOpenIntegrations: () => void;
  onOpenStrava: () => void;
  onNavigate: ProfileNavigate;
  /** The account is deleted: end the session. */
  onAccountDeleted: () => void;
};

const COMPLETENESS_CARD_THRESHOLD = 70;
const ICON = 20;

/** Profile hub: who the athlete is, links to every group of inputs and app settings. */
export function ProfileScreen({
  theme,
  themeMode,
  copy,
  userLanguage,
  userTheme,
  onLogout,
  onEdit,
  onOpenNotifications,
  onOpenLanguage,
  onOpenTheme,
  onOpenIntegrations,
  onOpenStrava,
  onNavigate,
  onAccountDeleted,
}: Props) {
  const { data: user, isLoading } = useProfile();
  const { data: athlete } = useAthleteProfile();
  const { data: gear } = useGear("active");
  const { preferences } = usePreferences();
  const { data: strava } = useStravaIntegration();
  const [qrVisible, setQrVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);

  const p = copy.profile;
  const format = useMemo(() => createFormatter(copy, userLanguage, preferences), [copy, userLanguage, preferences]);
  const missing = missingGroups(athlete);
  const stravaConnected = Boolean(strava && strava.status !== "disconnected");
  const percent = athlete?.completeness?.percent ?? 100;
  const worn = mostWorn(gear);
  const iconColor = theme.color.foreground;
  const appVersion = appConfig.expo.version ?? "1.0.0";
  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  useHeaderOptions(
    {
      leftAction: <HeaderQrButton theme={theme} themeMode={themeMode} onPress={() => setQrVisible(true)} />,
      centerContent: <HeaderLogo source={logoSource} />,
      rightAction: (
        <HeaderTextButton
          theme={theme}
          themeMode={themeMode}
          accessibilityLabel={p.hero.edit}
          label={p.hero.edit}
          onPress={onEdit}
        />
      ),
      variant: "default",
      bottomContent: null,
    },
    [theme, themeMode, logoSource, p.hero.edit, onEdit],
  );

  const open = (section: Parameters<ProfileNavigate>[0]) => {
    trackEvent("profile_section_opened", { section: section.kind });
    onNavigate(section);
  };

  const subtitle = heroSubtitle(athlete, copy);
  const joined = formatProfileJoinedDate(user?.createdAt ? new Date(user.createdAt) : new Date(), userLanguage);

  return (
    <SectionLayout hasHeader={false} scrollable theme={theme} themeMode={themeMode}>
      <View style={styles.stack}>
        <View style={styles.hero}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={p.hero.changePhoto}
            onPress={onEdit}
            style={[styles.avatar, { backgroundColor: theme.color.card }]}
          >
            {user?.avatarUrl ? (
              <Image source={{ uri: resolveBackendMediaUrl(user.avatarUrl) ?? undefined }} style={styles.avatarImage} />
            ) : (
              <UserRound color={theme.color.foreground} size={34} strokeWidth={1.9} />
            )}
          </Pressable>
          <Text style={[styles.name, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
            {isLoading ? "…" : `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.subtitle, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}
          >
            {subtitle ?? joined}
          </Text>
        </View>

        {athlete && percent < COMPLETENESS_CARD_THRESHOLD ? (
          <ListCard theme={theme}>
            <ListRow
              theme={theme}
              icon={<Sparkles color={iconColor} size={ICON} />}
              title={p.completeness.title}
              description={fillTemplate(p.completeness.description, { percent })}
              trailing={<Pill theme={theme} text={p.completeness.action} />}
              chevron={false}
              onPress={() => {
                const step = missing.has("body") ? 1 : missing.has("heart") ? 2 : missing.has("experience") ? 3 : 1;
                open({ kind: "profile-wizard", step });
              }}
            />
          </ListCard>
        ) : null}

        {strava && !stravaConnected ? (
          <ListCard theme={theme}>
            <ListRow
              theme={theme}
              icon={<Activity color={iconColor} size={ICON} />}
              title={p.stravaCard.title}
              description={p.stravaCard.description}
              trailing={<Pill theme={theme} text={p.stravaCard.action} />}
              chevron={false}
              onPress={onOpenStrava}
            />
          </ListCard>
        ) : null}

        {user?.features?.showReferral ? (
          <ListCard theme={theme}>
            <ListRow
              theme={theme}
              icon={<Share2 color={iconColor} size={ICON} />}
              title={p.referral.title}
              value={user.referralCode ?? undefined}
              onPress={() => setQrVisible(true)}
            />
          </ListCard>
        ) : null}

        <View style={styles.section}>
          <SectionTitle text={p.sections.athlete} theme={theme} />
          <ListCard theme={theme}>
            <ListRow
              theme={theme}
              icon={<RulerIcon color={iconColor} size={ICON} />}
              title={p.rows.body}
              description={athlete ? bodySummary(athlete, copy, userLanguage, format) : undefined}
              dot={missing.has("body")}
              trailing={
                athlete?.fieldSources?.weightKg?.source === "strava" ? (
                  <SourceBadge theme={theme} />
                ) : athlete?.fieldSources?.weightKg?.source === "apple_health" ||
                  athlete?.fieldSources?.weightKg?.source === "health_connect" ? (
                  <SourceBadge theme={theme} label="H" />
                ) : undefined
              }
              onPress={() => open({ kind: "profile-body" })}
            />
            <ListRow
              theme={theme}
              icon={<HeartPulse color={iconColor} size={ICON} />}
              title={p.rows.heart}
              description={athlete ? heartSummary(athlete, copy) : undefined}
              dot={missing.has("heart")}
              onPress={() => open({ kind: "profile-heart" })}
            />
            <ListRow
              theme={theme}
              icon={<CalendarDays color={iconColor} size={ICON} />}
              title={p.rows.schedule}
              description={athlete ? scheduleSummary(athlete, copy, format) : undefined}
              dot={missing.has("schedule")}
              onPress={() => open({ kind: "profile-schedule" })}
            />
            <ListRow
              theme={theme}
              icon={<Footprints color={iconColor} size={ICON} />}
              title={p.rows.gear}
              description={
                worn ? `${gearName(worn)} · ${format.distance(worn.distanceKm, 0)} / ${format.distance(worn.limitKm, 0)}` : p.summary.gearEmpty
              }
              trailing={worn?.replaceSoon ? <Pill theme={theme} text={p.summary.replaceSoon} tone="warning" /> : undefined}
              onPress={() => open({ kind: "profile-gear" })}
            />
            <ListRow
              theme={theme}
              icon={<Gauge color={iconColor} size={ICON} />}
              title={p.rows.experience}
              description={athlete ? experienceSummary(athlete, copy, userLanguage) : undefined}
              dot={missing.has("experience")}
              onPress={() => open({ kind: "profile-experience" })}
            />
          </ListCard>
        </View>

        <View style={styles.section}>
          <SectionTitle text={p.sections.trefix} theme={theme} />
          <ListCard theme={theme}>
            <ListRow
              theme={theme}
              icon={<Sparkles color={iconColor} size={ICON} />}
              title={p.rows.coach}
              description={preferences.coachEnabled ? p.coach.modeLabel[preferences.coachAdaptationMode] : undefined}
              trailing={<Pill theme={theme} text={preferences.coachEnabled ? p.summary.on : p.summary.off} />}
              onPress={() => open({ kind: "settings-coach" })}
            />
          </ListCard>
        </View>

        <View style={styles.section}>
          <SectionTitle text={p.sections.app} theme={theme} />
          <ListCard theme={theme}>
            <ListRow
              theme={theme}
              icon={<RulerIcon color={iconColor} size={ICON} />}
              title={p.rows.units}
              description={[
                preferences.units === "imperial" ? `${format.labels.mi} · ${format.labels.lb}` : `${format.labels.km} · ${format.labels.kg}`,
                preferences.weekStart === "sun" ? p.unitsScreen.sun : p.unitsScreen.mon,
              ].join(" · ")}
              onPress={() => open({ kind: "settings-units" })}
            />
            <ListRow theme={theme} icon={<Bell color={iconColor} size={ICON} />} title={p.rows.notifications} onPress={onOpenNotifications} />
            <ListRow
              theme={theme}
              icon={<Languages color={iconColor} size={ICON} />}
              title={p.rows.language}
              value={p.settings.languages[userLanguage]}
              onPress={onOpenLanguage}
            />
            <ListRow
              theme={theme}
              icon={<Palette color={iconColor} size={ICON} />}
              title={p.rows.theme}
              value={p.settings.themes[userTheme]}
              onPress={onOpenTheme}
            />
            <ListRow
              theme={theme}
              icon={<Share2 color={iconColor} size={ICON} />}
              title={p.rows.integrations}
              description={
                stravaConnected
                  ? fillTemplate(p.summary.synced, { ago: formatAgo(strava?.lastSyncedAt, copy) })
                  : p.summary.notConnected
              }
              onPress={onOpenIntegrations}
            />
          </ListCard>
        </View>

        <View style={styles.section}>
          <SectionTitle text={p.sections.account} theme={theme} />
          <ListCard theme={theme}>
            <ListRow
              theme={theme}
              icon={<KeyRound color={iconColor} size={ICON} />}
              title={p.rows.signIn}
              description={user?.email}
              onPress={onEdit}
            />
            <ListRow
              theme={theme}
              icon={<ShieldCheck color={iconColor} size={ICON} />}
              title={p.rows.privacy}
              onPress={() => void Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://trefix.run/privacy")}
            />
            <ListRow
              theme={theme}
              icon={<Trash2 color={theme.color.danger} size={ICON} />}
              title={p.rows.delete}
              destructive
              chevron={false}
              onPress={() => setDeleteVisible(true)}
            />
            <ListRow
              theme={theme}
              icon={<LogOut color={iconColor} size={ICON} />}
              title={p.rows.logout}
              chevron={false}
              onPress={onLogout}
            />
          </ListCard>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
            {p.version} {appVersion}
            {" · "}
            <Text accessibilityRole="link" onPress={() => void Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL ?? "https://trefix.run/terms")}>
              {p.legal.terms}
            </Text>
            {" · "}
            <Text accessibilityRole="link" onPress={() => void Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://trefix.run/privacy")}>
              {p.legal.privacy}
            </Text>
          </Text>
        </View>
      </View>

      <QrDialog
        visible={qrVisible}
        onClose={() => setQrVisible(false)}
        referralCode={user?.referralCode ?? "TREFIX"}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
      />
      <DeleteAccountSheet
        visible={deleteVisible}
        onClose={(deleted) => {
          setDeleteVisible(false);
          if (deleted) onAccountDeleted();
        }}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
  },
  hero: {
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 4,
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  name: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  section: {
    gap: 8,
  },
  footer: {
    alignItems: "center",
    paddingBottom: 16,
  },
  footerText: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
  },
});
