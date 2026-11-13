import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { fillTemplate, type MainCopy } from "../../../locales";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { CardBody, Meta, zoneColors } from "../components/profile-ui";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "../components/profile-value-sheet";
import { useAthleteProfile } from "../hooks/use-athlete-profile";
import {
  currentUpperBounds,
  FALLBACK_CUSTOM_ZONES,
  useHeartSave,
} from "./heart-screen";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

/** Lower edge of the distribution bar when resting heart rate is unknown. */
const DEFAULT_FLOOR = 100;

/** Custom zones: the distribution of Z1–Z5 and the upper bound of each zone. */
export function ZonesScreen({ theme, themeMode, copy, onBack }: Props) {
  const { data: athlete } = useAthleteProfile();
  const save = useHeartSave(copy);
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const h = copy.profile.heart;
  const t = copy.profile.heartScreen;
  const bpm = copy.profile.unitLabels.bpm;

  const bounds =
    athlete?.hrZonesCustom ??
    currentUpperBounds(athlete?.hrZones) ??
    FALLBACK_CUSTOM_ZONES;
  const max =
    athlete?.maxHeartRate ?? athlete?.maxHeartRateEstimate ?? bounds[3] + 20;
  const floor = Math.min(
    athlete?.restingHeartRate ?? DEFAULT_FLOOR,
    bounds[0] - 1,
  );
  const edges = [floor, ...bounds, max];
  const colors = zoneColors(theme);

  const openBound = (index: number) =>
    setSheet({
      kind: "number",
      title: fillTemplate(h.zoneUpper, { zone: index + 1 }),
      value: bounds[index],
      fallback: bounds[index],
      min: index === 0 ? 60 : bounds[index - 1] + 1,
      max: index === 3 ? max - 1 : bounds[index + 1] - 1,
      unit: bpm,
      onSave: async (value) => {
        if (value === null) return;
        const next = [...bounds];
        next[index] = value;
        await save({ hrZonesMethod: "custom", hrZonesCustom: next });
      },
    });

  return (
    <ProfileSubScreen
      title={h.customTitle}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={t.distribution} theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.color.card }]}>
          <CardBody>
            <View style={styles.strip}>
              {edges.slice(1).map((edge, index) => (
                <View
                  key={index}
                  style={[
                    styles.segment,
                    {
                      flex: Math.max(1, edge - edges[index]),
                      backgroundColor: colors[index],
                    },
                  ]}
                />
              ))}
            </View>
            <Meta theme={theme} text={`${floor}–${max} ${bpm}`} />
          </CardBody>
        </View>
      </ProfileSection>
      <ProfileSection>
        <SectionTitle text={t.upperBounds} theme={theme} />
        <ListCard theme={theme} bare>
          {[...bounds, max].map((value, index) => (
            <ListRow
              key={index}
              theme={theme}
              icon={
                <View
                  style={[styles.dot, { backgroundColor: colors[index] }]}
                />
              }
              title={`Z${index + 1} · ${h.zoneNames[index] ?? ""}`}
              value={fillTemplate(t.upTo, { value })}
              chevron={false}
              onPress={index < 4 ? () => openBound(index) : undefined}
            />
          ))}
        </ListCard>
        <Footnote text={t.customFootnote} theme={theme} />
      </ProfileSection>
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
  strip: {
    flexDirection: "row",
    height: 12,
    borderRadius: 6,
    overflow: "hidden",
    gap: 2,
  },
  segment: {
    height: "100%",
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
