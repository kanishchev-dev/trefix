import React, { useState, useEffect, useMemo } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Plus, Minus } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
  SheetTabs,
} from "../../../../shared/ui/bottom-sheet";
import { useCreateWorkout } from "../../hooks/use-workouts";
import { type MainCopy } from "../../../../locales";

export type ManualWorkoutType = "easy" | "tempo" | "interval" | "hill" | "race";
export type WorkoutGoalMode = "duration" | "distance";

type Props = {
  visible: boolean;
  onClose: () => void;
  date: string; // YYYY-MM-DD
  workoutType: ManualWorkoutType;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

const DISTANCE_PRESETS = [3, 5, 8, 10, 12, 15, 21, 42];
const DURATION_PRESETS = [20, 30, 45, 60, 90, 120];

/**
 * Reference sheet of the app (opened from the "add workout" type buttons
 * on the Today screen). Renders inside the shared BottomSheet shell that
 * was extracted 1:1 from this sheet.
 */
export function WorkoutGoalSheet({
  visible,
  onClose,
  date,
  workoutType,
  theme,
  themeMode,
  copy,
}: Props) {
  const createWorkoutMutation = useCreateWorkout();
  const goalSheetCopy = copy?.today?.goalSheet || {};

  const [mode, setMode] = useState<WorkoutGoalMode>("distance");
  const [distanceVal, setDistanceVal] = useState("10");
  const [durationVal, setDurationVal] = useState("45");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (visible) {
      setErrorMessage("");
    }
  }, [visible]);

  // Date validation check (today or future date)
  const isFutureOrToday = useMemo(() => {
    if (!date) return true;
    const target = new Date(`${date}T00:00:00.000`);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return target.getTime() >= today.getTime();
  }, [date]);

  const parsedValue = useMemo(() => {
    const val =
      mode === "distance"
        ? parseFloat(distanceVal.replace(",", "."))
        : parseInt(durationVal, 10);
    return isNaN(val) ? 0 : val;
  }, [mode, distanceVal, durationVal]);

  const isValid = parsedValue > 0 && isFutureOrToday && !createWorkoutMutation.isPending;

  const handleDecrement = () => {
    if (mode === "distance") {
      const current = parseFloat(distanceVal.replace(",", ".")) || 0;
      const next = Math.max(0.5, current - 1);
      setDistanceVal(next.toString());
    } else {
      const current = parseInt(durationVal, 10) || 0;
      const next = Math.max(5, current - 5);
      setDurationVal(next.toString());
    }
  };

  const handleIncrement = () => {
    if (mode === "distance") {
      const current = parseFloat(distanceVal.replace(",", ".")) || 0;
      const next = current + 1;
      setDistanceVal(next.toString());
    } else {
      const current = parseInt(durationVal, 10) || 0;
      const next = current + 5;
      setDurationVal(next.toString());
    }
  };

  const handleSubmit = async () => {
    setErrorMessage("");

    if (!isFutureOrToday) {
      setErrorMessage(
        goalSheetCopy.futureDateOnly ||
          "Плановую тренировку можно добавить только на сегодняшнюю или будущую дату.",
      );
      return;
    }

    if (parsedValue <= 0) {
      setErrorMessage(goalSheetCopy.invalidValue || "Укажите значение больше 0");
      return;
    }

    const scheduledAt = new Date(`${date}T09:00:00.000Z`).toISOString();

    const distanceKm =
      mode === "distance" ? parsedValue : Math.max(1, Math.round(parsedValue / 6));
    const durationMinutes =
      mode === "duration" ? parsedValue : Math.max(5, Math.round(parsedValue * 6));

    try {
      await createWorkoutMutation.mutateAsync({
        scheduledAt,
        type: workoutType,
        distanceKm,
        durationMinutes,
        status: "planned",
      });

      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setErrorMessage(
        message ||
          goalSheetCopy.errorDefault ||
          "Не удалось добавить тренировку. Попробуйте ещё раз.",
      );
    }
  };

  return (
    <BottomSheet
      title={goalSheetCopy.title || "Укажите цель"}
      visible={visible}
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
    >
      {/* Mode Tabs with Animated Pill Indicator */}
      <SheetBlock theme={theme}>
        <SheetTabs
          value={mode}
          onChange={setMode}
          theme={theme}
          tabs={[
            { key: "distance" as WorkoutGoalMode, label: goalSheetCopy.tabs?.distance || "Дистанция" },
            { key: "duration" as WorkoutGoalMode, label: goalSheetCopy.tabs?.duration || "Время" },
          ]}
        />
      </SheetBlock>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        style={styles.scrollView}
      >
        {errorMessage ? (
          <SheetBlock theme={theme}>
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          </SheetBlock>
        ) : null}

        {/* Display Main Goal Value Input with Stepper Controls */}
        <SheetBlock theme={theme}>
          <View style={styles.valueDisplayArea}>
            <View style={styles.inputRow}>
              <Pressable
                onPress={handleDecrement}
                style={({ pressed }) => [
                  styles.stepperButton,
                  {
                    backgroundColor: themeMode === "dark" ? "#1a1a1e" : theme.color.surface,
                    borderColor:
                      themeMode === "dark"
                        ? "rgba(255, 255, 255, 0.08)"
                        : theme.color.border,
                  },
                  pressed && styles.buttonPressed,
                ]}
              >
                <Minus size={20} color={theme.color.foreground} />
              </Pressable>

              <View style={styles.numberWrapper}>
                <TextInput
                  editable={false}
                  style={[
                    styles.valueInput,
                    {
                      color: theme.color.foreground,
                      fontFamily: theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                  value={mode === "distance" ? distanceVal : durationVal}
                />
                <Text
                  style={[
                    styles.superscriptUnit,
                    {
                      color: theme.color.mutedForeground,
                      fontFamily: theme.typography.fontFamily.sans.semibold,
                    },
                  ]}
                >
                  {mode === "distance"
                    ? goalSheetCopy.distanceUnit || "км"
                    : goalSheetCopy.durationUnit || "мин"}
                </Text>
              </View>

              <Pressable
                onPress={handleIncrement}
                style={({ pressed }) => [
                  styles.stepperButton,
                  {
                    backgroundColor: themeMode === "dark" ? "#1a1a1e" : theme.color.surface,
                    borderColor:
                      themeMode === "dark"
                        ? "rgba(255, 255, 255, 0.08)"
                        : theme.color.border,
                  },
                  pressed && styles.buttonPressed,
                ]}
              >
                <Plus size={20} color={theme.color.foreground} />
              </Pressable>
            </View>
          </View>
        </SheetBlock>

        {/* Quick Presets Horizontal Slider (Edge-to-Edge) */}
        <SheetBlock theme={theme} edgeToEdge>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.presetsScrollContent}
            style={styles.presetsScrollView}
          >
          {(mode === "distance" ? DISTANCE_PRESETS : DURATION_PRESETS).map((preset) => {
            const isSelected =
              mode === "distance"
                ? parseFloat(distanceVal.replace(",", ".")) === preset
                : parseInt(durationVal, 10) === preset;

            return (
              <Pressable
                key={preset}
                onPress={() => {
                  if (mode === "distance") {
                    setDistanceVal(preset.toString());
                  } else {
                    setDurationVal(preset.toString());
                  }
                }}
                style={[
                  styles.presetChip,
                  {
                    backgroundColor: isSelected
                      ? theme.color.primary
                      : themeMode === "dark"
                        ? "#1a1a1e"
                        : theme.color.surface,
                    borderColor:
                      themeMode === "dark"
                        ? "rgba(255, 255, 255, 0.08)"
                        : theme.color.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetChipText,
                    {
                      color: isSelected
                        ? theme.color.primaryForeground
                        : theme.color.foreground,
                      fontFamily: isSelected
                        ? theme.typography.fontFamily.sans.bold
                        : theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {preset}{" "}
                  {mode === "distance"
                    ? goalSheetCopy.distanceUnit || "км"
                    : goalSheetCopy.durationUnit || "мин"}
                </Text>
              </Pressable>
            );
          })}
          </ScrollView>
        </SheetBlock>
      </ScrollView>

      {/* Actions Row */}
      <SheetBlock theme={theme}>
        <View style={styles.actionsRow}>
          <SheetButton
            label={goalSheetCopy.cancel || "Отменить"}
            onPress={onClose}
            variant="secondary"
            theme={theme}
            themeMode={themeMode}
          />

          <SheetButton
            label={goalSheetCopy.submit || "Добавить"}
            onPress={handleSubmit}
            disabled={!isValid}
            pending={createWorkoutMutation.isPending}
            theme={theme}
            themeMode={themeMode}
          />
        </View>
      </SheetBlock>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    width: "100%",
  },
  scrollContent: {
    gap: 20,
    paddingVertical: 12,
  },
  errorBanner: {
    backgroundColor: "rgba(220, 38, 38, 0.2)",
    padding: 12,
    borderRadius: 12,
    width: "100%",
  },
  errorText: {
    color: "#dc2626",
    fontSize: 13,
    textAlign: "center",
  },
  valueDisplayArea: {
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    gap: 12,
    marginVertical: 12,
  },
  numberWrapper: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  superscriptUnit: {
    position: "absolute",
    top: -20,
    left: 0,
    right: 0,
    textAlign: "center",
    fontSize: 10,
    lineHeight: 12,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  stepperButton: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  valueInput: {
    fontSize: 48,
    lineHeight: 56,
    textAlign: "center",
    minWidth: 90,
  },
  presetsScrollView: {
    width: "100%",
    maxHeight: 50,
  },
  presetsScrollContent: {
    gap: 10,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  presetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  presetChipText: {
    fontSize: 14,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
});
