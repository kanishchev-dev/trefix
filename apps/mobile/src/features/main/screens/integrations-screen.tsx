import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { IntegrationLogo } from "../../../shared/ui/integration-logo";
import {
  ListCard,
  ListRow,
  Pill,
  SectionTitle,
} from "../../../shared/ui/list-card";
import { healthStoreName } from "../../health-sync/health-integration-screen";
import { useHealthProvider } from "../../health-sync/hooks";
import { getHealthSource } from "../../health-sync/sources";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../../profile/components/profile-sub-screen";
import { formatAgo } from "../../profile/lib/profile-format";
import { useIntegrations } from "../hooks/use-integrations";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  userLanguage: AppLanguage;
  onBack: () => void;
  onOpenStrava: () => void;
  onOpenHealth: () => void;
  onOpenGarmin: () => void;
};

type Service = {
  key: "strava" | "apple_health" | "health_connect" | "garmin";
  title: string;
  description: string;
  connected: boolean;
  onPress: () => void;
};

/** Connected services and the ones that can be connected. */
export function IntegrationsScreen({
  theme,
  themeMode,
  copy,
  onBack,
  onOpenStrava,
  onOpenHealth,
  onOpenGarmin,
}: Props) {
  const { data } = useIntegrations();
  const healthProvider = useHealthProvider();
  const v = copy.profile.services;
  const items = data?.items ?? [];
  const find = (provider: string) =>
    items.find((item) => item.provider === provider);
  const isOn = (provider: string) => {
    const item = find(provider);
    return Boolean(item && item.status !== "disconnected");
  };

  const strava = find("strava");
  const services: Service[] = [
    {
      key: "strava",
      title: "Strava",
      description: strava?.lastSyncedAt
        ? fillTemplate(v.syncedAgo, {
            ago: formatAgo(strava.lastSyncedAt, copy),
          })
        : copy.profile.integrations.strava.description,
      connected: isOn("strava"),
      onPress: onOpenStrava,
    },
  ];
  const healthItem = healthProvider ? find(healthProvider) : undefined;
  if (healthProvider && getHealthSource() && healthItem?.available !== false) {
    services.push({
      key: healthProvider,
      title: healthStoreName(copy),
      description: v.healthDescription,
      connected: isOn(healthProvider),
      onPress: onOpenHealth,
    });
  }
  services.push({
    key: "garmin",
    title: copy.profile.gearScreen.sources.garmin,
    description: v.garminDescription,
    connected: isOn("garmin"),
    onPress: onOpenGarmin,
  });

  const connected = services.filter((service) => service.connected);
  const available = services.filter((service) => !service.connected);

  const row = (service: Service) => (
    <ListRow
      key={service.key}
      theme={theme}
      icon={
        <IntegrationLogo
          provider={service.key}
          themeMode={themeMode}
          size={28}
        />
      }
      title={service.title}
      description={service.description}
      trailing={
        service.connected ? undefined : (
          <Pill
            theme={theme}
            text={service.key === "garmin" ? v.soon : v.connect}
          />
        )
      }
      chevron={service.connected}
      onPress={service.onPress}
    />
  );

  return (
    <ProfileSubScreen
      title={v.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      {connected.length > 0 ? (
        <ProfileSection>
          <SectionTitle text={v.connected} theme={theme} />
          <ListCard theme={theme} bare>
            {connected.map(row)}
          </ListCard>
        </ProfileSection>
      ) : null}
      {available.length > 0 ? (
        <ProfileSection>
          <SectionTitle text={v.available} theme={theme} />
          <ListCard theme={theme} bare>
            {available.map(row)}
          </ListCard>
          <Footnote text={v.duplicatesHint} theme={theme} />
        </ProfileSection>
      ) : (
        <Footnote text={v.duplicatesHint} theme={theme} />
      )}
    </ProfileSubScreen>
  );
}
