import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";

import { type QuietHours } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { Compound } from "@workspace/ui-native";

import { type MainCopy } from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
import { SectionTitle } from "../../../shared/ui/list-card";
import { SheetActionsColumn } from "../../plans/components/plans-ui";

type Props = {
  visible: boolean;
  value: QuietHours | null;
  onSave: (value: QuietHours | null) => void;
  onClose: () => void;
  copy: MainCopy;
  theme: ThemeTokens;
  themeMode: ThemeMode;
};

const DEFAULT: QuietHours = { from: "22:00", to: "08:00" };
const pad = (value: number) => String(value).padStart(2, "0");
const parse = (time: string): [number, number] => {
  const [hours, minutes] = time.split(":").map(Number);
  return [hours || 0, minutes || 0];
};

/** Start and end of quiet hours as two "h : min" wheels. */
export function QuietHoursSheet({
  visible,
  value,
  onSave,
  onClose,
  copy,
  theme,
  themeMode,
}: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<QuietHours>(value ?? DEFAULT);
  const c = copy.profile.coach;
  const labels = copy.profile.unitLabels;

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setDraft(value ?? DEFAULT);
    }
  }, [visible, value]);

  const picker = (key: keyof QuietHours, title: string) => {
    const [hours, minutes] = parse(draft[key]);
    return (
      <View style={styles.picker}>
        <SectionTitle text={title} theme={theme} />
        <Compound
          parts={[
            {
              label: labels.h,
              value: hours,
              min: 0,
              max: 23,
              formatValue: pad,
            },
            {
              label: labels.min,
              value: minutes,
              min: 0,
              max: 55,
              step: 5,
              formatValue: pad,
            },
          ]}
          separator=":"
          onChangePart={(index, next) => {
            const parts = parse(draft[key]);
            parts[index] = next;
            setDraft({ ...draft, [key]: `${pad(parts[0])}:${pad(parts[1])}` });
          }}
          accessibilityLabel={title}
          theme={theme}
          themeMode={themeMode}
        />
      </View>
    );
  };

  return (
    <BottomSheet
      title={c.quietHours}
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
        <SheetBlock theme={theme}>
          <View style={styles.pickers}>
            {picker("from", c.quietHoursFrom)}
            {picker("to", c.quietHoursTo)}
          </View>
        </SheetBlock>
        <SheetBlock theme={theme}>
          <SheetActionsColumn>
            <SheetButton
              label={copy.profile.valueSheet.save}
              onPress={() => {
                onSave(draft);
                setOpen(false);
              }}
              theme={theme}
              themeMode={themeMode}
            />
            {value ? (
              <SheetButton
                label={c.quietHoursDisable}
                variant="secondary"
                onPress={() => {
                  onSave(null);
                  setOpen(false);
                }}
                theme={theme}
                themeMode={themeMode}
              />
            ) : null}
            <SheetButton
              label={copy.profile.valueSheet.cancel}
              variant="secondary"
              onPress={() => setOpen(false)}
              theme={theme}
              themeMode={themeMode}
            />
          </SheetActionsColumn>
        </SheetBlock>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: {
    width: "100%",
  },
  content: {
    gap: 16,
    paddingTop: 72,
    paddingBottom: 32,
  },
  pickers: {
    gap: 16,
  },
  picker: {
    gap: 8,
  },
});
