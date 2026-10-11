import { Pressable, Text, View } from "react-native";
import { ChevronLeft, Pencil, X } from "lucide-react-native";

import { type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";
import { styles } from "../plan-preview-screen.styles";

type Props = {
  theme: ThemeTokens;
  copy: MainCopy;
  title: string;
  /** Back to the plan settings; without it the slot stays empty. */
  onBack?: () => void;
  /** Makes the title a button that opens the name and notes sheet. */
  onRename?: () => void;
  onClose: () => void;
};

/** Back, the plan name (editable on creation) and close. */
export function PreviewHeader({
  theme,
  copy,
  title,
  onBack,
  onRename,
  onClose,
}: Props) {
  const creationCopy = copy.plan.creation;
  const medium = theme.typography.fontFamily.sans.medium;

  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={creationCopy.common.back}
          hitSlop={8}
          onPress={onBack}
          style={({ pressed }) => [
            styles.headerButton,
            pressed && styles.rowPressed,
          ]}
        >
          <ChevronLeft color={theme.color.foreground} size={24} />
        </Pressable>
      ) : (
        <View style={styles.headerButton} />
      )}
      {onRename ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}. ${copy.plans.preview.renameA11y}`}
          onPress={onRename}
          style={({ pressed }) => [
            styles.headerTitleButton,
            pressed && styles.rowPressed,
          ]}
        >
          <Text
            numberOfLines={1}
            style={[
              styles.headerTitle,
              { color: theme.color.foreground, fontFamily: medium },
            ]}
          >
            {title}
          </Text>
          <Pencil color={theme.color.mutedForeground} size={14} />
        </Pressable>
      ) : (
        <Text
          numberOfLines={1}
          style={[
            styles.headerTitle,
            styles.headerTitleFill,
            { color: theme.color.foreground, fontFamily: medium },
          ]}
        >
          {title}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={creationCopy.common.close}
        hitSlop={8}
        onPress={onClose}
        style={({ pressed }) => [
          styles.headerButton,
          pressed && styles.rowPressed,
        ]}
      >
        <X color={theme.color.mutedForeground} size={20} />
      </Pressable>
    </View>
  );
}
