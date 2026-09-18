import { SectionPlaceholderScreen } from "./section-placeholder-screen";

import { type MainCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy;
};

export function ProfileScreen({ theme, themeMode, copy }: Props) {
  return (
    <SectionPlaceholderScreen
      theme={theme}
      themeMode={themeMode}
      title={copy.tabs.profile}
    />
  );
}
