import { type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, RefreshCw } from "lucide-react-native";
import { type ThemeTokens } from "@workspace/tokens";

import { HeaderBackButton, HeaderTitle } from "../components/header";
import { useHeaderOptions } from "../context/header-context";
import { SectionLayout } from "../components/section-layout";
import { type AppLanguage, type MainCopy } from "../../../locales";
import { useIntegrations } from "../hooks/use-integrations";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
  userLanguage: AppLanguage;
  onBack: () => void;
  onOpenStrava: () => void;
};

type RowProps = {
  theme: ThemeTokens;
  title: string;
  subtitle: string;
  icon?: ReactNode;
  onPress?: () => void;
  disabled?: boolean;
};

function IntegrationRow({
  theme,
  title,
  subtitle,
  icon,
  onPress,
  disabled = false,
}: RowProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && !disabled && styles.rowPressed,
        disabled && styles.rowDisabled,
      ]}
    >
      <View style={styles.rowContent}>
        {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
        <View style={styles.textWrap}>
          <Text
            style={[
              styles.rowTitle,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {title}
          </Text>
          <Text
            style={[
              styles.rowSubtitle,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {subtitle}
          </Text>
        </View>
        {!disabled ? (
          <ChevronRight
            color={theme.color.mutedForeground}
            size={18}
            strokeWidth={2.2}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

export function IntegrationsScreen({
  theme,
  themeMode,
  copy,
  userLanguage,
  onBack,
  onOpenStrava,
}: Props) {
  const { data: integrationsData, isLoading } = useIntegrations();

  const getStravaSubtitle = () => {
    if (isLoading) return "...";
    const strava = integrationsData?.items.find((i) => i.provider === "strava");
    if (!strava || strava.status === "disconnected") {
      return copy.profile.integrations.strava.disconnectedStatus;
    }
    if (strava.status === "connected" || strava.status === "syncing") {
      return copy.profile.integrations.strava.connectedStatus;
    }
    if (strava.status === "reauthorization_required") {
      return copy.profile.integrations.strava.reauthStatus;
    }
    return copy.profile.integrations.strava.errorStatus;
  };

  useHeaderOptions(
    {
      leftAction: (
        <HeaderBackButton
          theme={theme}
          themeMode={themeMode}
          onPress={onBack}
        />
      ),
      centerContent: (
        <HeaderTitle theme={theme}>
          {copy.profile.integrations.title}
        </HeaderTitle>
      ),
      rightAction: null,
      variant: "default",
      bottomContent: null,
    },
    [theme, themeMode, onBack, copy.profile.integrations.title],
  );

  return (
    <SectionLayout
      hasHeader={false}
      scrollable
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.stack}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.medium,
            },
          ]}
        >
          {copy.profile.integrations.subtitle}
        </Text>

        <View
          style={[
            styles.card,
            {
              backgroundColor: theme.color.surfaceElevated,
              borderColor: theme.color.border,
            },
          ]}
        >
          <IntegrationRow
            theme={theme}
            title="Strava"
            subtitle={getStravaSubtitle()}
            icon={
              <View
                style={[
                  styles.stravaIcon,
                  { backgroundColor: "#FC4C02" },
                ]}
              >
                <Text style={styles.stravaIconText}>S</Text>
              </View>
            }
            onPress={onOpenStrava}
          />
          <View
            style={[styles.separator, { backgroundColor: theme.color.border }]}
          />
          <IntegrationRow
            theme={theme}
            title="Garmin Connect"
            subtitle={copy.profile.integrations.comingSoon}
            disabled
          />
          <View
            style={[styles.separator, { backgroundColor: theme.color.border }]}
          />
          <IntegrationRow
            theme={theme}
            title="Apple Health"
            subtitle={copy.profile.integrations.comingSoon}
            disabled
          />
          <View
            style={[styles.separator, { backgroundColor: theme.color.border }]}
          />
          <IntegrationRow
            theme={theme}
            title="Health Connect"
            subtitle={copy.profile.integrations.comingSoon}
            disabled
          />
        </View>
      </View>
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 12,
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 4,
  },
  card: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  row: {
    minHeight: 60,
    paddingHorizontal: 16,
    paddingVertical: 12,
    justifyContent: "center",
  },
  rowPressed: {
    opacity: 0.82,
  },
  rowDisabled: {
    opacity: 0.5,
  },
  rowContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  stravaIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  stravaIconText: {
    color: "#FFFFFF",
    fontWeight: "bold",
    fontSize: 18,
  },
  textWrap: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    lineHeight: 22,
  },
  rowSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 60,
  },
});
