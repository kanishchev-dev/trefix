import { type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { HeaderBackButton, HeaderTitle } from "../../main/components/header";
import { SectionLayout } from "../../main/components/section-layout";
import { useHeaderOptions } from "../../main/context/header-context";

type Props = {
  title: string;
  onBack: () => void;
  /** Pinned under the content, e.g. the main action of a form. */
  footer?: ReactNode;
  rightAction?: ReactNode;
  /** Changes when `rightAction` must be re-rendered (elements are new on every render). */
  rightActionKey?: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  children: ReactNode;
};

/** Nested profile screen: glass header with back and a centred title, scrollable content. */
export function ProfileSubScreen({
  title,
  onBack,
  rightAction = null,
  rightActionKey = "",
  theme,
  themeMode,
  children,
  footer = null,
}: Props) {
  useHeaderOptions(
    {
      leftAction: (
        <HeaderBackButton
          theme={theme}
          themeMode={themeMode}
          onPress={onBack}
        />
      ),
      centerContent: <HeaderTitle theme={theme}>{title}</HeaderTitle>,
      rightAction,
      variant: "default",
      bottomContent: null,
    },
    [theme, themeMode, onBack, title, rightActionKey],
  );

  return (
    <SectionLayout
      hasHeader={false}
      scrollable
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.stack}>{children}</View>
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SectionLayout>
  );
}

export function ProfileSection({ children }: { children: ReactNode }) {
  return <View style={styles.section}>{children}</View>;
}

/** Small explanatory text under a card. */
export function Footnote({
  text,
  theme,
}: {
  text: string;
  theme: ThemeTokens;
}) {
  return (
    <Text
      style={[
        styles.footnote,
        {
          color: theme.color.mutedForeground,
          fontFamily: theme.typography.fontFamily.sans.regular,
        },
      ]}
    >
      {text}
    </Text>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 32,
    paddingTop: 4,
  },
  section: {
    gap: 12,
  },
  footer: {
    paddingTop: 24,
  },
  footnote: {
    fontSize: 13,
    lineHeight: 18,
    paddingHorizontal: 16,
  },
});
