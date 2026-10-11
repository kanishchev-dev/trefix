import { ActivityIndicator, Text, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { type MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { Card } from "../../../shared/ui/card";
import { styles } from "../plan-creation-screen.styles";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  failed: boolean;
  onClose: () => void;
  onRetry: () => void;
};

/** Shown while the stored plan is loaded for rebuild or draft parameters. */
export function PrefillLoadingOverlay({
  theme,
  themeMode,
  copy,
  failed,
  onClose,
  onRetry,
}: Props) {
  return (
    <View
      style={[
        styles.root,
        styles.loadingOverlay,
        { backgroundColor: theme.color.scrim },
      ]}
    >
      {failed ? (
        <Card
          size="sm"
          theme={theme}
          themeMode={themeMode}
          style={styles.loadingCard}
        >
          <Text
            style={[
              styles.stepQuestion,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.plans.rebuild.loadFailed}
          </Text>
          <View style={styles.loadingActions}>
            <SheetButton
              label={copy.plan.creation.common.close}
              variant="secondary"
              onPress={onClose}
              theme={theme}
              themeMode={themeMode}
            />
            <SheetButton
              label={copy.plans.errors.retry}
              onPress={onRetry}
              theme={theme}
              themeMode={themeMode}
            />
          </View>
        </Card>
      ) : (
        <ActivityIndicator color={theme.color.foreground} />
      )}
    </View>
  );
}
