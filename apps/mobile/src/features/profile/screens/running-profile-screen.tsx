import { StyleSheet, View } from "react-native";
import {
  CalendarDays,
  Footprints,
  Gauge,
  HeartPulse,
  Ruler,
} from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import {
  fillTemplate,
  pluralize,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import {
  formatNumber,
  kgToDisplay,
  kmToDisplay,
} from "../../../shared/lib/units";
import { Pill, SourceBadge } from "../../../shared/ui/list-card";
import { trackEvent } from "../../../lib/analytics";
import {
  BodyTitle,
  CardBody,
  CircleRow,
  HEADER_ICON,
  ICON_STROKE,
  KeyValue,
  Meta,
  ProfileCard,
  StatGrid,
  WearBar,
  ZoneStrip,
} from "../components/profile-ui";
import { Footnote, ProfileSubScreen } from "../components/profile-sub-screen";
import { useAthleteProfile } from "../hooks/use-athlete-profile";
import { useGear } from "../hooks/use-gear";
import { usePreferences } from "../hooks/use-preferences";
import { useUnitFormat } from "../hooks/use-unit-format";
import {
  ageFrom,
  gearName,
  orderedWeekdays,
  weekdayShort,
  zoneRangeShort,
} from "../lib/profile-format";
import { type ProfileNavigate } from "../profile-routes";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
  onNavigate: ProfileNavigate;
};

const SHOES_ON_HUB = 2;

/** Running profile hub: a summary card per group of athlete inputs, each opens its screen. */
export function RunningProfileScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
  onNavigate,
}: Props) {
  const { data: athlete } = useAthleteProfile();
  const { data: gear } = useGear("active");
  const { preferences } = usePreferences();
  const format = useUnitFormat(copy, language);
  const p = copy.profile;
  const r = p.running;
  const fg = theme.color.foreground;
  const dash = "—";

  const open = (route: Parameters<ProfileNavigate>[0]) => {
    trackEvent("profile_section_opened", { section: route.kind });
    onNavigate(route);
  };

  const sourceBadge = (field: "weightKg" | "heightCm") => {
    const source = athlete?.fieldSources?.[field]?.source;
    if (source === "strava") return <SourceBadge theme={theme} />;
    if (source === "apple_health" || source === "health_connect")
      return <SourceBadge theme={theme} label="H" />;
    return undefined;
  };

  const age = athlete ? (ageFrom(athlete.birthDate) ?? athlete.age) : null;
  const heightValue = athlete?.heightCm
    ? format.heightUnits === "imperial"
      ? format.height(athlete.heightCm)
      : String(Math.round(athlete.heightCm))
    : dash;
  const weightValue = athlete?.weightKg
    ? formatNumber(
        Math.round(kgToDisplay(athlete.weightKg, format.weightUnits)),
        0,
        format.locale,
      )
    : dash;
  const zones = athlete?.hrZones ?? null;
  const shoes = (gear ?? [])
    .filter((item) => item.type === "shoes")
    .slice(0, SHOES_ON_HUB);
  const days = athlete?.availableTrainingDays ?? [];
  const limitations =
    athlete?.limitations === ""
      ? r.none
      : athlete?.limitations
        ? athlete.limitations
        : p.summary.notSet;

  return (
    <ProfileSubScreen
      title={r.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.cards}>
        <ProfileCard
          theme={theme}
          title={p.rows.body}
          icon={
            <Ruler color={fg} size={HEADER_ICON} strokeWidth={ICON_STROKE} />
          }
          onPress={() => open({ kind: "profile-body" })}
        >
          <StatGrid
            theme={theme}
            stats={[
              {
                value: age !== null && age !== undefined ? String(age) : dash,
                unit: age ? pluralize(r.ageUnit, age, language) : undefined,
                label: r.age,
              },
              {
                value: heightValue,
                unit:
                  athlete?.heightCm && format.heightUnits === "metric"
                    ? format.labels.cm
                    : undefined,
                label: r.height,
                badge: sourceBadge("heightCm"),
              },
              {
                value: weightValue,
                unit: athlete?.weightKg
                  ? format.weightUnits === "imperial"
                    ? format.labels.lb
                    : format.labels.kg
                  : undefined,
                label: r.weight,
                badge: sourceBadge("weightKg"),
              },
            ]}
          />
        </ProfileCard>

        <ProfileCard
          theme={theme}
          title={p.rows.heart}
          icon={
            <HeartPulse
              color={fg}
              size={HEADER_ICON}
              strokeWidth={ICON_STROKE}
            />
          }
          onPress={() => open({ kind: "profile-heart" })}
        >
          <StatGrid
            theme={theme}
            stats={[
              {
                value: athlete?.restingHeartRate
                  ? String(athlete.restingHeartRate)
                  : dash,
                label: r.rest,
              },
              {
                value: athlete?.maxHeartRate
                  ? String(athlete.maxHeartRate)
                  : dash,
                label: r.max,
              },
              {
                value: athlete?.thresholdHeartRate
                  ? String(athlete.thresholdHeartRate)
                  : dash,
                label: r.threshold,
              },
            ]}
          />
          {zones ? (
            <CardBody style={styles.zonesBody}>
              <ZoneStrip theme={theme} labels={zones.map(zoneRangeShort)} />
              <Meta
                theme={theme}
                text={r.zonesBy[athlete?.hrZonesMethod ?? "max_hr"]}
              />
            </CardBody>
          ) : null}
        </ProfileCard>

        <ProfileCard
          theme={theme}
          title={p.rows.schedule}
          icon={
            <CalendarDays
              color={fg}
              size={HEADER_ICON}
              strokeWidth={ICON_STROKE}
            />
          }
          onPress={() => open({ kind: "profile-schedule" })}
        >
          <CardBody>
            <CircleRow
              theme={theme}
              items={orderedWeekdays(preferences.weekStart).map((day) => ({
                key: day,
                label: weekdayShort(copy, day),
                state: days.includes(day) ? "on" : "idle",
              }))}
            />
            <StatGrid
              theme={theme}
              compact
              stats={[
                {
                  value: athlete ? String(athlete.sessionsPerWeek) : dash,
                  label: r.perWeek,
                },
                {
                  value: athlete?.weeklyMileageKm
                    ? `~${formatNumber(Math.round(kmToDisplay(athlete.weeklyMileageKm, format.units)), 0, format.locale)}`
                    : dash,
                  unit: athlete?.weeklyMileageKm
                    ? format.units === "imperial"
                      ? format.labels.mi
                      : format.labels.km
                    : undefined,
                  label: r.volume,
                },
                {
                  value: athlete?.longRunDay
                    ? weekdayShort(copy, athlete.longRunDay)
                    : dash,
                  label: r.longRun,
                },
                {
                  value: athlete
                    ? p.schedule.times[athlete.preferredTimeOfDay ?? "any"]
                    : dash,
                  label: r.time,
                },
              ]}
            />
          </CardBody>
        </ProfileCard>

        <ProfileCard
          theme={theme}
          title={p.rows.gear}
          icon={
            <Footprints
              color={fg}
              size={HEADER_ICON}
              strokeWidth={ICON_STROKE}
            />
          }
          onPress={() => open({ kind: "profile-gear" })}
        >
          <CardBody>
            {shoes.length === 0 ? (
              <Meta
                theme={theme}
                text={p.gearScreen.noShoes}
                numberOfLines={2}
              />
            ) : (
              shoes.map((shoe, index) => (
                <View
                  key={shoe.id}
                  style={[
                    styles.shoe,
                    index > 0 && {
                      paddingTop: 12,
                      borderTopWidth: 1,
                      borderTopColor: theme.color.screen,
                    },
                  ]}
                >
                  <View style={styles.shoeTop}>
                    <BodyTitle
                      theme={theme}
                      text={gearName(shoe)}
                      style={styles.flex}
                    />
                    {shoe.replaceSoon ? (
                      <Pill
                        theme={theme}
                        text={p.summary.replaceSoon}
                        tone="warning"
                      />
                    ) : null}
                  </View>
                  <WearBar theme={theme} percent={shoe.wearPercent ?? 0} />
                  <Meta
                    theme={theme}
                    text={fillTemplate(r.gearMeta, {
                      distance: format.distance(shoe.distanceKm, 0),
                      limit: format.distance(shoe.limitKm ?? 0, 0),
                      workouts: pluralize(
                        r.workouts,
                        shoe.workoutsCount,
                        language,
                      ),
                    })}
                  />
                </View>
              ))
            )}
          </CardBody>
        </ProfileCard>

        <ProfileCard
          theme={theme}
          title={p.rows.experience}
          icon={
            <Gauge color={fg} size={HEADER_ICON} strokeWidth={ICON_STROKE} />
          }
          onPress={() => open({ kind: "profile-experience" })}
        >
          <CardBody>
            <KeyValue
              theme={theme}
              label={r.level}
              value={
                athlete
                  ? p.levels[athlete.experienceLevel as keyof typeof p.levels]
                  : dash
              }
            />
            <KeyValue
              theme={theme}
              label={r.since}
              value={
                athlete?.runningSinceYear
                  ? String(athlete.runningSinceYear)
                  : p.summary.notSet
              }
            />
            <KeyValue theme={theme} label={r.limitations} value={limitations} />
          </CardBody>
        </ProfileCard>
      </View>
      <Footnote text={r.footnote} theme={theme} />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  cards: {
    gap: 20,
  },
  zonesBody: {
    paddingTop: 0,
  },
  shoe: {
    gap: 8,
  },
  shoeTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  flex: {
    flex: 1,
  },
});
