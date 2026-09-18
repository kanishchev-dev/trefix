import { type ThemeTokens } from "@workspace/tokens";
import { type MainCopy } from "../../../locales";
import { TrefixChatScreen } from "../../trefix/trefix-chat";

type Props = {
  theme: ThemeTokens;
  themeMode: "light" | "dark";
  copy: MainCopy["trefix"];
  onBack: () => void;
};

export function TrefixScreen({ theme, themeMode, copy, onBack }: Props) {
  return (
    <TrefixChatScreen
      theme={theme}
      themeMode={themeMode}
      copy={copy}
      onBack={onBack}
    />
  );
}
