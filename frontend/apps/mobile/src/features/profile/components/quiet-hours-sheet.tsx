import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { type QuietHours } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";
import { Wheel } from "@trefix/ui-native";

import { type MainCopy } from "../../../locales";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
} from "../../../shared/ui/bottom-sheet";
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

/** Start and end of quiet hours as two hour wheels side by side. */
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

  useEffect(() => {
    if (visible) {
      setOpen(true);
      setDraft(value ?? DEFAULT);
    }
  }, [visible, value]);

  const muted = {
    color: theme.color.mutedForeground,
    fontFamily: theme.typography.fontFamily.sans.regular,
  };
  const wheel = (key: keyof QuietHours, title: string) => (
    <View style={styles.column}>
      <Text style={[styles.label, muted]}>{title}</Text>
      <Wheel
        value={parse(draft[key])[0]}
        onChange={(hours) => setDraft({ ...draft, [key]: `${pad(hours)}:00` })}
        min={0}
        max={23}
        formatValue={(hours) => `${pad(hours)}:00`}
        visibleItems={5}
        accessibilityLabel={title}
        theme={theme}
        themeMode={themeMode}
      />
    </View>
  );

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
          <Text style={[styles.body, muted]}>
            {copy.profile.coachScreen.quietHoursSheetBody}
          </Text>
        </SheetBlock>
        <SheetBlock theme={theme}>
          <View style={styles.pickers}>
            {wheel("from", c.quietHoursFrom)}
            {wheel("to", c.quietHoursTo)}
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
    flexDirection: "row",
    gap: 8,
  },
  column: {
    flex: 1,
    gap: 8,
  },
  label: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
});
