import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { CheckCircle2, AlertCircle, RefreshCw, Unplug } from "lucide-react-native";
import { type ThemeTokens } from "@workspace/tokens";

import { HeaderBackButton, HeaderTitle } from "../components/header";
import { useHeaderOptions } from "../context/header-context";
import { SectionLayout } from "../components/section-layout";
import { type AppLanguage, type MainCopy } from "../../../locales";
import {
  useConnectStrava,
  useDisconnectStrava,
  useStravaIntegration,
  useStravaSyncStatus,
  useTriggerStravaSync,
} from "../hooks/use-integrations";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
  userLanguage: AppLanguage;
  onBack: () => void;
};

export function StravaIntegrationScreen({
  theme,
  themeMode,
  copy,
  userLanguage,
  onBack,
}: Props) {
  const { data: strava, isLoading: isStravaLoading, refetch: refetchStrava } = useStravaIntegration();
  const connectMutation = useConnectStrava();
  const disconnectMutation = useDisconnectStrava();
  const triggerSyncMutation = useTriggerStravaSync();

  const isSyncing = strava?.status === "syncing" || strava?.status === "connecting";
  const { data: syncStatus } = useStravaSyncStatus(isSyncing);

  const handleConnect = async () => {
    try {
      const res = await connectMutation.mutateAsync();
      if (res.authUrl) {
        await Linking.openURL(res.authUrl);
      }
    } catch (error) {
      // Handled by UI
    }
  };

  const handleDisconnect = async () => {
    await disconnectMutation.mutateAsync();
    refetchStrava();
  };

  const handleTriggerSync = async () => {
    await triggerSyncMutation.mutateAsync();
    refetchStrava();
  };

  const isConnected = strava?.status === "connected" || strava?.status === "syncing";
  const isError = strava?.status === "error" || strava?.status === "reauthorization_required";

  useHeaderOptions(
    {
      leftAction: (
        <HeaderBackButton
          theme={theme}
          themeMode={themeMode}
          onPress={onBack}
        />
      ),
      centerContent: <HeaderTitle theme={theme}>Strava</HeaderTitle>,
      rightAction: null,
      variant: "default",
      bottomContent: null,
    },
    [theme, themeMode, onBack],
  );

  return (
    <SectionLayout
      hasHeader={false}
      scrollable
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.stack}>
        {/* Header Hero */}
        <View
          style={[
            styles.heroCard,
            {
              backgroundColor: theme.color.surfaceElevated,
              borderColor: theme.color.border,
            },
          ]}
        >
          <View style={[styles.brandBadge, { backgroundColor: "#FC4C02" }]}>
            <Text style={styles.brandBadgeText}>STRAVA</Text>
          </View>

          <Text
            style={[
              styles.heroTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.semibold,
              },
            ]}
          >
            {copy.profile.integrations.strava.title}
          </Text>

          <Text
            style={[
              styles.heroDesc,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {copy.profile.integrations.strava.description}
          </Text>
        </View>

        {/* State Content */}
        {isStravaLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.color.primary} size="large" />
          </View>
        ) : isConnected ? (
          <View style={styles.connectedStack}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.color.surfaceElevated,
                  borderColor: theme.color.border,
                },
              ]}
            >
              <View style={styles.statusHeader}>
                <CheckCircle2 color="#22c55e" size={24} strokeWidth={2} />
                <Text
                  style={[
                    styles.statusTitle,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {copy.profile.integrations.strava.connectedStateTitle}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text
                  style={[
                    styles.metaLabel,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.regular,
                    },
                  ]}
                >
                  {copy.profile.integrations.strava.lastSyncLabel}
                </Text>
                <Text
                  style={[
                    styles.metaValue,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {strava.lastSyncedAt
                    ? new Date(strava.lastSyncedAt).toLocaleString()
                    : copy.profile.integrations.strava.justNow}
                </Text>
              </View>

              <View style={styles.metaRow}>
                <Text
                  style={[
                    styles.metaLabel,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.regular,
                    },
                  ]}
                >
                  {copy.profile.integrations.strava.activitiesImportedLabel}
                </Text>
                <Text
                  style={[
                    styles.metaValue,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {strava.importedActivitiesCount ?? 0}
                </Text>
              </View>

              {isSyncing ? (
                <View style={styles.syncingBox}>
                  <ActivityIndicator color={theme.color.primary} size="small" />
                  <Text
                    style={[
                      styles.syncingText,
                      {
                        color: theme.color.mutedForeground,
                        fontFamily: theme.typography.fontFamily.sans.regular,
                      },
                    ]}
                  >
                    {copy.profile.integrations.strava.importingHistory}
                    {syncStatus?.processed ? ` (${syncStatus.imported} imported)` : ""}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Actions */}
            <Pressable
              accessibilityRole="button"
              disabled={triggerSyncMutation.isPending}
              onPress={handleTriggerSync}
              style={({ pressed }) => [
                styles.syncButton,
                {
                  backgroundColor: theme.color.surfaceElevated,
                  borderColor: theme.color.border,
                },
                pressed && styles.buttonPressed,
              ]}
            >
              <RefreshCw color={theme.color.foreground} size={18} />
              <Text
                style={[
                  styles.syncButtonText,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {copy.profile.integrations.strava.syncNow}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={disconnectMutation.isPending}
              onPress={handleDisconnect}
              style={({ pressed }) => [
                styles.disconnectButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Unplug color="#ff6b6b" size={18} />
              <Text
                style={[
                  styles.disconnectText,
                  {
                    color: "#ff6b6b",
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {copy.profile.integrations.strava.disconnect}
              </Text>
            </Pressable>
          </View>
        ) : isError ? (
          <View style={styles.errorStack}>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: theme.color.surfaceElevated,
                  borderColor: theme.color.border,
                },
              ]}
            >
              <View style={styles.statusHeader}>
                <AlertCircle color="#ef4444" size={24} strokeWidth={2} />
                <Text
                  style={[
                    styles.statusTitle,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {copy.profile.integrations.strava.connectionExpiredTitle}
                </Text>
              </View>

              <Text
                style={[
                  styles.errorDesc,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              >
                {copy.profile.integrations.strava.reconnectDesc}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              disabled={connectMutation.isPending}
              onPress={handleConnect}
              style={({ pressed }) => [
                styles.connectButton,
                { backgroundColor: "#FC4C02" },
                pressed && styles.buttonPressed,
              ]}
            >
              <Text
                style={[
                  styles.connectButtonText,
                  { fontFamily: theme.typography.fontFamily.sans.medium },
                ]}
              >
                {copy.profile.integrations.strava.reconnectBtn}
              </Text>
            </Pressable>
          </View>
        ) : (
          /* Disconnected State */
          <View style={styles.disconnectedStack}>
            <Pressable
              accessibilityRole="button"
              disabled={connectMutation.isPending}
              onPress={handleConnect}
              style={({ pressed }) => [
                styles.connectButton,
                { backgroundColor: "#FC4C02" },
                pressed && styles.buttonPressed,
              ]}
            >
              {connectMutation.isPending ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text
                  style={[
                    styles.connectButtonText,
                    { fontFamily: theme.typography.fontFamily.sans.medium },
                  ]}
                >
                  {copy.profile.integrations.strava.connectBtn}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 16,
    paddingTop: 8,
  },
  heroCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    gap: 12,
  },
  brandBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  brandBadgeText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1,
  },
  heroTitle: {
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
  },
  heroDesc: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  loadingBox: {
    paddingVertical: 32,
    alignItems: "center",
  },
  connectedStack: {
    gap: 12,
  },
  disconnectedStack: {
    gap: 12,
  },
  errorStack: {
    gap: 12,
  },
  card: {
    padding: 16,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  statusTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 4,
  },
  metaLabel: {
    fontSize: 14,
  },
  metaValue: {
    fontSize: 14,
  },
  syncingBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 8,
  },
  syncingText: {
    fontSize: 13,
  },
  errorDesc: {
    fontSize: 14,
    lineHeight: 20,
  },
  connectButton: {
    minHeight: 52,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  connectButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  syncButton: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  syncButtonText: {
    fontSize: 15,
  },
  disconnectButton: {
    minHeight: 48,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  disconnectText: {
    fontSize: 15,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.985 }],
  },
});
