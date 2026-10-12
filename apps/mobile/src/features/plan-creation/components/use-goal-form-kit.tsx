import { useCallback, type ReactNode } from "react";
import { View } from "react-native";
import {
  type AthleteGoalPayloadInput,
  type AthleteGoalType,
} from "@trefix/api-client";
import { type ThemeTokens } from "@trefix/tokens";
import { Ruler } from "@trefix/ui-native";
import { type MainCopy } from "../../../locales";
import { SheetBlock } from "../../../shared/ui/bottom-sheet";
import { TargetDatePicker } from "./target-date-picker";
import {
  CirclePicker,
  FieldBlock,
  OptionalField,
  OptionalSection,
} from "./plan-creation-ui";
import { styles } from "./goal-setup-step.styles";
import {
  Stack,
  SECTION_GAP,
  FIELD_GAP,
  COMPACT_GAP,
  RUNS_PER_WEEK_SEGMENTS,
  defaultTargetDate,
  formatDuration,
  asNumber,
  type Metrics,
  type Item,
  type Kind,
} from "./goal-setup-helpers";

export type GoalFormProps = {
  goalType: AthleteGoalType;
  draft: AthleteGoalPayloadInput;
  theme: ThemeTokens;
  copy: MainCopy;
  onChangeDraft: (
    updater: (prev: AthleteGoalPayloadInput) => AthleteGoalPayloadInput,
  ) => void;
};

/**
 * Controls and sections shared by every goal form. The forms only lay them
 * out; reading and writing the draft happens here.
 */
export function useGoalFormKit({
  goalType,
  draft,
  theme,
  copy,
  onChangeDraft,
}: GoalFormProps) {
  const creationCopy = copy.plan.creation;
  const f = creationCopy.goalForm;
  const units = creationCopy.units;
  const challengeMetricsCopy = creationCopy.challengeMetrics;
  const challengePeriodsCopy = creationCopy.challengePeriods;
  const paceUnit = `${units.min}/${units.km}`;
  const durationLabel = (minutes: number) => formatDuration(minutes, units);

  const target: Metrics = draft.target ?? {};
  const current: Metrics = draft.current ?? {};

  const update = useCallback(
    (kind: Kind, changes: Metrics) => {
      onChangeDraft((prev) => {
        const next: Metrics = { ...(prev[kind] ?? {}) };
        for (const [key, value] of Object.entries(changes)) {
          if (value === undefined || value === null || value === "")
            delete next[key];
          else next[key] = value;
        }
        return {
          ...prev,
          type: goalType,
          [kind]: Object.keys(next).length > 0 ? next : undefined,
        };
      });
    },
    [goalType, onChangeDraft],
  );
  const setter = (kind: Kind, key: string) => (value: unknown) =>
    update(kind, { [key]: value });
  const read = (kind: Kind, key: string, fallback: number) =>
    asNumber((kind === "target" ? target : current)[key]) ?? fallback;

  // ---------- controls ----------

  /** Ruler in km over a metres field. */
  const kmRuler = (
    meters: number,
    onChange: (meters: number) => void,
    { min, max, step = 1 }: { min: number; max: number; step?: number },
    label: string,
  ) => (
    <Ruler
      value={meters / 1000}
      onChange={(km) => onChange(Math.round(km * 1000))}
      min={min}
      max={max}
      step={step}
      unit={units.km}
      accessibilityLabel={label}
      theme={theme}
    />
  );

  const plainRuler = (
    value: number,
    onChange: (value: number) => void,
    opts: {
      min: number;
      max: number;
      step?: number;
      unit?: string;
      majorEvery?: number;
      labelEvery?: number;
      formatValue?: (v: number) => string;
      formatLabel?: (v: number) => string;
    },
    label: string,
  ) => (
    <Ruler
      value={value}
      onChange={onChange}
      min={opts.min}
      max={opts.max}
      step={opts.step ?? 1}
      unit={opts.unit}
      majorEvery={opts.majorEvery}
      labelEvery={opts.labelEvery}
      formatValue={opts.formatValue}
      formatLabel={opts.formatLabel}
      accessibilityLabel={label}
      theme={theme}
    />
  );

  const minutesRuler = (
    value: number,
    onChange: (v: number) => void,
    max: number,
    label: string,
  ) =>
    plainRuler(
      value,
      onChange,
      {
        min: 5,
        max,
        step: 5,
        majorEvery: 15,
        labelEvery: 30,
        formatValue: durationLabel,
      },
      label,
    );

  const weeklyKmRuler = (value: number, onChange: (v: number) => void) =>
    plainRuler(
      value,
      onChange,
      { min: 1, max: 400, unit: units.km },
      f.weeklyDistance,
    );

  // Same round-button picker as weekdays / workouts per week on later steps.
  const runsSegmented = (value: number, onChange: (v: number) => void) => (
    <CirclePicker
      options={RUNS_PER_WEEK_SEGMENTS}
      selected={[value]}
      onPress={onChange}
      theme={theme}
    />
  );

  /** Field that is part of a section as soon as the section exists. */
  const field = (label: string, control: ReactNode, info?: string) => (
    <FieldBlock key={label} label={label} info={info} theme={theme}>
      {control}
    </FieldBlock>
  );

  /** Optional field inside the goal section, hidden behind "+ Add …". */
  const optionalTarget = (
    key: string,
    fallback: number,
    label: string,
    addLabel: string,
    render: (value: number, onChange: (v: number) => void) => ReactNode,
    info?: string,
  ) => {
    const value = asNumber(target[key]);
    const set = setter("target", key);
    const node = (
      <OptionalField
        key={`target-${key}`}
        label={label}
        info={info}
        addLabel={addLabel}
        removeLabel={f.remove}
        isSet={value !== undefined}
        onSet={() => set(fallback)}
        onRemove={() => set(undefined)}
        theme={theme}
      >
        {value !== undefined ? render(value, set) : null}
      </OptionalField>
    );
    return { node, compact: value === undefined };
  };

  // ---------- sections ----------

  // The goal fields come first and need no heading: the step title already says it.
  const goalSection = (...children: Item[]) => (
    <SheetBlock theme={theme}>
      <Stack items={children} gap={FIELD_GAP} compactGap={COMPACT_GAP} />
    </SheetBlock>
  );

  /** Optional "Current level" section; `defaults` are stored when it is opened. */
  const currentSection = (
    defaults: Metrics,
    ...children: ReactNode[]
  ): Item => ({
    compact: Object.keys(current).length === 0,
    node: (
      <OptionalSection
        title={f.currentSection}
        description={f.currentHint}
        addLabel={f.addCurrent}
        removeLabel={f.removeCurrent}
        isOpen={Object.keys(current).length > 0}
        onOpen={() => update("current", defaults)}
        onRemove={() =>
          onChangeDraft((prev) => ({ ...prev, current: undefined }))
        }
        theme={theme}
      >
        <View style={styles.fields}>{children}</View>
      </OptionalSection>
    ),
  });

  const targetDate = draft.targetDate;
  const dateSection: Item = {
    compact: !targetDate,
    node: (
      <OptionalSection
        title={f.dateSection}
        description={f.dateHint}
        addLabel={f.addDate}
        removeLabel={f.removeDate}
        isOpen={Boolean(targetDate)}
        onOpen={() =>
          onChangeDraft((prev) => ({
            ...prev,
            targetDate: defaultTargetDate(),
          }))
        }
        onRemove={() =>
          onChangeDraft((prev) => ({ ...prev, targetDate: undefined }))
        }
        theme={theme}
      >
        {targetDate ? (
          <TargetDatePicker
            value={targetDate}
            onChange={(iso) =>
              onChangeDraft((prev) => ({ ...prev, targetDate: iso }))
            }
            theme={theme}
            copy={copy}
          />
        ) : null}
      </OptionalSection>
    ),
  };

  const screen = (...sections: Item[]) => (
    <Stack items={sections} gap={SECTION_GAP} compactGap={COMPACT_GAP} />
  );

  // ---------- per goal type ----------

  return {
    goalType,
    draft,
    theme,
    copy,
    onChangeDraft,
    creationCopy,
    f,
    units,
    challengeMetricsCopy,
    challengePeriodsCopy,
    paceUnit,
    durationLabel,
    target,
    current,
    update,
    setter,
    read,
    kmRuler,
    plainRuler,
    minutesRuler,
    weeklyKmRuler,
    runsSegmented,
    field,
    optionalTarget,
    goalSection,
    currentSection,
    targetDate,
    dateSection,
    screen,
  };
}

export type GoalFormKit = ReturnType<typeof useGoalFormKit>;
