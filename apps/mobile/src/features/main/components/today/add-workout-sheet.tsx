import React, { useState, useEffect } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Calendar, Activity, Clock, Heart, Award } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { GlassInput } from "../../../../shared/ui/glass-input";
import {
  BottomSheet,
  SheetBlock,
  SheetButton,
  SheetSectionLabel,
  SheetTabs,
} from "../../../../shared/ui/bottom-sheet";
import { useCreateWorkout } from "../../hooks/use-workouts";
import { type MainCopy } from "../../../../locales";

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultDate?: string; // YYYY-MM-DD
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

const WORKOUT_TYPES = [
  { key: "easy", label: "Легкий бег" },
  { key: "long_run", label: "Длительный" },
  { key: "tempo", label: "Темповый" },
  { key: "threshold", label: "Пороговый" },
  { key: "interval", label: "Интервалы" },
  { key: "recovery", label: "Восстановление" },
  { key: "hill", label: "Горки" },
  { key: "race", label: "Забег" },
] as const;

export function AddWorkoutSheet({
  visible,
  onClose,
  defaultDate,
  theme,
  themeMode,
  copy,
}: Props) {
  const createWorkoutMutation = useCreateWorkout();
  const locale = copy?.today?.addSheet || {};

  const [mode, setMode] = useState<"planned" | "completed">("planned");
  const [dateStr, setDateStr] = useState(
    defaultDate || new Date().toISOString().split("T")[0],
  );
  const [type, setType] = useState("easy");
  const [title, setTitle] = useState("");
  const [distanceKm, setDistanceKm] = useState("5");
  const [durationMinutes, setDurationMinutes] = useState("30");

  // Additional completed fields
  const [actualDistanceKm, setActualDistanceKm] = useState("5");
  const [actualDurationMinutes, setActualDurationMinutes] = useState("30");
  const [heartRate, setHeartRate] = useState("");
  const [rpe, setRpe] = useState("5");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (visible) {
      setDateStr(defaultDate || new Date().toISOString().split("T")[0]);
      setErrorMessage("");
    }
  }, [visible, defaultDate]);

  const handleSubmit = async () => {
    setErrorMessage("");

    const dist = parseFloat(mode === "completed" ? actualDistanceKm : distanceKm);
    const dur = parseInt(mode === "completed" ? actualDurationMinutes : durationMinutes, 10);

    if (isNaN(dist) || dist <= 0) {
      setErrorMessage(locale.invalidDistance || "Укажите корректную дистанцию");
      return;
    }

    if (isNaN(dur) || dur <= 0) {
      setErrorMessage(locale.invalidDuration || "Укажите корректную продолжительность");
      return;
    }

    const scheduledAt = new Date(`${dateStr}T09:00:00.000Z`).toISOString();

    try {
      if (mode === "planned") {
        await createWorkoutMutation.mutateAsync({
          scheduledAt,
          type,
          title: title.trim() || undefined,
          distanceKm: dist,
          durationMinutes: dur,
          status: "planned",
        });
      } else {
        const hr = heartRate ? parseInt(heartRate, 10) : undefined;
        const rpeVal = rpe ? parseInt(rpe, 10) : undefined;

        await createWorkoutMutation.mutateAsync({
          scheduledAt,
          type,
          title: title.trim() || undefined,
          status: "completed",
          distanceKm: dist,
          durationMinutes: dur,
          actualDistanceKm: dist,
          actualDurationMinutes: dur,
          actualAverageHeartRate: !isNaN(hr!) ? hr : undefined,
          rpe: !isNaN(rpeVal!) ? rpeVal : undefined,
          notes: notes.trim() || undefined,
        });
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || "Не удалось сохранить тренировку");
    }
  };

  return (
    <BottomSheet
      title={locale.title || "Добавить тренировку"}
      visible={visible}
      onClose={onClose}
      theme={theme}
      themeMode={themeMode}
    >
      {/* Mode Switcher */}
      <SheetTabs
        value={mode}
        onChange={setMode}
        theme={theme}
        tabs={[
          { key: "planned" as const, label: locale.planTab || "Запланировать" },
          { key: "completed" as const, label: locale.logTab || "Внести выполненную" },
        ]}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {errorMessage ? (
          <View
            style={[styles.errorBanner, { backgroundColor: "rgba(220, 38, 38, 0.2)" }]}
          >
            <Text style={[styles.errorText, { color: "#dc2626" }]}>{errorMessage}</Text>
          </View>
        ) : null}

        {/* Date Input */}
        <GlassInput
          leftIcon={<Calendar color={theme.color.mutedForeground} size={18} />}
          keyboardType="default"
          label={locale.dateLabel || "Дата (ГГГГ-ММ-ДД)"}
          onChangeText={setDateStr}
          theme={theme}
          value={dateStr}
        />

        {/* Title Input */}
        <GlassInput
          leftIcon={<Activity color={theme.color.mutedForeground} size={18} />}
          label={locale.titleLabel || "Название (опционально)"}
          onChangeText={setTitle}
          placeholder={locale.titlePlaceholder || "Например: Утренняя пробежка"}
          theme={theme}
          value={title}
        />

        {/* Workout Type Selector */}
        <View style={styles.section}>
          <SheetSectionLabel text={locale.typeLabel || "ТИП ТРЕНИРОВКИ"} theme={theme} />
        </View>

        <SheetBlock theme={theme} edgeToEdge>
          <ScrollView
            horizontal
            nestedScrollEnabled
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.typesRow}
          >
          {WORKOUT_TYPES.map((t) => {
            const selected = type === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setType(t.key)}
                style={[
                  styles.typeChip,
                  {
                    backgroundColor: selected
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
                    styles.typeChipText,
                    {
                      color: selected
                        ? theme.color.primaryForeground
                        : theme.color.foreground,
                      fontFamily: selected
                        ? theme.typography.fontFamily.sans.bold
                        : theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {t.label}
                </Text>
              </Pressable>
            );
          })}
          </ScrollView>
        </SheetBlock>

        {/* Metrics */}
        <View style={styles.metricsRow}>
          <View style={styles.metricField}>
            <GlassInput
              leftIcon={<Activity color={theme.color.mutedForeground} size={18} />}
              keyboardType="numeric"
              label={
                mode === "completed"
                  ? locale.actualDistance || "Дистанция (км)"
                  : locale.planDistance || "План км"
              }
              onChangeText={mode === "completed" ? setActualDistanceKm : setDistanceKm}
              theme={theme}
              value={mode === "completed" ? actualDistanceKm : distanceKm}
            />
          </View>

          <View style={styles.metricField}>
            <GlassInput
              leftIcon={<Clock color={theme.color.mutedForeground} size={18} />}
              keyboardType="numeric"
              label={
                mode === "completed"
                  ? locale.actualDuration || "Время (мин)"
                  : locale.planDuration || "План мин"
              }
              onChangeText={
                mode === "completed" ? setActualDurationMinutes : setDurationMinutes
              }
              theme={theme}
              value={mode === "completed" ? actualDurationMinutes : durationMinutes}
            />
          </View>
        </View>

        {/* Completed specific inputs */}
        {mode === "completed" && (
          <>
            <View style={styles.metricsRow}>
              <View style={styles.metricField}>
                <GlassInput
                  leftIcon={<Heart color={theme.color.mutedForeground} size={18} />}
                  keyboardType="numeric"
                  label={locale.heartRate || "Ср. пульс (уд/мин)"}
                  onChangeText={setHeartRate}
                  placeholder="145"
                  theme={theme}
                  value={heartRate}
                />
              </View>

              <View style={styles.metricField}>
                <GlassInput
                  leftIcon={<Award color={theme.color.mutedForeground} size={18} />}
                  keyboardType="numeric"
                  label={locale.rpe || "Усилие RPE (1-10)"}
                  onChangeText={setRpe}
                  placeholder="6"
                  theme={theme}
                  value={rpe}
                />
              </View>
            </View>

            <GlassInput
              label={locale.notes || "Заметки / Ощущения"}
              multiline
              numberOfLines={3}
              onChangeText={setNotes}
              placeholder={locale.notesPlaceholder || "Хорошее самочувствие..."}
              theme={theme}
              value={notes}
            />
          </>
        )}
      </ScrollView>

      {/* Actions Row */}
      <SheetBlock theme={theme}>
        <View style={styles.actionsRow}>
          <SheetButton
            label={locale.cancel || "Отменить"}
            onPress={onClose}
            variant="secondary"
            theme={theme}
            themeMode={themeMode}
          />

          <SheetButton
            label={
              mode === "planned"
                ? locale.submitPlan || "Запланировать"
                : locale.submitLog || "Сохранить"
            }
            onPress={handleSubmit}
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
    flexShrink: 1,
    width: "100%",
  },
  scrollContent: {
    gap: 16,
    paddingVertical: 4,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
  },
  section: {
    gap: 8,
  },
  typesRow: {
    gap: 8,
    paddingHorizontal: 20,
  },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  typeChipText: {
    fontSize: 13,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  metricField: {
    flex: 1,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});
