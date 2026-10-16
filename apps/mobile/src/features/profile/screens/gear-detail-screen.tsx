import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ellipsis } from "lucide-react-native";

import { type GearInput } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { formatMinutesSeconds, paceToDisplay } from "@trefix/utils";

import {
  fillTemplate,
  formatLongDate,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { displayToKm, kmToDisplay } from "../../../shared/lib/units";
import {
  ListCard,
  ListRow,
  Pill,
  SectionTitle,
} from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { useToast } from "../../../shared/ui/toast";
import { HeaderActionButton } from "../../main/components/header";
import {
  BodyTitle,
  CardBody,
  Meta,
  StatGrid,
  WearBar,
} from "../components/profile-ui";
import { ProfileSheet } from "../components/profile-sheet";
import {
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "../components/profile-value-sheet";
import { useGearItem, useGearMutation } from "../hooks/use-gear";
import { useUnitFormat } from "../hooks/use-unit-format";
import { gearName, profileErrorMessage } from "../lib/profile-format";

type Props = {
  gearId: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
  onEdit: () => void;
};

/** Card of a pair: mileage, workouts, pace, wear with a forecast and the pair's settings. */
export function GearDetailScreen({
  gearId,
  theme,
  themeMode,
  copy,
  language,
  onBack,
  onEdit,
}: Props) {
  const { data: gear } = useGearItem(gearId);
  const mutation = useGearMutation();
  const { showToast } = useToast();
  const format = useUnitFormat(copy, language);
  const [menuVisible, setMenuVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const g = copy.profile.gear;
  const s = copy.profile.gearScreen;
  const d = s.detail;
  const e = s.edit;

  const update = async (input: Partial<GearInput>) => {
    await mutation.mutateAsync({ kind: "update", gearId, input });
  };
  const updateQuietly = (input: Partial<GearInput>) =>
    void update(input).catch((error) =>
      showToast(profileErrorMessage(error, copy)),
    );

  if (!gear) {
    return (
      <ProfileSubScreen
        title={g.title}
        onBack={onBack}
        theme={theme}
        themeMode={themeMode}
      >
        {null}
      </ProfileSubScreen>
    );
  }

  const distanceUnit =
    format.units === "imperial" ? format.labels.mi : format.labels.km;
  const remaining = gear.remainingKm ?? 0;
  const weeks =
    gear.weeklyKm > 0
      ? Math.max(1, Math.round(remaining / gear.weeklyKm))
      : null;
  const pace = gear.averagePaceSecondsPerKm
    ? formatMinutesSeconds(
        paceToDisplay(gear.averagePaceSecondsPerKm, format.units),
      )
    : "—";

  const openLimit = () =>
    setSheet({
      kind: "number",
      title: e.resource,
      value: gear.limitKm
        ? Math.round(kmToDisplay(gear.limitKm, format.units))
        : null,
      fallback: Math.round(kmToDisplay(700, format.units)),
      min: Math.round(kmToDisplay(100, format.units)),
      max: Math.round(kmToDisplay(2000, format.units)),
      step: 10,
      unit: distanceUnit,
      onSave: async (value) => {
        if (value === null) return;
        await update({ limitKm: Math.round(displayToKm(value, format.units)) });
      },
    });

  const openStarted = () =>
    setSheet({
      kind: "date",
      title: e.startedAt,
      value: gear.startedAt,
      fallback: new Date().toISOString().slice(0, 10),
      minDate: "2010-01-01",
      clearable: true,
      onSave: (value) => update({ startedAt: value }),
    });

  return (
    <ProfileSubScreen
      title={gearName(gear)}
      onBack={onBack}
      rightAction={
        <HeaderActionButton
          accessibilityLabel={d.more}
          themeMode={themeMode}
          theme={theme}
          icon={
            <Ellipsis
              color={theme.color.foreground}
              size={20}
              strokeWidth={2.2}
            />
          }
          onPress={() => setMenuVisible(true)}
        />
      }
      rightActionKey={gear.id}
      theme={theme}
      themeMode={themeMode}
    >
      <View style={[styles.card, { backgroundColor: theme.color.card }]}>
        <StatGrid
          theme={theme}
          stats={[
            {
              value: String(
                Math.round(kmToDisplay(gear.distanceKm, format.units)),
              ),
              unit: distanceUnit,
              label: d.mileage,
            },
            { value: String(gear.workoutsCount), label: d.workouts },
            {
              value: pace,
              unit: gear.averagePaceSecondsPerKm
                ? format.units === "imperial"
                  ? format.labels.perMi
                  : format.labels.perKm
                : undefined,
              label: d.pace,
            },
          ]}
        />
      </View>

      {gear.type === "shoes" && gear.wearPercent !== null ? (
        <ProfileSection>
          <SectionTitle text={d.wear} theme={theme} />
          <View style={[styles.card, { backgroundColor: theme.color.card }]}>
            <CardBody>
              <View style={styles.wearTop}>
                <BodyTitle
                  theme={theme}
                  text={fillTemplate(d.wearPercent, {
                    percent: gear.wearPercent,
                  })}
                  style={styles.flex}
                />
                {gear.replaceSoon ? (
                  <Pill theme={theme} text={g.replaceSoon} tone="warning" />
                ) : null}
              </View>
              <WearBar theme={theme} percent={gear.wearPercent} />
              <Meta
                theme={theme}
                text={
                  weeks
                    ? fillTemplate(d.forecast, {
                        distance: format.distance(remaining, 0),
                        weeks: pluralize(d.weeks, weeks, language),
                      })
                    : fillTemplate(d.forecastShort, {
                        distance: format.distance(remaining, 0),
                      })
                }
              />
            </CardBody>
          </View>
        </ProfileSection>
      ) : null}

      <ListCard theme={theme} bare>
        <ListRow
          theme={theme}
          title={e.startedAt}
          value={
            gear.startedAt
              ? formatLongDate(gear.startedAt, language)
              : copy.profile.summary.notSet
          }
          chevron={false}
          onPress={openStarted}
        />
        {gear.type === "shoes" ? (
          <ListRow
            theme={theme}
            title={e.resource}
            value={format.distance(gear.limitKm ?? 0, 0)}
            chevron={false}
            onPress={openLimit}
          />
        ) : null}
        <ListRow
          theme={theme}
          title={gear.type === "shoes" ? e.default : e.primary}
          description={
            gear.type === "shoes" ? d.defaultDescription : d.primaryDescription
          }
          trailing={
            <Switch
              theme={theme}
              value={gear.type === "shoes" ? gear.isDefault : gear.isPrimary}
              disabled={gear.status === "retired"}
              accessibilityLabel={gear.type === "shoes" ? e.default : e.primary}
              onValueChange={(value) =>
                updateQuietly(
                  gear.type === "shoes"
                    ? { isDefault: value }
                    : { isPrimary: value },
                )
              }
            />
          }
        />
      </ListCard>

      <ProfileSheet
        visible={menuVisible}
        onClose={() => setMenuVisible(false)}
        title={gearName(gear)}
        actions={[
          { key: "edit", label: s.menu.edit, onPress: onEdit },
          gear.status === "active"
            ? {
                key: "retire",
                label: s.menu.retire,
                description: s.menu.retireDescription,
                onPress: () => mutation.mutateAsync({ kind: "retire", gearId }),
              }
            : {
                key: "restore",
                label: s.archive.restore,
                onPress: () =>
                  mutation.mutateAsync({ kind: "restore", gearId }),
              },
          {
            key: "delete",
            label: s.menu.delete,
            destructive: true,
            // The confirmation opens once the actions sheet has slid away.
            onPress: () => {
              setTimeout(() => setDeleteVisible(true), 320);
            },
          },
        ]}
        buttons={[{ label: s.menu.cancel, variant: "secondary" }]}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <ProfileSheet
        visible={deleteVisible}
        onClose={() => setDeleteVisible(false)}
        title={g.deleteTitle}
        body={g.deleteBody}
        buttons={[
          {
            label: g.delete,
            variant: "destructive",
            onPress: async () => {
              await mutation.mutateAsync({ kind: "delete", gearId });
              onBack();
            },
          },
          { label: g.cancel, variant: "secondary" },
        ]}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <ProfileValueSheet
        config={sheet}
        onClose={() => setSheet(null)}
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
  wearTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flex: {
    flex: 1,
  },
});
