import { SectionPlaceholderScreen } from "./SectionPlaceholderScreen";

import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
};

export function ProfileScreen({ theme, themeMode }: Props) {
  return (
    <SectionPlaceholderScreen
      theme={theme}
      themeMode={themeMode}
      title="Профиль"
    />
  );
}
