import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type FlatListProps,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Minus, Plus } from "lucide-react-native";

import { type ThemeTokens, type ThemeMode } from "@workspace/tokens";

import { SheetBlock } from "../../../shared/ui/bottom-sheet";
import { getGoalDistanceKm, PLAN_WEEKDAY_ORDER } from "../plan-creation-types";

// FlatList needs this wrapper to support native onScroll events with
// useNativeDriver (plain FlatList throws an invariant in dev).
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList);

// createAnimatedComponent loses the FlatList generic (item becomes unknown);
// this stable module-level alias restores it without recreating the component
// identity on every render (which would remount the list).
const CarouselList = AnimatedFlatList as unknown as <ItemT>(
  props: FlatListProps<ItemT> & {
    ref?: React.Ref<FlatList<ItemT>>;
  },
) => React.ReactElement | null;

type OptionChipProps = {
  label: string;
  selected: boolean;
  theme: ThemeTokens;
  themeMode?: ThemeMode;
  onPress: () => void;
};

export function OptionChip({ label, selected, theme, themeMode, onPress }: OptionChipProps) {
  const isDark = themeMode === "dark";

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected
            ? theme.color.primary
            : isDark
              ? "#1a1a1e"
              : theme.color.surface,
          borderColor: isDark
            ? "rgba(255, 255, 255, 0.08)"
            : theme.color.border,
          borderWidth: StyleSheet.hairlineWidth,
        },
        pressed && styles.pressed,
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
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
        {label}
      </Text>
    </Pressable>
  );
}

type DayPickerProps = {
  selectedDays: number[];
  theme: ThemeTokens;
  shortDayNames: readonly string[];
  onToggleDay: (dayIndex: number) => void;
};

export function DayPicker({
  selectedDays,
  theme,
  shortDayNames,
  onToggleDay,
}: DayPickerProps) {
  return (
    <View style={styles.dayRow}>
      {PLAN_WEEKDAY_ORDER.map((dayIndex) => {
        const selected = selectedDays.includes(dayIndex);
        return (
          <Pressable
            key={dayIndex}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={shortDayNames[dayIndex]}
            onPress={() => onToggleDay(dayIndex)}
            style={({ pressed }) => [
              styles.dayCell,
              {
                backgroundColor: selected ? theme.color.primary : theme.color.surfaceElevated,
                borderColor: selected ? theme.color.primary : theme.color.border,
              },
              pressed && styles.pressed,
            ]}
          >
            <Text
              style={[
                styles.dayLabel,
                {
                  color: selected ? theme.color.primaryForeground : theme.color.foreground,
                  fontFamily: theme.typography.fontFamily.sans.bold,
                },
              ]}
            >
              {shortDayNames[dayIndex]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

type CounterRowProps = {
  label: string;
  value: number;
  suffix?: string;
  min: number;
  max: number;
  theme: ThemeTokens;
  onChange: (value: number) => void;
};

export function CounterRow({ label, value, suffix, min, max, theme, onChange }: CounterRowProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  return (
    <View
      style={[
        styles.counterRow,
        {
          backgroundColor: theme.color.surfaceElevated,
          borderColor: theme.color.border,
        },
      ]}
    >
      <Text
        style={[
          styles.counterLabel,
          {
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.semibold,
          },
        ]}
      >
        {label}
      </Text>

      <View style={styles.counterControls}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} minus`}
          disabled={!canDecrement}
          onPress={() => onChange(value - 1)}
          style={({ pressed }) => [
            styles.counterButton,
            { backgroundColor: theme.color.surface, opacity: canDecrement ? 1 : 0.35 },
            pressed && canDecrement && styles.pressed,
          ]}
        >
          <Minus color={theme.color.foreground} size={18} />
        </Pressable>

        <Text
          style={[
            styles.counterValue,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.extrabold,
            },
          ]}
        >
          {value}
          {suffix ? ` ${suffix}` : ""}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label} plus`}
          disabled={!canIncrement}
          onPress={() => onChange(value + 1)}
          style={({ pressed }) => [
            styles.counterButton,
            { backgroundColor: theme.color.surface, opacity: canIncrement ? 1 : 0.35 },
            pressed && canIncrement && styles.pressed,
          ]}
        >
          <Plus color={theme.color.foreground} size={18} />
        </Pressable>
      </View>
    </View>
  );
}

type SectionBlockProps = {
  title: string;
  theme: ThemeTokens;
  children: ReactNode;
};

export function SectionBlock({ title, theme, children }: SectionBlockProps) {
  return (
    <SheetBlock theme={theme}>
      <View style={styles.sectionBlock}>
        <Text
          style={[
            styles.sectionTitle,
            {
              color: theme.color.mutedForeground,
              fontFamily: theme.typography.fontFamily.sans.bold,
            },
          ]}
        >
          {title.toUpperCase()}
        </Text>
        {children}
      </View>
    </SheetBlock>
  );
}

export function FieldError({ message, theme }: { message: string; theme: ThemeTokens }) {
  return (
    <Text
      accessibilityLiveRegion="polite"
      style={[
        styles.fieldError,
        { fontFamily: theme.typography.fontFamily.sans.regular },
      ]}
    >
      {message}
    </Text>
  );
}

type DistanceGoalOption<T extends string> = {
  value: T;
  label: string;
};

type DistanceGoalWidgetProps<T extends string> = {
  options: DistanceGoalOption<T>[];
  value: T;
  unit?: string;
  theme: ThemeTokens;
  onChange: (value: T) => void;
};

/**
 * Race-distance picker: a swipeable carousel where the neighbouring values
 * peek from the sides and scale/fade away from the centre, with a quick
 * preset chip slider underneath (same pattern as the workout goal sheet).
 */
export function DistanceGoalWidget<T extends string>({
  options,
  value,
  unit = "км",
  theme,
  onChange,
}: DistanceGoalWidgetProps<T>) {
  const [containerWidth, setContainerWidth] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const listRef = useRef<FlatList<DistanceGoalOption<T>> | null>(null);
  const lastIndexRef = useRef(
    Math.max(
      options.findIndex((option) => option.value === value),
      0,
    ),
  );

  const itemWidth = containerWidth / 3;

  const formatDistance = (km: number) => (Number.isInteger(km) ? String(km) : km.toFixed(1));

  // Follow external value changes (e.g. preset chip taps).
  useEffect(() => {
    const index = options.findIndex((option) => option.value === value);
    if (index >= 0 && index !== lastIndexRef.current && itemWidth > 0) {
      lastIndexRef.current = index;
      listRef.current?.scrollToOffset({ offset: index * itemWidth, animated: true });
    }
  }, [value, options, itemWidth]);

  const handleMomentumEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (itemWidth <= 0) {
      return;
    }
    const rawIndex = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
    const index = Math.min(Math.max(rawIndex, 0), options.length - 1);
    lastIndexRef.current = index;
    const selected = options[index];
    if (selected && selected.value !== value) {
      onChange(selected.value);
    }
  };

  return (
    <View onLayout={(event) => setContainerWidth(event.nativeEvent.layout.width)}>
      {itemWidth > 0 ? (
        <CarouselList
          ref={listRef}
          data={options}
          keyExtractor={(item) => item.value}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={itemWidth}
          decelerationRate="fast"
          getItemLayout={(_, index) => ({
            length: itemWidth,
            offset: itemWidth * index,
            index,
          })}
          initialScrollIndex={lastIndexRef.current}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true },
          )}
          onMomentumScrollEnd={handleMomentumEnd}
          scrollEventThrottle={16}
          style={styles.distanceCarousel}
          renderItem={({ item, index }) => {
            const km = getGoalDistanceKm(item.value);
            const inputRange = [
              (index - 1) * itemWidth,
              index * itemWidth,
              (index + 1) * itemWidth,
            ];
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.72, 1, 0.72],
              extrapolate: "clamp",
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: "clamp",
            });

            return (
              <Animated.View
                style={[
                  styles.distanceCell,
                  { width: itemWidth, opacity, transform: [{ scale }] },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ selected: item.value === value }}
                  onPress={() =>
                    listRef.current?.scrollToOffset({
                      offset: index * itemWidth,
                      animated: true,
                    })
                  }
                  style={styles.distanceCellPress}
                >
                  {km !== null ? (
                    <>
                      <Text
                        style={[
                          styles.distanceValue,
                          {
                            color: theme.color.foreground,
                            fontFamily: theme.typography.fontFamily.sans.extrabold,
                          },
                        ]}
                      >
                        {formatDistance(km)}
                      </Text>
                      <Text
                        style={[
                          styles.distanceUnit,
                          {
                            color: theme.color.mutedForeground,
                            fontFamily: theme.typography.fontFamily.sans.semibold,
                          },
                        ]}
                      >
                        {unit}
                      </Text>
                    </>
                  ) : (
                    <Text
                      numberOfLines={2}
                      style={[
                        styles.distanceValueText,
                        {
                          color: theme.color.foreground,
                          fontFamily: theme.typography.fontFamily.sans.extrabold,
                        },
                      ]}
                    >
                      {item.label}
                    </Text>
                  )}
                </Pressable>
              </Animated.View>
            );
          }}
        />
      ) : null}

      <SheetBlock theme={theme} edgeToEdge>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.distancePresetsScroll}
          contentContainerStyle={styles.distancePresetsContent}
        >
          {options.map((option) => {
            const selected = option.value === value;
            const km = getGoalDistanceKm(option.value);
            const label = km !== null ? `${formatDistance(km)} ${unit}` : option.label;

            return (
              <Pressable
                key={option.value}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => onChange(option.value)}
                style={({ pressed }) => [
                  styles.distancePresetChip,
                  {
                    backgroundColor: selected ? theme.color.primary : theme.color.surfaceElevated,
                    borderColor: selected ? theme.color.primary : theme.color.border,
                  },
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[
                    styles.distancePresetText,
                    {
                      color: selected ? theme.color.primaryForeground : theme.color.foreground,
                      fontFamily: selected
                        ? theme.typography.fontFamily.sans.bold
                        : theme.typography.fontFamily.sans.medium,
                    },
                  ]}
                >
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </SheetBlock>
    </View>
  );
}

type FormInputRowProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  unit?: string;
  keyboardType?: 'default' | 'numeric' | 'decimal-pad' | 'number-pad' | 'numbers-and-punctuation';
  error?: string | null;
  badge?: string;
  theme: ThemeTokens;
};

export function FormInputRow({
  label,
  value,
  onChangeText,
  placeholder,
  unit,
  keyboardType = 'numeric',
  error,
  badge,
  theme,
}: FormInputRowProps) {
  return (
    <View style={styles.inputRowBlock}>
      <View style={styles.inputRowHeader}>
        <Text
          style={[
            styles.inputRowLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {label}
        </Text>

        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.color.surfaceElevated }]}>
            <Text
              style={[
                styles.badgePillText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.inputContainer}>
        <TextInput
          accessibilityLabel={label}
          keyboardType={keyboardType}
          placeholder={placeholder}
          placeholderTextColor={theme.color.mutedForeground}
          value={value}
          onChangeText={onChangeText}
          style={[
            styles.textInput,
            {
              backgroundColor: theme.color.surfaceElevated,
              borderColor: error ? '#dc2626' : theme.color.border,
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        />
        {unit ? (
          <Text
            style={[
              styles.unitSuffix,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {unit}
          </Text>
        ) : null}
      </View>

      {error ? <FieldError message={error} theme={theme} /> : null}
    </View>
  );
}

type MultilineInputRowProps = {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  badge?: string;
  theme: ThemeTokens;
};

export function MultilineInputRow({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  badge,
  theme,
}: MultilineInputRowProps) {
  return (
    <View style={styles.inputRowBlock}>
      <View style={styles.inputRowHeader}>
        <Text
          style={[
            styles.inputRowLabel,
            {
              color: theme.color.foreground,
              fontFamily: theme.typography.fontFamily.sans.semibold,
            },
          ]}
        >
          {label}
        </Text>

        {badge ? (
          <View style={[styles.badgePill, { backgroundColor: theme.color.surfaceElevated }]}>
            <Text
              style={[
                styles.badgePillText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {badge}
            </Text>
          </View>
        ) : null}
      </View>

      <TextInput
        accessibilityLabel={label}
        multiline
        numberOfLines={4}
        placeholder={placeholder}
        placeholderTextColor={theme.color.mutedForeground}
        textAlignVertical="top"
        value={value}
        onChangeText={onChangeText}
        style={[
          styles.multilineInput,
          {
            backgroundColor: theme.color.surfaceElevated,
            borderColor: error ? '#dc2626' : theme.color.border,
            color: theme.color.foreground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      />

      {error ? <FieldError message={error} theme={theme} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputRowBlock: {
    gap: 6,
  },
  inputRowHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputRowLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    lineHeight: 14,
  },
  inputContainer: {
    position: "relative",
    justifyContent: "center",
  },
  textInput: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  unitSuffix: {
    position: "absolute",
    right: 16,
    fontSize: 13,
  },
  multilineInput: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 96,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  dayRow: {
    flexDirection: "row",
    gap: 8,
  },
  dayCell: {
    flex: 1,
    height: 44,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    fontSize: 13,
    lineHeight: 17,
  },
  counterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  counterLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  counterControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  counterButton: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  counterValue: {
    minWidth: 56,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 22,
  },
  sectionBlock: {
    gap: 10,
  },
  sectionTitle: {
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0.8,
  },
  fieldError: {
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 4,
  },
  distanceCarousel: {
    height: 148,
    width: "100%",
  },
  distanceCell: {
    alignItems: "center",
    justifyContent: "center",
  },
  distanceCellPress: {
    flex: 1,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  distanceValue: {
    fontSize: 44,
    lineHeight: 52,
  },
  distanceValueText: {
    fontSize: 20,
    lineHeight: 26,
    textAlign: "center",
    paddingHorizontal: 12,
  },
  distanceUnit: {
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  distancePresetsScroll: {
    width: "100%",
    marginTop: 4,
    maxHeight: 46,
  },
  distancePresetsContent: {
    gap: 8,
    alignItems: "center",
    paddingHorizontal: 20,
  },
  distancePresetChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  distancePresetText: {
    fontSize: 14,
    lineHeight: 18,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
});
