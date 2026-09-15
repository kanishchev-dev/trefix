import { Linking, StyleSheet, Text } from "react-native";
import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
};

export function AuthLegalAgreement({ theme }: Props) {
  return (
    <Text
      style={[
        styles.footerText,
        {
          color: theme.color.mutedForeground,
          fontFamily: theme.typography.fontFamily.sans.regular,
        },
      ]}
    >
      Нажимая «Продолжить», вы соглашаетесь с{" "}
      <Text
        style={[styles.link, { color: theme.color.foreground }]}
        onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_TERMS_URL ?? "https://trefix.io/terms")}
      >
        Условиями использования
      </Text>{" "}
      и{" "}
      <Text
        style={[styles.link, { color: theme.color.foreground }]}
        onPress={() => Linking.openURL(process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://trefix.io/privacy")}
      >
        Политикой конфиденциальности
      </Text>
      .
    </Text>
  );
}

const styles = StyleSheet.create({
  footerText: {
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
    paddingHorizontal: 10,
  },
  link: {
    textDecorationLine: "underline",
  },
});
