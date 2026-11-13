import { Activity, Gauge, HeartPulse } from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { type MainCopy } from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { useToast } from "../../../shared/ui/toast";
import { ProfileSubScreen } from "../../profile/components/profile-sub-screen";
import { ConnectOnboarding } from "../components/connect-onboarding";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

/** Garmin Connect onboarding; connecting arrives with the backend integration. */
export function GarminConnectScreen({ theme, themeMode, copy, onBack }: Props) {
  const { showToast } = useToast();
  const g = copy.profile.connect.garmin;
  return (
    <ProfileSubScreen
      title=""
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ConnectOnboarding
        theme={theme}
        themeMode={themeMode}
        provider="garmin"
        title={g.title}
        lede={g.lede}
        chips={g.chips}
        benefits={g.benefits}
        benefitIcons={[Activity, HeartPulse, Gauge]}
        cta={
          <SheetButton
            label={g.cta}
            onPress={() => showToast(g.soon)}
            theme={theme}
            themeMode={themeMode}
            style={{ alignSelf: "stretch", flex: 0 }}
          />
        }
        fine={g.fine}
      />
    </ProfileSubScreen>
  );
}
