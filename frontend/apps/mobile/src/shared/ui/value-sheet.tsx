import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { Compound, Wheel } from "@trefix/ui-native";

import { BottomSheet, SheetBlock, SheetButton } from "./bottom-sheet";
import { SheetSubtitle } from "./sheet-list";

type Common = {
  title: string;
  subtitle?: string;
  /** Second button: e.g. "Clear" (value null) or "Keep 6.74 km". */
  secondary?: { label: string; value: number | null };
  onSave: (value: number | null) => void;
};

export type ValueSheetConfig =
  | (Common & {
      /** Seconds; `seconds: false` edits hours and minutes only. */
      kind: "duration";
      value: number;
      seconds: boolean;
      maxHours?: number;
      labels: { h: string; min: string; s: string };
    })
  | (Common & {
      /** Two decimals, e.g. kilometres. */
      kind: "decimal";
      value: number;
      max: number;
      unit: string;
      separator: string;
    })
  | (Common & {
      kind: "integer";
      value: number;
      min: number;
      max: number;
      unit?: string;
    });

type Props = {
  config: ValueSheetConfig | null;
  onClose: () => void;
  doneLabel: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

/** One value on a system wheel with "Done": the profile value sheet without a server round trip. */
export function ValueSheet({
  config,
  onClose,
  doneLabel,
  theme,
  themeMode,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(0);
  const shown = useRef<ValueSheetConfig | null>(null);
  if (config) shown.current = config;
  const current = shown.current;

  // Opens when a config arrives; a new config object for the same open sheet
  // (the owner re-rendered) must not reset what the user is dialling.
  const opened = useRef(false);
  useEffect(() => {
    if (!config) {
      opened.current = false;
      return;
    }
    if (opened.current) return;
    opened.current = true;
    setDraft(config.value);
    setOpen(true);
  }, [config]);

  if (!current) return null;

  const finish = (value: number | null) => {
    current.onSave(value);
    setOpen(false);
  };

  return (
    <BottomSheet
      title={current.title}
      visible={open}
      animatedHide
      onClose={() => {
        setOpen(false);
        onClose();
      }}
      theme={theme}
      themeMode={themeMode}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {current.subtitle ? (
          <SheetBlock theme={theme}>
            <SheetSubtitle text={current.subtitle} theme={theme} />
          </SheetBlock>
        ) : null}
        <SheetBlock theme={theme}>
          <ValueControl
            config={current}
            value={draft}
            onChange={setDraft}
            theme={theme}
            themeMode={themeMode}
          />
        </SheetBlock>
        <SheetBlock theme={theme}>
          <View style={styles.buttons}>
            <SheetButton
              label={doneLabel}
              onPress={() => finish(draft)}
              theme={theme}
              themeMode={themeMode}
            />
            {current.secondary ? (
              <SheetButton
                label={current.secondary.label}
                variant="secondary"
                onPress={() => finish(current.secondary!.value)}
                theme={theme}
                themeMode={themeMode}
              />
            ) : null}
          </View>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

function ValueControl({
  config,
  value,
  onChange,
  theme,
  themeMode,
}: {
  config: ValueSheetConfig;
  value: number;
  onChange: (value: number) => void;
  theme: ThemeTokens;
  themeMode: ThemeMode;
}) {
  if (config.kind === "duration") {
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor((value % 3600) / 60);
    const seconds = value % 60;
    const pad = (v: number) => String(v).padStart(2, "0");
    const parts = [
      {
        label: config.labels.h,
        value: hours,
        min: 0,
        max: config.maxHours ?? 9,
      },
      {
        label: config.labels.min,
        value: minutes,
        min: 0,
        max: 59,
        formatValue: pad,
      },
      ...(config.seconds
        ? [
            {
              label: config.labels.s,
              value: seconds,
              min: 0,
              max: 59,
              formatValue: pad,
            },
          ]
        : []),
    ];
    return (
      <Compound
        parts={parts}
        onChangePart={(index, next) => {
          const h = index === 0 ? next : hours;
          const m = index === 1 ? next : minutes;
          const s = index === 2 ? next : config.seconds ? seconds : 0;
          onChange(h * 3600 + m * 60 + s);
        }}
        separator=":"
        theme={theme}
        themeMode={themeMode}
        accessibilityLabel={config.title}
      />
    );
  }
  if (config.kind === "decimal") {
    const whole = Math.floor(value + 1e-9);
    const hundredths = Math.round((value - whole) * 100);
    return (
      <Compound
        parts={[
          { label: "", value: whole, min: 0, max: Math.floor(config.max) },
          {
            label: "",
            value: hundredths,
            min: 0,
            max: 99,
            formatValue: (v) => String(v).padStart(2, "0"),
          },
        ]}
        onChangePart={(index, next) =>
          onChange(index === 0 ? next + hundredths / 100 : whole + next / 100)
        }
        separator={config.separator}
        unit={config.unit}
        theme={theme}
        themeMode={themeMode}
        accessibilityLabel={config.title}
      />
    );
  }
  return (
    <View style={styles.wheelRow}>
      <View style={styles.wheel}>
        <Wheel
          value={value}
          onChange={onChange}
          min={config.min}
          max={config.max}
          accessibilityLabel={config.title}
          visibleItems={5}
          theme={theme}
          themeMode={themeMode}
        />
      </View>
      {config.unit ? (
        <Text
          style={[
            styles.unit,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.regular,
            },
          ]}
        >
          {config.unit}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { width: "100%" },
  content: { gap: 16, paddingTop: 72, paddingBottom: 32 },
  buttons: { gap: 8 },
  wheelRow: { flexDirection: "row", alignItems: "center" },
  wheel: { flex: 1 },
  unit: { position: "absolute", right: 20, fontSize: 15, lineHeight: 22 },
});
