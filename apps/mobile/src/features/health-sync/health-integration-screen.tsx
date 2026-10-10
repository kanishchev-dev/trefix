import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, StyleSheet, Text, View } from "react-native";
import {
  CalendarClock,
  Check,
  Download,
  HeartPulse,
  History,
  RefreshCw,
  Settings2,
  ShieldAlert,
  Smartphone,
  Unplug,
  UserRound,
} from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { trackEvent } from "../../lib/analytics";
import { fillTemplate, type MainCopy } from "../../locales";
import { SheetButton } from "../../shared/ui/bottom-sheet";
import { IconCircle, ListCard, ListRow, SectionTitle } from "../../shared/ui/list-card";
import { Switch } from "../../shared/ui/switch";
import { useToast } from "../../shared/ui/toast";
import { useIntegrations } from "../main/hooks/use-integrations";
import { ConfirmSheet } from "../plans/components/confirm-sheet";
import { Footnote, ProfileSection, ProfileSubScreen } from "../profile/components/profile-sub-screen";
import { formatAgo, profileErrorMessage } from "../profile/lib/profile-format";
import { HealthConsentSheet } from "./components/health-consent-sheet";
import { HealthHintCard } from "./components/health-hint-card";
import {
  HealthPermissionDeniedError,
  useConnectHealth,
  useDisconnectHealth,
  useHealthAvailability,
  useHealthConsent,
  useHealthIntegration,
  useHealthSyncNow,
  useHealthSyncStatus,
  useRequestHealthHistory,
  useSetHealthProfileSync,
} from "./hooks";
import { getHealthSource } from "./sources";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

export function healthStoreName(copy: MainCopy): string {
  const h = copy.profile.integrations.health;
  return Platform.OS === "ios" ? h.appleTitle : h.connectTitle;
}

/** H1 — Apple Health (iOS) / Health Connect (Android): connect, status, settings, disconnect. */
export function HealthIntegrationScreen({ theme, themeMode, copy, onBack }: Props) {
  const h = copy.profile.integrations.health;
  const storeName = healthStoreName(copy);
  const source = getHealthSource();
  const isIos = Platform.OS === "ios";
  const { showToast } = useToast();

  const availability = useHealthAvailability();
  const { item, isLoading } = useHealthIntegration();
  const { data: integrations } = useIntegrations();
  const { hasConsent } = useHealthConsent();
  const connect = useConnectHealth();
  const disconnect = useDisconnectHealth();
  const syncNow = useHealthSyncNow();
  const setProfileSync = useSetHealthProfileSync();
  const requestHistory = useRequestHealthHistory();

  const connected = !!item && item.status !== "disconnected";
  const status = useHealthSyncStatus(connected);
  const [consentVisible, setConsentVisible] = useState(false);
  const [disconnectVisible, setDisconnectVisible] = useState(false);
  const [denied, setDenied] = useState(false);

  useEffect(() => {
    trackEvent("health_integration_viewed", { connected });
    // Only on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stravaConnected = integrations?.items.some(
    (entry) => entry.provider === "strava" && entry.status !== "disconnected",
  );
  const scopes = item?.scopes ?? [];
  const pending = (status.data?.pendingBatches ?? item?.pendingBatches ?? 0) > 0 || syncNow.isPending;
  const neverSynced = !item?.lastSyncedAt;
  const noWorkouts = isIos && connected && !pending && !neverSynced && (item?.importedActivitiesCount ?? 0) === 0;
  const noHistory = !isIos && connected && !scopes.includes("history");
  const noWorkoutAccess = !isIos && connected && scopes.length > 0 && !scopes.includes("workouts");

  const startConnect = async () => {
    setDenied(false);
    try {
      await connect.mutateAsync();
    } catch (error) {
      if (error instanceof HealthPermissionDeniedError) {
        setDenied(true);
        return;
      }
      showToast(h.connectFailed);
    }
  };

  const onConnectPress = () => {
    if (!hasConsent) {
      setConsentVisible(true);
      return;
    }
    void startConnect();
  };

  const onSyncNow = async () => {
    try {
      await syncNow.mutateAsync();
      showToast(h.synced);
    } catch {
      showToast(h.syncFailed);
    }
  };

  const openSettings = () => void source?.openSystemSettings();
  const muted = { color: theme.color.mutedForeground, fontFamily: theme.typography.fontFamily.sans.regular };

  const renderUnavailable = () => {
    const state = availability.data;
    if (!source || state === "unsupported") {
      return (
        <HealthHintCard
          title={h.unsupportedTitle}
          body={isIos ? h.unsupportedBodyIos : h.unsupportedBodyAndroid}
          icon={<ShieldAlert color={theme.color.mutedForeground} size={18} />}
          theme={theme}
          themeMode={themeMode}
        />
      );
    }
    const update = state === "update_required";
    return (
      <HealthHintCard
        title={update ? h.updateTitle : h.notInstalledTitle}
        body={update ? h.updateBody : h.notInstalledBody}
        icon={<Download color={theme.color.foreground} size={18} />}
        actionLabel={update ? h.update : h.install}
        onAction={() => void source.openStorePage?.()}
        theme={theme}
        themeMode={themeMode}
      />
    );
  };

  const renderDisconnected = () => (
    <>
      <View style={[styles.card, { backgroundColor: theme.color.card }]}>
        <Text style={[styles.intro, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
          {h.intro}
        </Text>
        <Text style={[styles.cardTitle, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.medium }]}>
          {h.whatTitle}
        </Text>
        {h.what.map((line) => (
          <View key={line} style={styles.item}>
            <IconCircle theme={theme} size={28}>
              <Check color={theme.color.foreground} size={14} strokeWidth={2.4} />
            </IconCircle>
            <Text style={[styles.itemText, { color: theme.color.foreground, fontFamily: theme.typography.fontFamily.sans.regular }]}>
              {line}
            </Text>
          </View>
        ))}
      </View>
      <Footnote text={h.privacy} theme={theme} />
      {stravaConnected ? <Footnote text={fillTemplate(h.stravaNote, { store: storeName })} theme={theme} /> : null}
      {denied ? (
        <HealthHintCard
          title={h.deniedTitle}
          body={h.deniedBody}
          icon={<ShieldAlert color={theme.color.mutedForeground} size={18} />}
          actionLabel={h.openSettings}
          onAction={openSettings}
          theme={theme}
          themeMode={themeMode}
        />
      ) : null}
      <SheetButton
        label={connect.isPending ? h.connecting : h.connect}
        onPress={onConnectPress}
        pending={connect.isPending}
        theme={theme}
        themeMode={themeMode}
      />
    </>
  );

  const renderConnected = () => (
    <>
      <ProfileSection>
        <SectionTitle text={h.statusTitle} theme={theme} />
        <ListCard theme={theme}>
          <ListRow
            theme={theme}
            icon={<CalendarClock color={theme.color.foreground} size={20} />}
            title={h.lastSync}
            value={pending ? h.inProgress : item?.lastSyncedAt ? formatAgo(item.lastSyncedAt, copy) : h.never}
            trailing={pending ? <ActivityIndicator size="small" color={theme.color.mutedForeground} /> : undefined}
          />
          <ListRow
            theme={theme}
            icon={<HeartPulse color={theme.color.foreground} size={20} />}
            title={h.imported}
            value={String(item?.importedActivitiesCount ?? 0)}
          />
        </ListCard>
      </ProfileSection>

      {noWorkoutAccess ? (
        <HealthHintCard
          title={h.deniedTitle}
          body={h.deniedBody}
          icon={<ShieldAlert color={theme.color.mutedForeground} size={18} />}
          actionLabel={h.openSettings}
          onAction={openSettings}
          theme={theme}
          themeMode={themeMode}
        />
      ) : null}
      {noWorkouts ? (
        <HealthHintCard
          title={h.noWorkoutsTitle}
          body={h.noWorkoutsBody}
          icon={<Smartphone color={theme.color.mutedForeground} size={18} />}
          actionLabel={h.openHealth}
          onAction={openSettings}
          theme={theme}
          themeMode={themeMode}
        />
      ) : null}
      {noHistory ? (
        <HealthHintCard
          title={h.historyTitle}
          body={h.historyBody}
          icon={<History color={theme.color.mutedForeground} size={18} />}
          actionLabel={h.historyAction}
          onAction={() => requestHistory.mutate()}
          actionPending={requestHistory.isPending}
          theme={theme}
          themeMode={themeMode}
        />
      ) : null}

      <SheetButton
        label={h.syncNow}
        variant="secondary"
        onPress={() => void onSyncNow()}
        pending={syncNow.isPending}
        trailing={syncNow.isPending ? undefined : <RefreshCw color={theme.color.foreground} size={16} />}
        theme={theme}
        themeMode={themeMode}
      />

      <ProfileSection>
        <SectionTitle text={h.settingsTitle} theme={theme} />
        <ListCard theme={theme}>
          <ListRow
            theme={theme}
            icon={<UserRound color={theme.color.foreground} size={20} />}
            title={h.profileSync}
            description={h.profileSyncDescription}
            trailing={
              <Switch
                theme={theme}
                value={item?.profileSync !== false}
                disabled={setProfileSync.isPending}
                onValueChange={(value) => setProfileSync.mutate(value)}
                accessibilityLabel={h.profileSync}
              />
            }
          />
          <ListRow
            theme={theme}
            icon={<Settings2 color={theme.color.foreground} size={20} />}
            title={h.access}
            description={isIos ? h.accessDescriptionIos : h.accessDescriptionAndroid}
            onPress={openSettings}
          />
        </ListCard>
      </ProfileSection>

      <ListCard theme={theme}>
        <ListRow
          theme={theme}
          icon={<Unplug color={theme.color.danger} size={20} />}
          title={h.disconnect}
          destructive
          chevron={false}
          onPress={() => setDisconnectVisible(true)}
        />
      </ListCard>
    </>
  );

  const available = availability.data === "available";

  return (
    <ProfileSubScreen title={storeName} onBack={onBack} theme={theme} themeMode={themeMode}>
      {availability.isLoading || isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={theme.color.mutedForeground} />
        </View>
      ) : !available ? (
        renderUnavailable()
      ) : connected ? (
        renderConnected()
      ) : (
        renderDisconnected()
      )}

      {item?.status === "error" && !pending ? <Text style={[styles.error, muted]}>{h.syncFailed}</Text> : null}

      <HealthConsentSheet
        visible={consentVisible}
        storeName={storeName}
        onClose={(accepted) => {
          setConsentVisible(false);
          if (accepted) void startConnect();
        }}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
      <ConfirmSheet
        visible={disconnectVisible}
        title={fillTemplate(h.disconnectTitle, { store: storeName })}
        body={fillTemplate(h.disconnectBody, { store: storeName })}
        confirmLabel={h.disconnectConfirm}
        cancelLabel={copy.profile.valueSheet.cancel}
        onConfirm={async () => {
          await disconnect.mutateAsync();
        }}
        onClose={(confirmed) => {
          setDisconnectVisible(false);
          if (confirmed) showToast(fillTemplate(h.disconnected, { store: storeName }));
        }}
        errorMessage={(error) => profileErrorMessage(error, copy)}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  loading: {
    paddingVertical: 48,
    alignItems: "center",
  },
  card: {
    borderRadius: 24,
    padding: 18,
    gap: 14,
  },
  intro: {
    fontSize: 15,
    lineHeight: 21,
  },
  cardTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  itemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 8,
  },
});
