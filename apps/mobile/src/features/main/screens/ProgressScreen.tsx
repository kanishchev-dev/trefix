import { SectionPlaceholderScreen } from "./SectionPlaceholderScreen";

import { type ThemeTokens } from "@workspace/tokens";

type Props = {
  theme: ThemeTokens;
};

export function ProgressScreen({ theme }: Props) {
  return <SectionPlaceholderScreen theme={theme} title="Прогресс" />;
}
