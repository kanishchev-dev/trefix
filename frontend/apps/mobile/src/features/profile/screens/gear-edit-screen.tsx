import { useEffect, useMemo, useState } from "react";
import { Platform, StyleSheet, View } from "react-native";

import {
  type GearDataSource,
  type GearInput,
  type GearType,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { trackEvent } from "../../../lib/analytics";
import {
  formatLongDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { displayToKm, kmToDisplay } from "../../../shared/lib/units";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { SheetTabs } from "../../../shared/ui/sheet-controls";
import { Switch } from "../../../shared/ui/switch";
import { InlineError } from "../../plans/components/plans-ui";
import { FormField, FormInput } from "../components/profile-form";
import { SelectedMark } from "../components/profile-ui";
import {
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "../components/profile-value-sheet";
import { useGear, useGearItem, useGearMutation } from "../hooks/use-gear";
import { useUnitFormat } from "../hooks/use-unit-format";
import {
  gearName,
  profileErrorMessage,
  splitDeviceName,
} from "../lib/profile-format";

type Props = {
  gearId?: string;
  /** Type of new gear; ignored when editing. */
  type?: GearType;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

type Draft = {
  type: GearType;
  brand: string;
  model: string;
  /** Devices: one line, split into brand and model on save. */
  name: string;
  startedAt: string | null;
  limitKm: number;
  initialDistanceKm: number;
  isDefault: boolean;
  isPrimary: boolean;
  dataSource: GearDataSource | null;
};

const DEFAULT_LIMIT_KM = 700;
const DEVICE_SOURCES: GearDataSource[] = [
  "garmin",
  Platform.OS === "android" ? "health_connect" : "apple_health",
  "strava",
];

/** Add or edit shoes, a watch or a sensor. */
export function GearEditScreen({
  gearId,
  type,
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const { data: existing } = useGearItem(gearId);
  const { data: active = [] } = useGear("active");
  const mutation = useGearMutation();
  const format = useUnitFormat(copy, language);
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const s = copy.profile.gearScreen;
  const e = s.edit;
  const hasPrimary = useMemo(
    () => active.some((item) => item.isPrimary),
    [active],
  );
  const hasDefault = useMemo(
    () => active.some((item) => item.isDefault),
    [active],
  );

  const [draft, setDraft] = useState<Draft>(() => ({
    type: type ?? "shoes",
    brand: "",
    model: "",
    name: "",
    startedAt: null,
    limitKm: DEFAULT_LIMIT_KM,
    initialDistanceKm: 0,
    isDefault: !hasDefault,
    isPrimary: !hasPrimary,
    dataSource: null,
  }));

  useEffect(() => {
    if (!existing) return;
    setDraft({
      type: existing.type,
      brand: existing.brand,
      model: existing.model,
      name: gearName(existing),
      startedAt: existing.startedAt,
      limitKm: existing.limitKm ?? DEFAULT_LIMIT_KM,
      initialDistanceKm: existing.initialDistanceKm,
      isDefault: existing.isDefault,
      isPrimary: existing.isPrimary,
      dataSource: existing.dataSource,
    });
  }, [existing]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const shoes = draft.type === "shoes";
  const distanceUnit =
    format.units === "imperial" ? format.labels.mi : format.labels.km;
  const valid = shoes
    ? draft.brand.trim().length > 0 && draft.model.trim().length > 0
    : draft.name.trim().length > 0;
  const title = shoes
    ? e.shoesTitle
    : draft.type === "watch"
      ? e.watchTitle
      : e.sensorTitle;

  const submit = async () => {
    setError(null);
    const input: GearInput = shoes
      ? {
          brand: draft.brand.trim(),
          model: draft.model.trim(),
          startedAt: draft.startedAt,
          limitKm: draft.limitKm,
          initialDistanceKm: draft.initialDistanceKm,
          isDefault: draft.isDefault,
        }
      : {
          ...splitDeviceName(draft.name),
          startedAt: draft.startedAt,
          initialDistanceKm: draft.initialDistanceKm,
          isPrimary: draft.isPrimary,
          dataSource: draft.dataSource,
        };
    try {
      if (existing) {
        await mutation.mutateAsync({
          kind: "update",
          gearId: existing.id,
          input,
        });
      } else {
        await mutation.mutateAsync({
          kind: "create",
          input: { ...input, type: draft.type },
        });
        trackEvent("gear_added", { type: draft.type });
      }
      onBack();
    } catch (submitError) {
      setError(profileErrorMessage(submitError, copy));
    }
  };

  const openStarted = () =>
    setSheet({
      kind: "date",
      title: e.startedAt,
      value: draft.startedAt,
      fallback: new Date().toISOString().slice(0, 10),
      minDate: "2010-01-01",
      clearable: true,
      onSave: async (value) => set("startedAt", value),
    });

  const openDistance = (field: "limitKm" | "initialDistanceKm") =>
    setSheet({
      kind: "number",
      title: field === "limitKm" ? e.resource : e.initial,
      value: Math.round(kmToDisplay(draft[field], format.units)),
      fallback:
        field === "limitKm"
          ? Math.round(kmToDisplay(DEFAULT_LIMIT_KM, format.units))
          : 0,
      min: field === "limitKm" ? Math.round(kmToDisplay(100, format.units)) : 0,
      max: Math.round(
        kmToDisplay(field === "limitKm" ? 2000 : 5000, format.units),
      ),
      step: 10,
      unit: distanceUnit,
      onSave: async (value) =>
        set(field, Math.round(displayToKm(value ?? 0, format.units))),
    });

  return (
    <ProfileSubScreen
      title={title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
      footer={
        <View style={styles.footer}>
          {error ? <InlineError message={error} theme={theme} /> : null}
          <SheetButton
            label={existing ? e.save : e.add}
            disabled={!valid}
            pending={mutation.isPending}
            onPress={() => void submit()}
            theme={theme}
            themeMode={themeMode}
          />
        </View>
      }
    >
      {!shoes && !existing ? (
        <ProfileSection>
          <SectionTitle text={e.type} theme={theme} />
          <SheetTabs
            tabs={[
              { key: "watch" as const, label: s.addSheet.watch.title },
              { key: "sensor" as const, label: s.addSheet.sensor.title },
            ]}
            value={draft.type === "sensor" ? "sensor" : "watch"}
            onChange={(next) => set("type", next)}
            theme={theme}
            trackColor={theme.color.card}
            accessibilityLabel={e.type}
          />
        </ProfileSection>
      ) : null}

      {shoes ? (
        <>
          <FormField theme={theme} label={e.brand}>
            <FormInput
              theme={theme}
              value={draft.brand}
              onChangeText={(value) => set("brand", value)}
              maxLength={60}
              accessibilityLabel={e.brand}
            />
          </FormField>
          <FormField theme={theme} label={e.model}>
            <FormInput
              theme={theme}
              value={draft.model}
              onChangeText={(value) => set("model", value)}
              maxLength={80}
              accessibilityLabel={e.model}
            />
          </FormField>
        </>
      ) : (
        <FormField theme={theme} label={e.model}>
          <FormInput
            theme={theme}
            value={draft.name}
            onChangeText={(value) => set("name", value)}
            maxLength={140}
            accessibilityLabel={e.model}
          />
        </FormField>
      )}

      {shoes ? (
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            title={e.startedAt}
            value={
              draft.startedAt
                ? formatLongDate(draft.startedAt, language)
                : copy.profile.summary.notSet
            }
            chevron={false}
            onPress={openStarted}
          />
          <ListRow
            theme={theme}
            title={e.resource}
            value={format.distance(draft.limitKm, 0)}
            chevron={false}
            onPress={() => openDistance("limitKm")}
          />
          <ListRow
            theme={theme}
            title={e.initial}
            description={e.initialDescription}
            value={format.distance(draft.initialDistanceKm, 0)}
            chevron={false}
            onPress={() => openDistance("initialDistanceKm")}
          />
        </ListCard>
      ) : (
        <ProfileSection>
          <SectionTitle text={e.dataSource} theme={theme} />
          <ListCard theme={theme} bare>
            {DEVICE_SOURCES.map((source) => (
              <ListRow
                key={source}
                theme={theme}
                title={s.sources[source]}
                trailing={
                  draft.dataSource === source ? (
                    <SelectedMark theme={theme} />
                  ) : undefined
                }
                chevron={false}
                onPress={() =>
                  set("dataSource", draft.dataSource === source ? null : source)
                }
              />
            ))}
          </ListCard>
        </ProfileSection>
      )}

      <ListCard theme={theme} bare>
        <ListRow
          theme={theme}
          title={shoes ? e.default : e.primary}
          description={shoes ? e.defaultDescription : e.primaryDescription}
          trailing={
            <Switch
              theme={theme}
              value={shoes ? draft.isDefault : draft.isPrimary}
              accessibilityLabel={shoes ? e.default : e.primary}
              onValueChange={(value) =>
                set(shoes ? "isDefault" : "isPrimary", value)
              }
            />
          }
        />
      </ListCard>

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
  footer: {
    gap: 12,
  },
});
