import { useState } from "react";
import { Linking, Platform, StyleSheet, Text } from "react-native";
import {
  Apple,
  Download,
  LogOut,
  Mail,
  MonitorSmartphone,
  ShieldCheck,
  Smartphone,
  Tablet,
  Trash2,
  CircleUserRound,
} from "lucide-react-native";

import { type AuthIdentity, type AuthSession } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import appConfig from "../../../../app.json";
import { type SocialProvider } from "../../../lib/account-api";
import { trackEvent } from "../../../lib/analytics";
import {
  fillTemplate,
  formatLongDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { ListCard, ListRow, SectionTitle } from "../../../shared/ui/list-card";
import { useToast } from "../../../shared/ui/toast";
import { useAppSettings } from "../../main/context/app-settings-context";
import { useProfile } from "../../main/hooks/use-profile";
import { DeleteAccountSheet } from "../components/delete-account-sheet";
import { ProfileSheet } from "../components/profile-sheet";
import { ICON_STROKE, ROW_ICON } from "../components/profile-ui";
import {
  Footnote,
  ProfileSection,
  ProfileSubScreen,
} from "../components/profile-sub-screen";
import {
  useDataExport,
  useIdentities,
  useLinkIdentity,
  useLogoutOthers,
  useRequestDataExport,
  useRevokeSession,
  useSessions,
  useUnlinkIdentity,
} from "../hooks/use-account";
import { formatAgo, profileErrorMessage } from "../lib/profile-format";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
  onChangeEmail: () => void;
};

const PRIVACY_URL =
  process.env.EXPO_PUBLIC_PRIVACY_URL ?? "https://trefix.app/privacy";
const TERMS_URL =
  process.env.EXPO_PUBLIC_TERMS_URL ?? "https://trefix.app/terms";
const PROVIDER_NAMES: Record<SocialProvider, string> = {
  apple: "Apple",
  google: "Google",
};

/** Sign-in methods, devices, data export, sign out and account deletion. */
export function AccountScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
  onChangeEmail,
}: Props) {
  const { logout, accountDeleted } = useAppSettings();
  const { data: user } = useProfile();
  const { data: identities = [] } = useIdentities();
  const { data: sessions = [] } = useSessions();
  const { data: latestExport } = useDataExport();
  const link = useLinkIdentity();
  const unlink = useUnlinkIdentity();
  const revoke = useRevokeSession();
  const logoutOthers = useLogoutOthers();
  const requestExport = useRequestDataExport();
  const { showToast } = useToast();
  const [identity, setIdentity] = useState<AuthIdentity | null>(null);
  const [device, setDevice] = useState<AuthSession | null>(null);
  const [othersVisible, setOthersVisible] = useState(false);
  const [exportVisible, setExportVisible] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);
  const [deleteVisible, setDeleteVisible] = useState(false);
  const a = copy.profile.account;
  const fg = theme.color.foreground;
  const appVersion = appConfig.expo.version ?? "1.0.0";

  const providers: SocialProvider[] =
    Platform.OS === "ios" ? ["apple", "google"] : ["google"];
  const linkedProviders = new Set(identities.map((item) => item.provider));
  // Apple can only be linked on iOS, but a linked Apple ID is still shown elsewhere.
  if (linkedProviders.has("apple") && !providers.includes("apple"))
    providers.unshift("apple");

  const connect = async (provider: SocialProvider) => {
    try {
      const linked = await link.mutateAsync(provider);
      if (linked) {
        trackEvent("identity_linked", { provider });
        showToast(
          fillTemplate(a.identity.linkedToast, {
            provider: PROVIDER_NAMES[provider],
          }),
        );
      }
    } catch (error) {
      showToast(profileErrorMessage(error, copy));
    }
  };

  const deviceName = (session: AuthSession) =>
    session.deviceName ??
    (session.platform ? platformName(session.platform) : a.unknownDevice);
  const deviceIcon = (session: AuthSession) => {
    const name = (session.deviceName ?? "").toLowerCase();
    if (name.includes("ipad") || name.includes("tab")) return Tablet;
    if (session.platform === "web") return MonitorSmartphone;
    return Smartphone;
  };
  const sessionDescription = (session: AuthSession) =>
    [
      session.current ? a.thisDevice : formatAgo(session.lastActiveAt, copy),
      session.city,
    ]
      .filter(Boolean)
      .join(" · ");

  const exportBlocked =
    latestExport !== undefined &&
    latestExport !== null &&
    (latestExport.status === "pending" ||
      new Date(latestExport.nextAvailableAt).getTime() > Date.now());
  const others = sessions.filter((session) => !session.current);

  return (
    <ProfileSubScreen
      title={a.title}
      onBack={onBack}
      theme={theme}
      themeMode={themeMode}
    >
      <ProfileSection>
        <SectionTitle text={a.signIn} theme={theme} />
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            icon={<Mail color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />}
            title={a.email}
            description={
              user?.email
                ? fillTemplate(a.emailDescription, { email: user.email })
                : undefined
            }
            onPress={onChangeEmail}
          />
          {providers.map((provider) => {
            const linked = identities.find(
              (item) => item.provider === provider,
            );
            return (
              <ListRow
                key={provider}
                theme={theme}
                icon={
                  provider === "apple" ? (
                    <Apple
                      color={fg}
                      size={ROW_ICON}
                      strokeWidth={ICON_STROKE}
                    />
                  ) : (
                    <CircleUserRound
                      color={fg}
                      size={ROW_ICON}
                      strokeWidth={ICON_STROKE}
                    />
                  )
                }
                title={PROVIDER_NAMES[provider]}
                description={linked ? a.linked : undefined}
                value={linked ? undefined : a.connect}
                disabled={link.isPending}
                onPress={() =>
                  linked ? setIdentity(linked) : void connect(provider)
                }
              />
            );
          })}
        </ListCard>
        <Footnote text={a.signInHint} theme={theme} />
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={a.devices} theme={theme} />
        <ListCard theme={theme} bare>
          {sessions.map((session) => {
            const Icon = deviceIcon(session);
            return (
              <ListRow
                key={session.id}
                theme={theme}
                icon={
                  <Icon color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
                }
                title={deviceName(session)}
                description={sessionDescription(session)}
                onPress={session.current ? undefined : () => setDevice(session)}
                chevron={!session.current}
              />
            );
          })}
          {others.length > 0 ? (
            <ListRow
              theme={theme}
              icon={
                <LogOut color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
              }
              title={a.logoutOthers}
              chevron={false}
              onPress={() => setOthersVisible(true)}
            />
          ) : null}
        </ListCard>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={a.data} theme={theme} />
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            icon={
              <Download color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
            }
            title={a.export}
            description={
              latestExport?.status === "pending"
                ? a.exportPending
                : a.exportDescription
            }
            onPress={() => setExportVisible(true)}
          />
          <ListRow
            theme={theme}
            icon={
              <ShieldCheck
                color={fg}
                size={ROW_ICON}
                strokeWidth={ICON_STROKE}
              />
            }
            title={copy.profile.legal.privacy}
            onPress={() => void Linking.openURL(PRIVACY_URL)}
          />
        </ListCard>
      </ProfileSection>

      <ProfileSection>
        <SectionTitle text={a.accountSection} theme={theme} />
        <ListCard theme={theme} bare>
          <ListRow
            theme={theme}
            icon={
              <LogOut color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
            }
            title={a.logout}
            chevron={false}
            onPress={() => setLogoutVisible(true)}
          />
          <ListRow
            theme={theme}
            icon={
              <Trash2
                color={theme.color.danger}
                size={ROW_ICON}
                strokeWidth={ICON_STROKE}
              />
            }
            title={a.delete}
            description={a.deleteDescription}
            destructive
            chevron={false}
            onPress={() => setDeleteVisible(true)}
          />
        </ListCard>
      </ProfileSection>

      <Text
        style={[
          styles.foot,
          {
            color: theme.color.mutedForeground,
            fontFamily: theme.typography.fontFamily.sans.regular,
          },
        ]}
      >
        {`${fillTemplate(a.version, { version: appVersion })} · `}
        <Text
          accessibilityRole="link"
          style={styles.link}
          onPress={() => void Linking.openURL(TERMS_URL)}
        >
          {copy.profile.legal.terms}
        </Text>
      </Text>

      <ProfileSheet
        visible={identity !== null}
        onClose={() => setIdentity(null)}
        title={fillTemplate(a.identity.title, {
          provider: identity ? PROVIDER_NAMES[identity.provider] : "",
        })}
        badge={
          identity?.provider === "apple" ? (
            <Apple color={fg} size={26} strokeWidth={ICON_STROKE} />
          ) : (
            <CircleUserRound color={fg} size={26} strokeWidth={ICON_STROKE} />
          )
        }
        info={
          identity
            ? [
                ...(identity.email
                  ? [
                      {
                        label:
                          identity.provider === "apple"
                            ? a.identity.appleId
                            : a.identity.googleAccount,
                        value: identity.email,
                      },
                    ]
                  : []),
                {
                  label: a.identity.linkedAt,
                  value: formatLongDate(identity.linkedAt, language),
                },
              ]
            : []
        }
        body={
          identity
            ? fillTemplate(a.identity.body, {
                provider: PROVIDER_NAMES[identity.provider],
              })
            : undefined
        }
        buttons={
          identity
            ? [
                {
                  label: fillTemplate(a.identity.unlink, {
                    provider: PROVIDER_NAMES[identity.provider],
                  }),
                  variant: "destructive",
                  onPress: async () => {
                    await unlink.mutateAsync(identity.provider);
                    showToast(
                      fillTemplate(a.identity.unlinkedToast, {
                        provider: PROVIDER_NAMES[identity.provider],
                      }),
                    );
                  },
                },
                { label: a.identity.done, variant: "secondary" },
              ]
            : []
        }
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <ProfileSheet
        visible={device !== null}
        onClose={() => setDevice(null)}
        title={device ? deviceName(device) : ""}
        badge={
          device ? (
            <Smartphone color={fg} size={26} strokeWidth={ICON_STROKE} />
          ) : undefined
        }
        info={
          device
            ? [
                {
                  label: a.device.lastActive,
                  value: formatAgo(device.lastActiveAt, copy),
                },
                ...(device.city
                  ? [{ label: a.device.city, value: device.city }]
                  : []),
                {
                  label: a.device.firstSeen,
                  value: formatLongDate(device.createdAt, language),
                },
                ...(device.appVersion
                  ? [
                      {
                        label: a.device.version,
                        value: [
                          `Трефикс ${device.appVersion}`,
                          device.platform
                            ? platformName(device.platform)
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · "),
                      },
                    ]
                  : []),
              ]
            : []
        }
        buttons={[
          {
            label: a.device.end,
            variant: "destructive",
            onPress: async () => {
              if (!device) return;
              await revoke.mutateAsync(device.id);
              showToast(a.device.ended);
            },
          },
          { label: a.device.cancel, variant: "secondary" },
        ]}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <ProfileSheet
        visible={othersVisible}
        onClose={() => setOthersVisible(false)}
        title={a.logoutOthersSheet.title}
        body={a.logoutOthersSheet.body}
        buttons={[
          {
            label: a.logoutOthersSheet.confirm,
            variant: "destructive",
            onPress: async () => {
              await logoutOthers.mutateAsync();
              showToast(a.logoutOthersSheet.done);
            },
          },
          { label: a.logoutOthersSheet.cancel, variant: "secondary" },
        ]}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <ProfileSheet
        visible={exportVisible}
        onClose={() => setExportVisible(false)}
        title={a.exportSheet.title}
        badge={<Download color={fg} size={26} strokeWidth={ICON_STROKE} />}
        body={
          exportBlocked && latestExport
            ? latestExport.status === "pending"
              ? a.exportPending
              : fillTemplate(a.exportSheet.nextAt, {
                  date: formatLongDate(latestExport.nextAvailableAt, language),
                })
            : fillTemplate(a.exportSheet.body, { email: user?.email ?? "" })
        }
        items={a.exportSheet.items}
        buttons={
          exportBlocked
            ? [
                {
                  label: copy.profile.gearScreen.import.done,
                  variant: "secondary",
                },
              ]
            : [
                {
                  label: a.exportSheet.request,
                  onPress: async () => {
                    await requestExport.mutateAsync();
                    trackEvent("data_export_requested");
                    showToast(a.exportSheet.requested);
                  },
                },
              ]
        }
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <ProfileSheet
        visible={logoutVisible}
        onClose={() => setLogoutVisible(false)}
        title={a.logoutSheet.title}
        body={a.logoutSheet.body}
        buttons={[
          {
            label: a.logoutSheet.confirm,
            variant: "destructive",
            onPress: logout,
          },
          { label: a.logoutSheet.cancel, variant: "secondary" },
        ]}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />

      <DeleteAccountSheet
        visible={deleteVisible}
        onClose={(deleted) => {
          setDeleteVisible(false);
          if (deleted) accountDeleted();
        }}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

function platformName(platform: string): string {
  if (platform === "ios") return "iOS";
  if (platform === "android") return "Android";
  if (platform === "web") return "Web";
  return platform;
}

const styles = StyleSheet.create({
  foot: {
    textAlign: "center",
    fontSize: 12,
    lineHeight: 16,
    paddingBottom: 16,
  },
  link: {
    textDecorationLine: "underline",
  },
});
