import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";
import { type AppLanguage } from "../../../locales";
import { OptionChip } from "./plan-creation-ui";

type CalendarDatePickerProps = {
  value?: string; // ISO string "YYYY-MM-DD"
  onChange: (isoDate?: string) => void;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
  language: AppLanguage;
};

export function CalendarDatePicker({
  value,
  onChange,
  theme,
  themeMode,
  language,
}: CalendarDatePickerProps) {
  const isDark = themeMode === "dark" || theme.color.background === "#09090b";
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const parsedValue = value ? new Date(value) : null;
  const validParsed = parsedValue && !isNaN(parsedValue.getTime()) ? parsedValue : null;

  const [viewDate, setViewDate] = useState<Date>(validParsed ?? new Date());

  useEffect(() => {
    if (validParsed) {
      setViewDate(new Date(validParsed));
    }
  }, [value]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const monthNamesRu = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
  ];
  const monthNamesEn = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const monthName = language === "ru" ? monthNamesRu[month] : monthNamesEn[month];

  const shortWeekdaysRu = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const shortWeekdaysEn = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weekdays = language === "ru" ? shortWeekdaysRu : shortWeekdaysEn;

  const firstDayOfMonth = new Date(year, month, 1);
  let startDay = firstDayOfMonth.getDay();
  if (startDay === 0) startDay = 7;
  const padding = startDay - 1;

  const days: { date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = 0; i < padding; i++) {
    days.push({
      date: new Date(year, month, 1 - (padding - i)),
      isCurrentMonth: false,
    });
  }
  const lastDayOfMonth = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= lastDayOfMonth; i++) {
    days.push({
      date: new Date(year, month, i),
      isCurrentMonth: true,
    });
  }
  const totalSlots = days.length > 35 ? 42 : 35;
  const remaining = totalSlots - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: new Date(year, month + 1, i),
      isCurrentMonth: false,
    });
  }

  const handlePrevMonth = () => {
    setViewDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate(new Date(year, month + 1, 1));
  };

  const isSameDay = (d1: Date, d2?: Date | null) => {
    if (!d2) return false;
    return (
      d1.getFullYear() === d2.getFullYear() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getDate() === d2.getDate()
    );
  };

  const formatIsoDate = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  const presets = [
    { days: 7, label: language === "ru" ? "+1 нед" : "+1 wk" },
    { days: 14, label: language === "ru" ? "+2 нед" : "+2 wks" },
    { days: 30, label: language === "ru" ? "+1 мес" : "+1 mo" },
    { days: 60, label: language === "ru" ? "+2 мес" : "+2 mos" },
    { days: 90, label: language === "ru" ? "+3 мес" : "+3 mos" },
  ];

  return (
    <View
      style={[
        styles.calendarCard,
        {
          backgroundColor: isDark ? "#121214" : theme.color.surfaceElevated,
          borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : theme.color.border,
        },
      ]}
    >
      {/* Presets Row */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.calendarPresetsRow}
      >
        {presets.map((p) => {
          const targetD = new Date();
          targetD.setDate(targetD.getDate() + p.days);
          const iso = formatIsoDate(targetD);
          const isSelected = value === iso;

          return (
            <OptionChip
              key={p.days}
              label={p.label}
              selected={isSelected}
              theme={theme}
              themeMode={themeMode}
              onPress={() => {
                if (isSelected) {
                  onChange(undefined);
                } else {
                  onChange(iso);
                  setViewDate(targetD);
                }
              }}
            />
          );
        })}
      </ScrollView>

      {/* Month Header Navigation */}
      <View style={styles.calendarHeader}>
        <Text
          style={[
            styles.monthTitle,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.bold,
            },
          ]}
        >
          {monthName} {year}
        </Text>

        <View style={styles.monthNavButtons}>
          <Pressable
            accessibilityRole="button"
            onPress={handlePrevMonth}
            style={({ pressed }) => [
              styles.navButton,
              {
                backgroundColor: isDark ? "#27272a" : theme.color.secondary,
              },
              pressed && styles.pressed,
            ]}
          >
            <ChevronLeft size={18} color={theme.color.foreground} />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={handleNextMonth}
            style={({ pressed }) => [
              styles.navButton,
              {
                backgroundColor: isDark ? "#27272a" : theme.color.secondary,
              },
              pressed && styles.pressed,
            ]}
          >
            <ChevronRight size={18} color={theme.color.foreground} />
          </Pressable>
        </View>
      </View>

      {/* Weekdays Row */}
      <View style={styles.weekdaysRow}>
        {weekdays.map((wd, i) => (
          <Text
            key={i}
            style={[
              styles.weekdayText,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {wd}
          </Text>
        ))}
      </View>

      {/* Days Grid */}
      <View style={styles.daysGrid}>
        {days.map((item, idx) => {
          const itemDate = new Date(item.date);
          itemDate.setHours(0, 0, 0, 0);

          const isPast = itemDate < today;
          const isSelected = isSameDay(itemDate, validParsed);
          const isTodayFlag = isSameDay(itemDate, today);

          return (
            <Pressable
              key={idx}
              disabled={isPast}
              onPress={() => {
                const iso = formatIsoDate(itemDate);
                if (isSelected) {
                  onChange(undefined);
                } else {
                  onChange(iso);
                }
              }}
              style={({ pressed }) => [
                styles.dayCellWrapper,
                isSelected && {
                  backgroundColor: theme.color.primary,
                  borderRadius: 9999,
                },
                isTodayFlag && !isSelected && {
                  borderColor: theme.color.primary,
                  borderWidth: 1,
                  borderRadius: 9999,
                },
                pressed && !isPast && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.dayCellText,
                  {
                    color: isSelected
                      ? theme.color.primaryForeground
                      : isPast || !item.isCurrentMonth
                      ? (isDark ? "#52525b" : "#d4d4d8")
                      : theme.color.foreground,
                    fontFamily: isSelected || isTodayFlag
                      ? theme.typography.fontFamily.sans.bold
                      : theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {itemDate.getDate()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  calendarCard: {
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    gap: 12,
  },
  calendarPresetsRow: {
    gap: 8,
    alignItems: "center",
  },
  calendarHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 4,
  },
  monthTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  monthNavButtons: {
    flexDirection: "row",
    gap: 8,
  },
  navButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  weekdaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  weekdayText: {
    width: "14.28%",
    textAlign: "center",
    fontSize: 12,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 4,
  },
  dayCellWrapper: {
    width: "14.28%",
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCellText: {
    fontSize: 14,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    opacity: 0.85,
  },
});
