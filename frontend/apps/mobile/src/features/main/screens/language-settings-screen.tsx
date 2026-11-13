import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type LanguageMode } from "../../../app/use-app-preferences";
import { fillTemplate, getAppLanguage, type MainCopy } from "../../../locales";
import { ListCard, ListRow } from "../../../shared/ui/list-card";
import { SelectedMark } from "../../profile/components/profile-ui";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../../profile/components/profile-sub-screen";
import { useAppSettings } from "../context/app-settings-context";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

const OPTIONS: LanguageMode[] = ["system", "ru", "en"];

/** App language: follow the device, Russian or English. */
export function LanguageSettingsScreen({
  theme,
  themeMode,
  copy,
  onBack,
}: Props) {
  const { languageMode, selectLanguage } = useAppSettings();
  const l = copy.profile.languageScreen;
  const device = getAppLanguage();

  return (
    <ProfileSubScreen
      title={l.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <ListCard theme={theme} bare>
          {OPTIONS.map((option) => (
            <ListRow
              key={option}
              theme={theme}
              title={option === "system" ? l.system : l.native[option]}
              description={
                option === "system"
                  ? fillTemplate(l.systemNow, { language: l.native[device] })
                  : l.translated[option]
              }
              trailing={
                languageMode === option ? (
                  <SelectedMark theme={theme} />
                ) : undefined
              }
              chevron={false}
              onPress={() => selectLanguage(option)}
            />
          ))}
        </ListCard>
        <Footnote text={l.hint} theme={theme} />
      </ProfileSection>
    </ProfileSubScreen>
  );
}
