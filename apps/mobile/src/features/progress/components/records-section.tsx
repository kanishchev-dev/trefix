import { Pressable, Text, View } from "react-native";
import { Plus } from "lucide-react-native";
import {
  type ProgressOverview,
  type RecordDistance,
} from "@workspace/api-client";
import { type MainCopy } from "../../../locales";
import { ListCard, ListRow, Pill } from "../../../shared/ui/list-card";
import {
  dayMonth,
  distanceLabel,
  formatDuration,
} from "../lib/progress-format";
import { styles } from "./progress-sections.styles";
import {
  fontOf,
  SectionHeader,
  Block,
  Muted,
  type Common,
} from "./progress-primitives";

export function RecordsSection({
  overview,
  onOpenRecords,
  onAddResult,
  ...common
}: Common & {
  overview: ProgressOverview;
  onOpenRecords: () => void;
  onAddResult: (distance: RecordDistance) => void;
}) {
  const { copy, language, theme } = common;
  const r = copy.progress.records;
  const hasAny = overview.records.some((record) => record.best);

  return (
    <View style={styles.section}>
      <SectionHeader
        title={copy.progress.sections.records}
        link={hasAny ? copy.progress.sections.all : undefined}
        onLink={onOpenRecords}
        theme={theme}
      />
      {hasAny ? (
        <ListCard theme={theme} plain>
          {overview.records.map((record) =>
            record.best ? (
              <ListRow
                key={record.distance}
                theme={theme}
                title={distanceLabel(copy, record.distance)}
                description={[
                  dayMonth(record.best.date, language),
                  record.best.name ??
                    sourceLabel(
                      copy,
                      record.best.provider,
                      record.best.kind,
                      record.best.source,
                    ),
                ].join(" · ")}
                value={formatDuration(record.best.seconds)}
                trailing={
                  record.best.isNew ? (
                    <Pill theme={theme} text={r.new} />
                  ) : undefined
                }
                chevron={false}
                onPress={onOpenRecords}
              />
            ) : (
              <ListRow
                key={record.distance}
                theme={theme}
                title={distanceLabel(copy, record.distance)}
                description={r.noResult}
                trailing={
                  <View style={styles.addInline}>
                    <Plus color={theme.color.foreground} size={16} />
                    <Text
                      style={[
                        styles.body,
                        {
                          color: theme.color.foreground,
                          fontFamily: fontOf(theme, "medium"),
                        },
                      ]}
                    >
                      {r.add}
                    </Text>
                  </View>
                }
                chevron={false}
                onPress={() => onAddResult(record.distance)}
              />
            ),
          )}
        </ListCard>
      ) : (
        <Block gap={10}>
          <Text
            style={[
              styles.body,
              {
                color: theme.color.foreground,
                fontFamily: fontOf(theme, "medium"),
              },
            ]}
          >
            {r.emptyTitle}
          </Text>
          <Muted theme={theme}>{r.emptyDescription}</Muted>
          <Pressable
            accessibilityRole="button"
            onPress={() => onAddResult("10k")}
            style={({ pressed }) => [
              styles.pillButton,
              { backgroundColor: theme.color.controlSecondary },
              pressed && styles.pressed,
            ]}
          >
            <Plus color={theme.color.foreground} size={16} />
            <Text
              style={[
                styles.body,
                {
                  color: theme.color.foreground,
                  fontFamily: fontOf(theme, "medium"),
                },
              ]}
            >
              {r.addResult}
            </Text>
          </Pressable>
        </Block>
      )}
    </View>
  );
}

export function sourceLabel(
  copy: MainCopy,
  provider: string | null,
  kind: string,
  source: string,
): string {
  const s = copy.progress.records.sources;
  if (provider === "strava") return s.strava;
  if (provider === "apple_health" || provider === "health_connect")
    return s.health;
  if (source === "result")
    return kind === "race" ? s.race : kind === "test" ? s.test : s.manual;
  return kind === "race" ? s.race : s.workout;
}

// ---------------------------------------------------------------- dynamics
