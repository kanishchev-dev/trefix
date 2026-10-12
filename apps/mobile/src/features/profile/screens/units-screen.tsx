import { StyleSheet, View } from "react-native";

import { type UserPreferencesUpdate } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { Segmented } from "@trefix/ui-native";

import { trackEvent } from "../../../lib/analytics";
import { type AppLanguage, type MainCopy } from "../../../locales";
import { formatPace } from "../../../shared/lib/units";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import {
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import { usePreferences, useUpdatePreferences } from "../hooks/use-preferences";
import { createFormatter } from "../lib/profile-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

const COMPACT_SEGMENT_WIDTH = 168;

/** D1 — metric/imperial with a live preview, week start and time format. */
export function UnitsScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const { preferences } = usePreferences();
  const update = useUpdatePreferences();
  const u = copy.profile.unitsScreen;
  const format = createFormatter(copy, language, preferences);

  const set = (patch: UserPreferencesUpdate) => {
    if (patch.units) trackEvent("units_changed", { units: patch.units });
    update.mutate(patch);
  };

  return (
    <ProfileSubScreen
      title={u.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={u.system} theme={theme} />
        <Segmented
          segments={[
            { value: "metric" as const, label: u.metric },
            { value: "imperial" as const, label: u.imperial },
          ]}
          value={preferences.units}
          onChange={(units) => set({ units })}
          theme={theme}
          themeMode={themeMode}
        />
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={u.preview} theme={theme} />
        <ListCard theme={theme}>
          <ListRow
            theme={theme}
            title={u.distance}
            value={format.distance(10)}
          />
          <ListRow
            theme={theme}
            title={u.pace}
            value={formatPace(330, preferences.units, format.labels)}
          />
          <ListRow theme={theme} title={u.weight} value={format.weight(72.4)} />
          <ListRow theme={theme} title={u.height} value={format.height(181)} />
        </ListCard>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={u.format} theme={theme} />
        <ListCard theme={theme}>
          <ListRow
            theme={theme}
            title={u.weekStart}
            trailing={
              <View style={styles.compact}>
                <Segmented
                  segments={[
                    { value: "mon" as const, label: u.mon },
                    { value: "sun" as const, label: u.sun },
                  ]}
                  value={preferences.weekStart}
                  onChange={(weekStart) => set({ weekStart })}
                  theme={theme}
                  themeMode={themeMode}
                />
              </View>
            }
          />
          <ListRow
            theme={theme}
            title={u.timeFormat}
            trailing={
              <View style={styles.compact}>
                <Segmented
                  segments={[
                    { value: "24h" as const, label: u.h24 },
                    { value: "12h" as const, label: u.h12 },
                  ]}
                  value={preferences.timeFormat}
                  onChange={(timeFormat) => set({ timeFormat })}
                  theme={theme}
                  themeMode={themeMode}
                />
              </View>
            }
          />
        </ListCard>
      </ProfileSection>
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  compact: {
    width: COMPACT_SEGMENT_WIDTH,
  },
});
