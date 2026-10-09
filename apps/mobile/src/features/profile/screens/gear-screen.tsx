import { useMemo, useState } from "react";
import { Linking, View } from "react-native";
import { Archive, Download, Footprints, RotateCcw, Trash2 } from "lucide-react-native";

import { type Gear } from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { requestStravaProfileAccess, syncStravaProfile } from "../../../lib/integrations-api";
import { fillTemplate, type AppLanguage, type MainCopy } from "../../../locales";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { useToast } from "../../../shared/ui/toast";
import { HeaderPlusButton } from "../../main/components/header";
import { useStravaIntegration } from "../../main/hooks/use-integrations";
import { ConfirmSheet } from "../../plans/components/confirm-sheet";
import { Notice, NoticeText } from "../../plans/components/plans-ui";
import { GearCard } from "../components/gear-card";
import { ProfileSection, ProfileSubScreen } from "../components/profile-sub-screen";
import { ProfileValueSheet, type ValueSheetConfig } from "../components/profile-value-sheet";
import { useGear, useGearMutation } from "../hooks/use-gear";
import { usePreferences } from "../hooks/use-preferences";
import { createFormatter, gearName, profileErrorMessage } from "../lib/profile-format";
import { type ProfileNavigate } from "../profile-routes";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
  onNavigate: ProfileNavigate;
};

/** D4 — active shoes with wear, the archive, and import from Strava. */
export function GearScreen({ theme, themeMode, copy, language, onBack, onNavigate }: Props) {
  const { data: active = [] } = useGear("active");
  const { data: retired = [] } = useGear("retired");
  const mutation = useGearMutation();
  const { preferences } = usePreferences();
  const { data: strava } = useStravaIntegration();
  const { showToast } = useToast();
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [actions, setActions] = useState<ValueSheetConfig | null>(null);
  const [deleting, setDeleting] = useState<Gear | null>(null);
  const g = copy.profile.gear;
  const format = useMemo(() => createFormatter(copy, language, preferences), [copy, language, preferences]);
  const stravaConnected = Boolean(strava && strava.status !== "disconnected");
  const wornOut = active.filter((gear) => gear.replaceSoon);

  const openEdit = (gearId?: string) => onNavigate({ kind: "profile-gear-edit", gearId });

  const openActions = (gear: Gear) =>
    setActions({
      kind: "options",
      title: gearName(gear),
      value: null,
      options: [
        gear.status === "active"
          ? { value: "retire", label: g.retire, icon: <Archive color={theme.color.foreground} size={20} /> }
          : { value: "restore", label: g.restore, icon: <RotateCcw color={theme.color.foreground} size={20} /> },
        { value: "delete", label: g.delete, icon: <Trash2 color={theme.color.danger} size={20} /> },
      ],
      onSave: async (value) => {
        if (value === "delete") {
          // Open the confirmation after the actions sheet has slid away.
          setTimeout(() => setDeleting(gear), 320);
          return;
        }
        await mutation.mutateAsync(value === "retire" ? { kind: "retire", gearId: gear.id } : { kind: "restore", gearId: gear.id });
      },
    });

  const importFromStrava = async () => {
    try {
      if (strava?.profileAccess) {
        await syncStravaProfile();
        showToast(g.importing);
      } else {
        const { authorizeUrl } = await requestStravaProfileAccess();
        await Linking.openURL(authorizeUrl);
      }
    } catch (error) {
      showToast(profileErrorMessage(error, copy));
    }
  };

  return (
    <ProfileSubScreen
      title={g.title}
      onBack={onBack}
      rightAction={<HeaderPlusButton theme={theme} themeMode={themeMode} onPress={() => openEdit()} />}
      rightActionKey="add"
      theme={theme}
      themeMode={themeMode}
    >
      {wornOut.map((gear) => (
        <Notice key={gear.id} tone="warning" theme={theme}>
          <NoticeText theme={theme}>{fillTemplate(g.replaceNotice, { name: gearName(gear) })}</NoticeText>
        </Notice>
      ))}

      <ProfileSection>
        <SectionTitle text={g.active} theme={theme} />
        {active.length === 0 ? (
          <ListCard theme={theme}>
            <ListRow
              theme={theme}
              icon={<Footprints color={theme.color.foreground} size={20} />}
              title={g.add}
              description={g.empty}
              onPress={() => openEdit()}
            />
          </ListCard>
        ) : (
          <View style={{ gap: 8 }}>
            {active.map((gear) => (
              <GearCard
                key={gear.id}
                gear={gear}
                copy={copy}
                language={language}
                format={format}
                theme={theme}
                onPress={() => openEdit(gear.id)}
                onLongPress={() => openActions(gear)}
              />
            ))}
          </View>
        )}
      </ProfileSection>

      {stravaConnected ? (
        <ListCard theme={theme}>
          <ListRow
            theme={theme}
            icon={<Download color={theme.color.foreground} size={20} />}
            title={g.importStrava}
            description={strava?.profileAccess ? undefined : copy.profile.body.allowAccessDescription}
            chevron={false}
            onPress={() => void importFromStrava()}
          />
        </ListCard>
      ) : null}

      {retired.length > 0 ? (
        <ProfileSection>
          <ListCard theme={theme}>
            <ListRow
              theme={theme}
              icon={<Archive color={theme.color.foreground} size={20} />}
              title={fillTemplate(g.archive, { count: retired.length })}
              onPress={() => setArchiveOpen((open) => !open)}
            />
          </ListCard>
          {archiveOpen ? (
            <View style={{ gap: 8 }}>
              {retired.map((gear) => (
                <GearCard
                  key={gear.id}
                  gear={gear}
                  copy={copy}
                  language={language}
                  format={format}
                  theme={theme}
                  onPress={() => openActions(gear)}
                />
              ))}
            </View>
          ) : null}
        </ProfileSection>
      ) : null}

      <ProfileValueSheet config={actions} onClose={() => setActions(null)} copy={copy} theme={theme} themeMode={themeMode} />
      <ConfirmSheet
        visible={deleting !== null}
        title={g.deleteTitle}
        body={g.deleteBody}
        confirmLabel={g.delete}
        cancelLabel={g.cancel}
        onConfirm={async () => {
          if (deleting) await mutation.mutateAsync({ kind: "delete", gearId: deleting.id });
        }}
        onClose={() => setDeleting(null)}
        errorMessage={(error) => profileErrorMessage(error, copy)}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}
