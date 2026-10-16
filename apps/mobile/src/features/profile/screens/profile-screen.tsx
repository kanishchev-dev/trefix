import { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import {
  Bell,
  ChevronRight,
  Footprints,
  Languages,
  Palette,
  Ruler,
  Settings,
  Share2,
  ShieldUser,
  Sparkles,
  UserRound,
  WandSparkles,
} from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  formatProfileJoinedDate,
  pluralize,
  type MainCopy,
} from "../../../locales";
import { trackEvent } from "../../../lib/analytics";
import { resolveBackendMediaUrl } from "../../../lib/backend-url";
import { IntegrationLogo } from "../../../shared/ui/integration-logo";
import { ListCard, ListRow } from "../../../shared/ui/list-card";
import { healthStoreName } from "../../health-sync/health-integration-screen";
import { useHealthProvider } from "../../health-sync/hooks";
import { HeaderLogo, HeaderQrButton } from "../../main/components/header";
import { QrDialog } from "../../main/components/qr-dialog";
import { SectionLayout } from "../../main/components/section-layout";
import { useAppSettings } from "../../main/context/app-settings-context";
import { useHeaderOptions } from "../../main/context/header-context";
import { useIntegrations } from "../../main/hooks/use-integrations";
import { useProfile } from "../../main/hooks/use-profile";
import {
  BodyTitle,
  CardBody,
  HEADER_ICON,
  ICON_STROKE,
  Meta,
  ProfileCard,
  ROW_ICON,
  StatGrid,
  WearBar,
} from "../components/profile-ui";
import { useAthleteProfile } from "../hooks/use-athlete-profile";
import { usePreferences } from "../hooks/use-preferences";
import { useUnitFormat } from "../hooks/use-unit-format";
import { formatAgo, missingGroups } from "../lib/profile-format";
import { type ProfileNavigate } from "../profile-routes";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onEdit: () => void;
  onOpenNotifications: () => void;
  onOpenLanguage: () => void;
  onOpenTheme: () => void;
  onOpenIntegrations: () => void;
  onOpenStrava: () => void;
  onOpenHealth: () => void;
  onNavigate: ProfileNavigate;
};

/** Below this share the running profile card asks to fill the profile instead of showing stats. */
const COMPLETENESS_CARD_THRESHOLD = 70;

/** Profile: who the athlete is, the running profile, the coach, connected services and app settings. */
export function ProfileScreen({
  theme,
  themeMode,
  copy,
  onEdit,
  onOpenNotifications,
  onOpenLanguage,
  onOpenTheme,
  onOpenIntegrations,
  onOpenStrava,
  onOpenHealth,
  onNavigate,
}: Props) {
  const { language, languageMode, userTheme } = useAppSettings();
  const { data: user, isLoading } = useProfile();
  const { data: athlete } = useAthleteProfile();
  const { preferences } = usePreferences();
  const { data: integrations } = useIntegrations();
  const healthProvider = useHealthProvider();
  const format = useUnitFormat(copy, language);
  const [qrVisible, setQrVisible] = useState(false);

  const p = copy.profile;
  const h = p.home;
  const fg = theme.color.foreground;
  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  useHeaderOptions(
    {
      leftAction: (
        <HeaderQrButton
          theme={theme}
          themeMode={themeMode}
          onPress={() => setQrVisible(true)}
        />
      ),
      centerContent: <HeaderLogo source={logoSource} />,
      rightAction: null,
      variant: "default",
      bottomContent: null,
    },
    [theme, themeMode, logoSource],
  );

  const open = (route: Parameters<ProfileNavigate>[0]) => {
    trackEvent("profile_section_opened", { section: route.kind });
    onNavigate(route);
  };

  const subtitle = useMemo(() => {
    if (!athlete?.runningSinceYear) {
      return formatProfileJoinedDate(
        user?.createdAt ? new Date(user.createdAt) : new Date(),
        language,
      );
    }
    const level = h.levels[athlete.experienceLevel as keyof typeof h.levels];
    return [
      fillTemplate(p.summary.runningSince, { year: athlete.runningSinceYear }),
      level,
    ]
      .filter(Boolean)
      .join(" · ");
  }, [athlete, h, language, p.summary.runningSince, user?.createdAt]);

  const percent = athlete?.completeness?.percent ?? 100;
  const needsFilling =
    Boolean(athlete) && percent < COMPLETENESS_CARD_THRESHOLD;
  const missing = missingGroups(athlete);
  const years = athlete?.runningSinceYear
    ? Math.max(0, new Date().getFullYear() - athlete.runningSinceYear)
    : null;

  const strava = integrations?.items.find((item) => item.provider === "strava");
  const health = healthProvider
    ? integrations?.items.find((item) => item.provider === healthProvider)
    : undefined;
  const services = [
    strava && strava.status !== "disconnected"
      ? {
          key: "strava" as const,
          item: strava,
          title: "Strava",
          onPress: onOpenStrava,
        }
      : null,
    health && healthProvider && health.status !== "disconnected"
      ? {
          key: healthProvider,
          item: health,
          title: healthStoreName(copy),
          onPress: onOpenHealth,
        }
      : null,
  ].filter((entry) => entry !== null);

  const languageValue =
    languageMode === "system"
      ? p.languageScreen.system
      : p.languageScreen.native[languageMode];

  return (
    <SectionLayout
      hasHeader={false}
      scrollable
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.stack}>
        <View style={styles.hero}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={p.hero.changePhoto}
            onPress={onEdit}
            style={[styles.avatar, { backgroundColor: theme.color.card }]}
          >
            {user?.avatarUrl ? (
              <Image
                source={{
                  uri: resolveBackendMediaUrl(user.avatarUrl) ?? undefined,
                }}
                style={styles.avatarImage}
              />
            ) : (
              <UserRound color={fg} size={34} strokeWidth={ICON_STROKE} />
            )}
          </Pressable>
          <Text
            accessibilityRole="header"
            numberOfLines={1}
            style={[
              styles.name,
              {
                color: fg,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {isLoading
              ? "…"
              : `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.subtitle,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {subtitle}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={onEdit}
            style={({ pressed }) => [
              styles.editButton,
              { backgroundColor: theme.color.card },
              pressed && styles.pressed,
            ]}
          >
            <Text
              numberOfLines={1}
              style={[
                styles.editLabel,
                {
                  color: fg,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {h.editProfile}
            </Text>
          </Pressable>
        </View>

        <ProfileCard
          theme={theme}
          title={h.runningProfile}
          icon={
            <Footprints
              color={fg}
              size={HEADER_ICON}
              strokeWidth={ICON_STROKE}
            />
          }
          onPress={() => open({ kind: "profile-running" })}
        >
          {needsFilling ? (
            <CardBody>
              <View style={styles.fillTop}>
                <BodyTitle theme={theme} text={p.completeness.title} />
                <Text
                  style={[
                    styles.fillPercent,
                    { color: theme.color.mutedForeground },
                  ]}
                >
                  {`${percent}%`}
                </Text>
              </View>
              <WearBar theme={theme} percent={percent} />
              <Meta theme={theme} text={h.fillHint} numberOfLines={3} />
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  open({
                    kind: "profile-wizard",
                    step: missing.has("body")
                      ? 1
                      : missing.has("heart")
                        ? 2
                        : missing.has("experience")
                          ? 3
                          : 1,
                  })
                }
                style={({ pressed }) => [
                  styles.primary,
                  { backgroundColor: theme.color.primary },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.primaryLabel,
                    {
                      color: theme.color.primaryForeground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {p.completeness.action}
                </Text>
              </Pressable>
            </CardBody>
          ) : (
            <StatGrid
              theme={theme}
              stats={[
                {
                  value:
                    years !== null ? pluralize(h.years, years, language) : "—",
                  label: h.experience,
                },
                {
                  value: athlete?.weeklyMileageKm
                    ? format.distance(athlete.weeklyMileageKm, 0)
                    : "—",
                  label: h.volume,
                },
                {
                  value: athlete?.thresholdHeartRate
                    ? String(athlete.thresholdHeartRate)
                    : "—",
                  label: h.threshold,
                },
              ]}
            />
          )}
        </ProfileCard>

        <ProfileCard
          theme={theme}
          title={h.tref}
          icon={
            <Sparkles color={fg} size={HEADER_ICON} strokeWidth={ICON_STROKE} />
          }
          onPress={() => open({ kind: "settings-coach" })}
        >
          <View style={styles.coach}>
            <WandSparkles
              color={fg}
              size={ROW_ICON}
              strokeWidth={ICON_STROKE}
              style={styles.coachIcon}
            />
            <View style={styles.coachText}>
              <View style={styles.coachTop}>
                <BodyTitle theme={theme} text={h.coach} style={styles.flex} />
                <Text
                  style={[
                    styles.coachStatus,
                    {
                      color: fg,
                      fontFamily: theme.typography.fontFamily.sans.regular,
                    },
                  ]}
                >
                  {preferences.coachEnabled ? h.coachOn : h.coachOff}
                </Text>
              </View>
              <Meta
                theme={theme}
                numberOfLines={2}
                text={
                  preferences.coachEnabled
                    ? fillTemplate(h.adaptation, {
                        mode: h.modes[preferences.coachAdaptationMode],
                      })
                    : h.coachOffHint
                }
              />
            </View>
          </View>
        </ProfileCard>

        <ProfileCard
          theme={theme}
          title={h.services}
          icon={
            <Share2 color={fg} size={HEADER_ICON} strokeWidth={ICON_STROKE} />
          }
          onPress={onOpenIntegrations}
        >
          {services.length === 0 ? (
            <CardBody>
              <BodyTitle theme={theme} text={h.noServices} />
              <Meta
                theme={theme}
                numberOfLines={3}
                text={fillTemplate(h.noServicesHint, {
                  health: healthStoreName(copy),
                })}
              />
            </CardBody>
          ) : (
            services.map((service, index) => (
              <Pressable
                key={service.key}
                accessibilityRole="button"
                onPress={service.onPress}
                style={({ pressed }) => [
                  styles.service,
                  index > 0 && {
                    borderTopWidth: 1,
                    borderTopColor: theme.color.screen,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <IntegrationLogo
                  provider={service.key}
                  themeMode={themeMode}
                  size={44}
                />
                <View style={styles.serviceText}>
                  <BodyTitle theme={theme} text={service.title} />
                  <Meta
                    theme={theme}
                    text={
                      service.item.lastSyncedAt
                        ? fillTemplate(h.connectedAgo, {
                            ago: formatAgo(service.item.lastSyncedAt, copy),
                          })
                        : h.connected
                    }
                  />
                </View>
                <ChevronRight
                  color={theme.color.mutedForeground}
                  size={18}
                  strokeWidth={2.2}
                />
              </Pressable>
            ))
          )}
        </ProfileCard>

        <ProfileCard
          theme={theme}
          title={h.appSettings}
          icon={
            <Settings color={fg} size={HEADER_ICON} strokeWidth={ICON_STROKE} />
          }
        >
          <ListCard theme={theme} bare>
            <ListRow
              theme={theme}
              icon={
                <Languages
                  color={fg}
                  size={ROW_ICON}
                  strokeWidth={ICON_STROKE}
                />
              }
              title={p.rows.language}
              value={languageValue}
              onPress={onOpenLanguage}
            />
            <ListRow
              theme={theme}
              icon={
                <Palette color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
              }
              title={p.rows.theme}
              value={p.settings.themes[userTheme]}
              onPress={onOpenTheme}
            />
            <ListRow
              theme={theme}
              icon={
                <Bell color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
              }
              title={p.rows.notifications}
              onPress={onOpenNotifications}
            />
            <ListRow
              theme={theme}
              icon={
                <Ruler color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
              }
              title={h.units}
              value={fillTemplate(p.unitsScreen.summary, {
                distance:
                  format.units === "imperial"
                    ? format.labels.mi
                    : format.labels.km,
                weight:
                  format.weightUnits === "imperial"
                    ? format.labels.lb
                    : format.labels.kg,
              })}
              onPress={() => open({ kind: "settings-units" })}
            />
            <ListRow
              theme={theme}
              icon={
                <ShieldUser
                  color={fg}
                  size={ROW_ICON}
                  strokeWidth={ICON_STROKE}
                />
              }
              title={h.account}
              onPress={() => open({ kind: "settings-account" })}
            />
          </ListCard>
        </ProfileCard>
      </View>
      <QrDialog
        visible={qrVisible}
        onClose={() => setQrVisible(false)}
        referralCode={user?.referralCode ?? ""}
        theme={theme}
        themeMode={themeMode}
        copy={copy}
      />
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
  },
  hero: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
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
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  editButton: {
    marginTop: 14,
    height: 40,
    paddingHorizontal: 20,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  editLabel: {
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: {
    opacity: 0.82,
  },
  fillTop: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  fillPercent: {
    fontSize: 15,
    lineHeight: 20,
  },
  primary: {
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  coach: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  coachIcon: {
    marginTop: 1,
  },
  coachText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  coachTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  coachStatus: {
    fontSize: 15,
    lineHeight: 20,
  },
  flex: {
    flex: 1,
  },
  service: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 14,
  },
  serviceText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
});
