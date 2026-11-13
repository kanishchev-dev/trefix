import {
  type UserPreferences,
  type UserPreferencesUpdate,
} from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { trackEvent } from "../../../lib/analytics";
import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { formatPace } from "../../../shared/lib/units";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { SheetTabs } from "../../../shared/ui/sheet-controls";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import { usePreferences, useUpdatePreferences } from "../hooks/use-preferences";
import { useUnitFormat } from "../hooks/use-unit-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

/** Sample values for the live hint under each unit. */
const SAMPLE = { km: 10, paceSecPerKm: 330, kg: 72.4, cm: 181, celsius: 18 };

type UnitKey = "distanceUnit" | "weightUnit" | "heightUnit" | "temperatureUnit";

/** Units per quantity with a live example, week start and time format. */
export function UnitsScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const { preferences } = usePreferences();
  const update = useUpdatePreferences();
  const format = useUnitFormat(copy, language);
  const u = copy.profile.unitsScreen;
  const tabs = u.tabs;

  const change = (patch: UserPreferencesUpdate) => {
    trackEvent("units_changed", patch as Record<string, string>);
    update.mutate(patch);
  };

  const temperature =
    preferences.temperatureUnit === "f"
      ? `${Math.round((SAMPLE.celsius * 9) / 5 + 32)} °F`
      : `${SAMPLE.celsius} °C`;

  const unitRow = <K extends UnitKey>(
    key: K,
    title: string,
    example: string,
    options: [UserPreferences[K], UserPreferences[K]],
  ) => (
    <ListRow
      key={key}
      theme={theme}
      title={title}
      description={example}
      trailing={
        <SheetTabs
          compact
          tabs={options.map((option) => ({
            key: option as string,
            label: tabs[option as keyof typeof tabs],
          }))}
          value={preferences[key] as string}
          onChange={(value) =>
            change({ [key]: value } as UserPreferencesUpdate)
          }
          theme={theme}
          trackColor={theme.color.screen}
          accessibilityLabel={title}
        />
      }
    />
  );

  return (
    <ProfileSubScreen
      title={u.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={u.measures} theme={theme} />
        <ListCard theme={theme} bare>
          {unitRow(
            "distanceUnit",
            u.distance,
            fillTemplate(u.distanceExample, {
              distance: format.distance(SAMPLE.km, 0),
              pace: formatPace(
                SAMPLE.paceSecPerKm,
                format.units,
                format.labels,
              ),
            }),
            ["km", "mi"],
          )}
          {unitRow("weightUnit", u.weight, format.weight(SAMPLE.kg), [
            "kg",
            "lb",
          ])}
          {unitRow("heightUnit", u.height, format.height(SAMPLE.cm), [
            "cm",
            "ft",
          ])}
          {unitRow(
            "temperatureUnit",
            u.temperature,
            fillTemplate(u.temperatureExample, { value: temperature }),
            ["c", "f"],
          )}
        </ListCard>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={u.format} theme={theme} />
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            title={u.weekStart}
            trailing={
              <SheetTabs
                compact
                tabs={[
                  { key: "mon" as const, label: u.mon },
                  { key: "sun" as const, label: u.sun },
                ]}
                value={preferences.weekStart}
                onChange={(value) => change({ weekStart: value })}
                theme={theme}
                trackColor={theme.color.screen}
                accessibilityLabel={u.weekStart}
              />
            }
          />
          <ListRow
            theme={theme}
            title={u.timeFormat}
            trailing={
              <SheetTabs
                compact
                tabs={[
                  { key: "24h" as const, label: u.h24 },
                  { key: "12h" as const, label: u.h12 },
                ]}
                value={preferences.timeFormat}
                onChange={(value) => change({ timeFormat: value })}
                theme={theme}
                trackColor={theme.color.screen}
                accessibilityLabel={u.timeFormat}
              />
            }
          />
        </ListCard>
        <Footnote text={u.formatHint} theme={theme} />
      </ProfileSection>
    </ProfileSubScreen>
  );
}
