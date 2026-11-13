import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Download, Footprints, HeartPulse, Watch } from "lucide-react-native";

import { type Gear, type GearImportResult } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { requestStravaProfileAccess } from "../../../lib/integrations-api";
import {
  fillTemplate,
  formatSinceMonthYear,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import {
  ListCard,
  ListRow,
  Pill,
  SectionTitle,
} from "../../../shared/ui/list-card";
import { useToast } from "../../../shared/ui/toast";
import { useStravaIntegration } from "../../main/hooks/use-integrations";
import {
  BodyTitle,
  ICON_STROKE,
  Meta,
  ROW_ICON,
  WearBar,
} from "../components/profile-ui";
import { ProfileSheet } from "../components/profile-sheet";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import { useGear, useImportStravaGear } from "../hooks/use-gear";
import { useUnitFormat } from "../hooks/use-unit-format";
import { gearName, profileErrorMessage } from "../lib/profile-format";
import { type ProfileNavigate } from "../profile-routes";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
  onNavigate: ProfileNavigate;
};

/** Shoes with wear, watches and sensors, the archive; add gear or import shoes from Strava. */
export function GearScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
  onNavigate,
}: Props) {
  const { data: active = [] } = useGear("active");
  const { data: retired = [] } = useGear("retired");
  const { data: strava } = useStravaIntegration();
  const importGear = useImportStravaGear();
  const { showToast } = useToast();
  const format = useUnitFormat(copy, language);
  const [addVisible, setAddVisible] = useState(false);
  const [result, setResult] = useState<GearImportResult | null>(null);
  const g = copy.profile.gear;
  const s = copy.profile.gearScreen;
  const fg = theme.color.foreground;
  const stravaConnected = Boolean(strava && strava.status !== "disconnected");

  const shoes = active.filter((item) => item.type === "shoes");
  const devices = active.filter((item) => item.type !== "shoes");

  const runImport = async () => {
    try {
      if (!strava?.profileAccess) {
        const { authorizeUrl } = await requestStravaProfileAccess();
        await Linking.openURL(authorizeUrl);
        return;
      }
      setResult(await importGear.mutateAsync());
    } catch (error) {
      showToast(profileErrorMessage(error, copy));
    }
  };

  const deviceDescription = (device: Gear) => {
    if (device.dataSource) {
      return fillTemplate(s.deviceSource, {
        source: s.sources[device.dataSource],
      });
    }
    return fillTemplate(s.deviceWorkouts, { count: device.workoutsCount });
  };

  const imported = result ? result.created + result.updated : 0;

  return (
    <ProfileSubScreen
      title={g.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={s.shoes} theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.color.card }]}>
          {shoes.length === 0 ? (
            <View style={styles.shoe}>
              <Meta theme={theme} text={s.noShoes} numberOfLines={2} />
            </View>
          ) : (
            shoes.map((shoe, index) => (
              <Pressable
                key={shoe.id}
                accessibilityRole="button"
                onPress={() =>
                  onNavigate({ kind: "profile-gear-detail", gearId: shoe.id })
                }
                style={({ pressed }) => [
                  styles.shoe,
                  index > 0 && {
                    borderTopWidth: 1,
                    borderTopColor: theme.color.screen,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <View style={styles.shoeTop}>
                  <View style={styles.flex}>
                    <BodyTitle theme={theme} text={gearName(shoe)} />
                    {shoe.startedAt ? (
                      <Meta
                        theme={theme}
                        text={fillTemplate(g.since, {
                          date: formatSinceMonthYear(shoe.startedAt, language),
                        })}
                      />
                    ) : null}
                  </View>
                  {shoe.replaceSoon ? (
                    <Pill theme={theme} text={g.replaceSoon} tone="warning" />
                  ) : null}
                </View>
                <WearBar theme={theme} percent={shoe.wearPercent ?? 0} />
                <Meta
                  theme={theme}
                  text={fillTemplate(s.shoeMeta, {
                    distance: format.distance(shoe.distanceKm, 0),
                    count: shoe.workoutsCount,
                    limit: format.distance(shoe.limitKm ?? 0, 0),
                  })}
                />
              </Pressable>
            ))
          )}
        </View>
      </ProfileSection>

      {devices.length > 0 ? (
        <ProfileSection>
          <SectionTitle text={s.devices} theme={theme} />
          <ListCard theme={theme} bare>
            {devices.map((device) => (
              <ListRow
                key={device.id}
                theme={theme}
                icon={
                  device.type === "watch" ? (
                    <Watch
                      color={fg}
                      size={ROW_ICON}
                      strokeWidth={ICON_STROKE}
                    />
                  ) : (
                    <HeartPulse
                      color={fg}
                      size={ROW_ICON}
                      strokeWidth={ICON_STROKE}
                    />
                  )
                }
                title={gearName(device)}
                description={deviceDescription(device)}
                trailing={
                  device.isPrimary ? (
                    <Pill theme={theme} text={s.primary} />
                  ) : undefined
                }
                onPress={() =>
                  onNavigate({ kind: "profile-gear-edit", gearId: device.id })
                }
              />
            ))}
          </ListCard>
          <Footnote text={s.devicesHint} theme={theme} />
        </ProfileSection>
      ) : null}

      {retired.length > 0 ? (
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            title={fillTemplate(g.archive, { count: retired.length })}
            onPress={() => onNavigate({ kind: "profile-gear-archive" })}
          />
        </ListCard>
      ) : null}

      <ProfileSection>
        <View style={styles.buttons}>
          <SheetButton
            label={s.addGear}
            onPress={() => setAddVisible(true)}
            theme={theme}
            themeMode={themeMode}
          />
          {stravaConnected ? (
            <SheetButton
              label={g.importStrava}
              variant="secondary"
              pending={importGear.isPending}
              onPress={() => void runImport()}
              theme={theme}
              themeMode={themeMode}
              style={{ backgroundColor: theme.color.card }}
            />
          ) : null}
        </View>
        <Footnote text={s.footnote} theme={theme} />
      </ProfileSection>

      <ProfileSheet
        visible={addVisible}
        onClose={() => setAddVisible(false)}
        title={s.addSheet.title}
        tiles={[
          {
            key: "shoes",
            label: s.addSheet.shoes.title,
            description: s.addSheet.shoes.description,
            icon: (
              <Footprints
                color={fg}
                size={ROW_ICON}
                strokeWidth={ICON_STROKE}
              />
            ),
            onPress: () =>
              onNavigate({ kind: "profile-gear-edit", type: "shoes" }),
          },
          {
            key: "watch",
            label: s.addSheet.watch.title,
            description: s.addSheet.watch.description,
            icon: (
              <Watch color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
            ),
            onPress: () =>
              onNavigate({ kind: "profile-gear-edit", type: "watch" }),
          },
          {
            key: "sensor",
            label: s.addSheet.sensor.title,
            description: s.addSheet.sensor.description,
            icon: (
              <HeartPulse
                color={fg}
                size={ROW_ICON}
                strokeWidth={ICON_STROKE}
              />
            ),
            onPress: () =>
              onNavigate({ kind: "profile-gear-edit", type: "sensor" }),
          },
          ...(stravaConnected
            ? [
                {
                  key: "import",
                  label: s.addSheet.import.title,
                  description: s.addSheet.import.description,
                  icon: (
                    <Download
                      color={fg}
                      size={ROW_ICON}
                      strokeWidth={ICON_STROKE}
                    />
                  ),
                  onPress: () => void runImport(),
                },
              ]
            : []),
        ]}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <ProfileSheet
        visible={result !== null}
        onClose={() => setResult(null)}
        title={
          imported > 0
            ? pluralize(s.import.title, imported, language)
            : s.import.nothing
        }
        badge={<Download color={fg} size={26} strokeWidth={ICON_STROKE} />}
        actions={(result?.items ?? []).map((item) => ({
          key: item.id,
          label: gearName(item),
          value: format.distance(item.distanceKm, 0),
          onPress: () =>
            onNavigate({ kind: "profile-gear-detail", gearId: item.id }),
        }))}
        body={imported > 0 ? s.import.body : undefined}
        buttons={[{ label: s.import.done }]}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    overflow: "hidden",
  },
  shoe: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  shoeTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flex: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  buttons: {
    gap: 8,
  },
  pressed: {
    opacity: 0.82,
  },
});
