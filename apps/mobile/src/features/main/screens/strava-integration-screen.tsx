import { useState } from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Footprints,
  RefreshCw,
  TrendingUp,
  Unplug,
  Zap,
} from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { requestStravaProfileAccess } from "../../../lib/integrations-api";
import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import {
  IntegrationLogo,
  StravaCompatibleLogo,
  StravaConnectButton,
} from "../../../shared/ui/integration-logo";
import {
  ListCard,
  ListRow,
  Pill,
  SectionTitle,
} from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { useToast } from "../../../shared/ui/toast";
import { ProfileSheet } from "../../profile/components/profile-sheet";
import { ICON_STROKE, ROW_ICON } from "../../profile/components/profile-ui";
import {
  ProfileSection,
  ProfileSubScreen,
} from "../../profile/components/profile-sub-screen";
import {
  usePreferences,
  useUpdatePreferences,
} from "../../profile/hooks/use-preferences";
import {
  formatAgo,
  profileErrorMessage,
} from "../../profile/lib/profile-format";
import { ConnectOnboarding } from "../components/connect-onboarding";
import {
  useConnectStrava,
  useDisconnectStrava,
  useStravaIntegration,
  useStravaSyncStatus,
  useTriggerStravaSync,
} from "../hooks/use-integrations";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  userLanguage: AppLanguage;
  onBack: () => void;
};

/** Strava: onboarding while disconnected; what to sync, sync now and disconnect once connected. */
export function StravaIntegrationScreen({
  theme,
  themeMode,
  copy,
  onBack,
}: Props) {
  const { data: strava, isLoading, refetch } = useStravaIntegration();
  const connect = useConnectStrava();
  const disconnect = useDisconnectStrava();
  const triggerSync = useTriggerStravaSync();
  const { preferences } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const { showToast } = useToast();
  const [disconnectVisible, setDisconnectVisible] = useState(false);
  const s = copy.profile.integrations.strava;
  const v = copy.profile.stravaScreen;
  const c = copy.profile.connect.strava;
  const fg = theme.color.foreground;

  const syncing =
    strava?.status === "syncing" || strava?.status === "connecting";
  const { data: syncStatus } = useStravaSyncStatus(syncing);
  const connected =
    strava?.status === "connected" || strava?.status === "syncing";
  const needsReauth =
    strava?.status === "error" || strava?.status === "reauthorization_required";

  const startConnect = async () => {
    try {
      const response = await connect.mutateAsync();
      if (response.authUrl) await Linking.openURL(response.authUrl);
    } catch (error) {
      showToast(profileErrorMessage(error, copy));
    }
  };

  const allowProfile = async () => {
    try {
      const { authorizeUrl } = await requestStravaProfileAccess();
      await Linking.openURL(authorizeUrl);
    } catch (error) {
      showToast(profileErrorMessage(error, copy));
    }
  };

  const syncSwitch = (
    key: "stravaActivitiesSync" | "stravaProfileSync" | "stravaGearSync",
    label: string,
    needsProfileAccess: boolean,
  ) => (
    <Switch
      theme={theme}
      value={
        preferences[key] &&
        (!needsProfileAccess || Boolean(strava?.profileAccess))
      }
      accessibilityLabel={label}
      onValueChange={(value) => {
        if (value && needsProfileAccess && !strava?.profileAccess) {
          void allowProfile();
          return;
        }
        updatePreferences.mutate({ [key]: value });
      }}
    />
  );

  if (isLoading) {
    return (
      <ProfileSubScreen
        title={s.title}
        onBack={onBack}
        theme={theme}
        themeMode={themeMode}
      >
        <ActivityIndicator color={fg} />
      </ProfileSubScreen>
    );
  }

  if (!connected && !needsReauth) {
    return (
      <ProfileSubScreen
        title=""
        onBack={onBack}
        theme={theme}
        themeMode={themeMode}
      >
        <ConnectOnboarding
          theme={theme}
          themeMode={themeMode}
          provider="strava"
          title={c.title}
          lede={c.lede}
          chips={c.chips}
          benefits={c.benefits}
          benefitIcons={[Zap, Footprints, TrendingUp]}
          cta={
            <StravaConnectButton
              accessibilityLabel={s.connectBtn}
              pending={connect.isPending}
              onPress={() => void startConnect()}
            />
          }
          fine={c.fine}
        />
      </ProfileSubScreen>
    );
  }

  const ago = strava?.lastSyncedAt
    ? formatAgo(strava.lastSyncedAt, copy)
    : s.justNow;

  return (
    <ProfileSubScreen
      title={s.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.hero}>
        <IntegrationLogo provider="strava" themeMode={themeMode} size={64} />
        <Text
          style={[
            styles.heroTitle,
            { color: fg, fontFamily: theme.typography.fontFamily.sans.medium },
          ]}
        >
          Strava
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.heroText,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {needsReauth
            ? s.reauthStatus
            : syncing
              ? `${s.importingHistory}${syncStatus?.processed ? ` · ${syncStatus.imported}` : ""}`
              : fillTemplate(v.connectedAgo, { ago })}
        </Text>
      </View>

      {needsReauth ? (
        <View style={styles.reauth}>
          <Text
            style={[
              styles.heroText,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {s.reconnectDesc}
          </Text>
          <StravaConnectButton
            accessibilityLabel={s.reconnectBtn}
            pending={connect.isPending}
            onPress={() => void startConnect()}
          />
        </View>
      ) : (
        <ProfileSection>
          <SectionTitle text={v.sync} theme={theme} />
          <ListCard theme={theme} bare>
            <ListRow
              theme={theme}
              title={v.activities.title}
              description={v.activities.description}
              trailing={syncSwitch(
                "stravaActivitiesSync",
                v.activities.title,
                false,
              )}
            />
            <ListRow
              theme={theme}
              title={v.profile.title}
              description={v.profile.description}
              trailing={syncSwitch("stravaProfileSync", v.profile.title, true)}
            />
            <ListRow
              theme={theme}
              title={v.gear.title}
              description={v.gear.description}
              trailing={syncSwitch("stravaGearSync", v.gear.title, true)}
            />
            <ListRow
              theme={theme}
              title={v.upload.title}
              description={v.upload.description}
              trailing={
                <Pill theme={theme} text={copy.profile.services.soon} />
              }
            />
          </ListCard>
        </ProfileSection>
      )}

      <ListCard theme={theme} bare>
        {!needsReauth ? (
          <ListRow
            theme={theme}
            icon={
              <RefreshCw color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
            }
            title={v.syncNow}
            chevron={false}
            disabled={triggerSync.isPending || syncing}
            onPress={() =>
              void triggerSync
                .mutateAsync()
                .then(() => refetch())
                .catch((error) => showToast(profileErrorMessage(error, copy)))
            }
          />
        ) : null}
        <ListRow
          theme={theme}
          icon={
            <Unplug
              color={theme.color.danger}
              size={ROW_ICON}
              strokeWidth={ICON_STROKE}
            />
          }
          title={v.disconnect}
          destructive
          chevron={false}
          onPress={() => setDisconnectVisible(true)}
        />
      </ListCard>

      <View style={styles.compatible}>
        <StravaCompatibleLogo themeMode={themeMode} />
      </View>

      <ProfileSheet
        visible={disconnectVisible}
        onClose={() => setDisconnectVisible(false)}
        title={v.disconnect}
        body={s.description}
        buttons={[
          {
            label: s.disconnect,
            variant: "destructive",
            onPress: async () => {
              await disconnect.mutateAsync();
              await refetch();
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

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: 6,
    paddingTop: 8,
  },
  heroTitle: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
  },
  heroText: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  reauth: {
    alignItems: "center",
    gap: 16,
  },
  compatible: {
    alignItems: "center",
    paddingBottom: 16,
  },
});
