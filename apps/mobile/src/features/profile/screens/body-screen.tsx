import { Linking } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { requestStravaProfileAccess } from "../../../lib/integrations-api";
import { trackEvent } from "../../../lib/analytics";
import { type AppLanguage, type MainCopy } from "../../../locales";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { Switch } from "../../../shared/ui/switch";
import { useToast } from "../../../shared/ui/toast";
import { useStravaIntegration } from "../../main/hooks/use-integrations";
import { BodyFieldsCard } from "../components/body-fields-card";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import { useAthleteProfile } from "../hooks/use-athlete-profile";
import { usePreferences, useUpdatePreferences } from "../hooks/use-preferences";
import { profileErrorMessage } from "../lib/profile-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

/** P2 — body: date of birth, sex, height, weight, and whether Strava keeps them updated. */
export function BodyScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const { data: athlete } = useAthleteProfile();
  const { preferences } = usePreferences();
  const updatePreferences = useUpdatePreferences();
  const { data: strava } = useStravaIntegration();
  const { showToast } = useToast();
  const b = copy.profile.body;
  const stravaConnected = Boolean(strava && strava.status !== "disconnected");
  const profileAccess = Boolean(strava?.profileAccess);

  const allowAccess = async () => {
    try {
      trackEvent("strava_profile_access_requested");
      const { authorizeUrl } = await requestStravaProfileAccess();
      await Linking.openURL(authorizeUrl);
    } catch (error) {
      showToast(profileErrorMessage(error, copy));
    }
  };

  return (
    <ProfileSubScreen
      title={b.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      {athlete ? (
        <ProfileSection>
          <BodyFieldsCard
            athlete={athlete}
            copy={copy}
            language={language}
            theme={theme}
            themeMode={themeMode}
          />
          <Footnote text={copy.profile.bodyScreen.footnote} theme={theme} />
        </ProfileSection>
      ) : null}
      {stravaConnected ? (
        <ProfileSection>
          <SectionTitle text={b.source} theme={theme} />
          <ListCard theme={theme} bare>
            {profileAccess ? (
              <ListRow
                theme={theme}
                title={b.stravaSync}
                description={b.stravaSyncDescription}
                trailing={
                  <Switch
                    theme={theme}
                    value={preferences.stravaProfileSync}
                    accessibilityLabel={b.stravaSync}
                    onValueChange={(value) =>
                      updatePreferences.mutate({ stravaProfileSync: value })
                    }
                  />
                }
              />
            ) : (
              <ListRow
                theme={theme}
                title={b.allowAccess}
                description={b.allowAccessDescription}
                onPress={() => void allowAccess()}
              />
            )}
          </ListCard>
          <Footnote text={b.footnote} theme={theme} />
        </ProfileSection>
      ) : null}
    </ProfileSubScreen>
  );
}
