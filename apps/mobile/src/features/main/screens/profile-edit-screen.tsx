import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import {
  CalendarDays,
  Camera,
  Images,
  Trash2,
  UserRound,
} from "lucide-react-native";

import { USER_BIO_MAX_LENGTH, type AthleteSex } from "@trefix/api-client";
import { type ThemeMode, type ThemeTokens } from "@trefix/tokens";

import { resolveBackendMediaUrl } from "../../../lib/backend-url";
import {
  formatLongDate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { getErrorMessage } from "../../../shared/lib/error-message";
import { SheetTabs } from "../../../shared/ui/sheet-controls";
import { useToast } from "../../../shared/ui/toast";
import { InlineError } from "../../plans/components/plans-ui";
import { HeaderPillButton } from "../../profile/components/header-pill-button";
import {
  FormField,
  FormInput,
  FormSelect,
  FormTextArea,
} from "../../profile/components/profile-form";
import { ProfileSheet } from "../../profile/components/profile-sheet";
import { ProfileSubScreen } from "../../profile/components/profile-sub-screen";
import { ICON_STROKE, ROW_ICON } from "../../profile/components/profile-ui";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "../../profile/components/profile-value-sheet";
import {
  useAthleteProfile,
  useUpdateAthleteProfile,
} from "../../profile/hooks/use-athlete-profile";
import { profileErrorMessage } from "../../profile/lib/profile-format";
import {
  useProfile,
  useRemoveAvatar,
  useUpdateProfile,
  useUploadAvatar,
} from "../hooks/use-profile";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onBack: () => void;
};

type Draft = {
  firstName: string;
  lastName: string;
  bio: string;
  sex: AthleteSex | null;
  birthDate: string | null;
};

/**
 * Name, photo and "about" live on the account; sex and date of birth on the
 * athlete profile — the same values the "Body" screen edits.
 */
export function ProfileEditScreen({
  theme,
  themeMode,
  copy,
  language,
  onBack,
}: Props) {
  const { data: user } = useProfile();
  const { data: athlete } = useAthleteProfile();
  const updateUser = useUpdateProfile();
  const updateAthlete = useUpdateAthleteProfile();
  const avatarUpload = useUploadAvatar();
  const avatarRemove = useRemoveAvatar();
  const { showToast } = useToast();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [photoVisible, setPhotoVisible] = useState(false);
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const e = copy.profile.edit;
  const fg = theme.color.foreground;

  useEffect(() => {
    if (!user || draft) return;
    setDraft({
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio ?? "",
      sex: athlete?.sex ?? null,
      birthDate: athlete?.birthDate ?? null,
    });
  }, [user, athlete, draft]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (!draft || !user) return;
    if (draft.firstName.trim().length === 0) {
      setError(e.nameRequired);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const bio = draft.bio.trim();
      if (
        draft.firstName.trim() !== user.firstName ||
        draft.lastName.trim() !== user.lastName ||
        bio !== (user.bio ?? "")
      ) {
        await updateUser.mutateAsync({
          firstName: draft.firstName.trim(),
          ...(draft.lastName.trim() ? { lastName: draft.lastName.trim() } : {}),
          bio: bio.length > 0 ? bio : null,
        });
      }
      if (
        athlete &&
        (draft.sex !== athlete.sex || draft.birthDate !== athlete.birthDate)
      ) {
        await updateAthlete.mutateAsync({
          sex: draft.sex,
          birthDate: draft.birthDate,
        });
      }
      showToast(e.saved);
      onBack();
    } catch (saveError) {
      setError(profileErrorMessage(saveError, copy));
    } finally {
      setSaving(false);
    }
  };

  const upload = async (source: "camera" | "library") => {
    const permission =
      source === "camera"
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== "granted") {
      Alert.alert(
        copy.errors.photoPermissionTitle,
        copy.errors.photoPermission,
      );
      return;
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    };
    const result =
      source === "camera"
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (result.canceled || !result.assets[0]) return;
    try {
      await avatarUpload.mutateAsync(result.assets[0].uri);
    } catch (uploadError) {
      Alert.alert(
        copy.errors.uploadFailedTitle,
        getErrorMessage(uploadError, copy.errors, copy.errors.uploadFailed),
      );
    }
  };

  const avatarUri = user?.avatarUrl
    ? resolveBackendMediaUrl(user.avatarUrl)
    : null;

  return (
    <ProfileSubScreen
      title={e.title}
      onBack={onBack}
      rightAction={
        <HeaderPillButton
          theme={theme}
          label={e.save}
          pending={saving}
          disabled={!draft}
          onPress={() => void save()}
        />
      }
      rightActionKey={`${saving}:${Boolean(draft)}:${JSON.stringify(draft)}`}
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.form}>
        <View style={styles.photo}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.profile.hero.changePhoto}
            onPress={() => setPhotoVisible(true)}
            style={[styles.avatar, { backgroundColor: theme.color.card }]}
          >
            {avatarUpload.isPending ? (
              <ActivityIndicator color={fg} />
            ) : avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <UserRound color={fg} size={44} strokeWidth={1.8} />
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={e.photoTitle}
            onPress={() => setPhotoVisible(true)}
            style={[
              styles.camera,
              { backgroundColor: fg, borderColor: theme.color.screen },
            ]}
          >
            <Camera color={theme.color.card} size={16} strokeWidth={2.1} />
          </Pressable>
        </View>

        <FormField theme={theme} label={e.firstName}>
          <FormInput
            theme={theme}
            value={draft?.firstName ?? ""}
            onChangeText={(value) => set("firstName", value)}
            autoComplete="given-name"
            maxLength={80}
            accessibilityLabel={e.firstName}
          />
        </FormField>
        <FormField theme={theme} label={e.lastName}>
          <FormInput
            theme={theme}
            value={draft?.lastName ?? ""}
            onChangeText={(value) => set("lastName", value)}
            autoComplete="family-name"
            maxLength={80}
            accessibilityLabel={e.lastName}
          />
        </FormField>
        <FormField theme={theme} label={e.sex}>
          <SheetTabs
            tabs={(["male", "female"] as const).map((key) => ({
              key,
              label: copy.profile.body.sexes[key],
            }))}
            value={draft?.sex ?? ("" as AthleteSex)}
            onChange={(value) => set("sex", value)}
            theme={theme}
            trackColor={theme.color.card}
            accessibilityLabel={e.sex}
          />
        </FormField>
        <FormField theme={theme} label={e.birthDate}>
          <FormSelect
            theme={theme}
            value={
              draft?.birthDate
                ? formatLongDate(draft.birthDate, language)
                : null
            }
            placeholder={e.notSet}
            icon={
              <CalendarDays
                color={theme.color.mutedForeground}
                size={ROW_ICON}
                strokeWidth={ICON_STROKE}
              />
            }
            accessibilityLabel={e.birthDate}
            onPress={() =>
              setSheet({
                kind: "date",
                title: e.birthDate,
                value: draft?.birthDate ?? null,
                fallback: "1990-01-01",
                minDate: "1926-01-01",
                onSave: async (value) => set("birthDate", value),
              })
            }
          />
        </FormField>
        <FormField theme={theme} label={e.about}>
          <FormTextArea
            theme={theme}
            value={draft?.bio ?? ""}
            onChangeText={(value) => set("bio", value)}
            maxLength={USER_BIO_MAX_LENGTH}
            placeholder={e.aboutPlaceholder}
            accessibilityLabel={e.about}
          />
        </FormField>
        {error ? <InlineError message={error} theme={theme} /> : null}
      </View>

      <ProfileSheet
        visible={photoVisible}
        onClose={() => setPhotoVisible(false)}
        title={e.photoTitle}
        actions={[
          {
            key: "camera",
            label: e.takePhoto,
            icon: (
              <Camera color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
            ),
            onPress: () => setTimeout(() => void upload("camera"), 320),
          },
          {
            key: "library",
            label: e.pickPhoto,
            icon: (
              <Images color={fg} size={ROW_ICON} strokeWidth={ICON_STROKE} />
            ),
            onPress: () => setTimeout(() => void upload("library"), 320),
          },
          ...(user?.avatarUrl
            ? [
                {
                  key: "remove",
                  label: e.removePhoto,
                  destructive: true,
                  icon: (
                    <Trash2
                      color={theme.color.danger}
                      size={ROW_ICON}
                      strokeWidth={ICON_STROKE}
                    />
                  ),
                  onPress: () => avatarRemove.mutateAsync(),
                },
              ]
            : []),
        ]}
        buttons={[{ label: e.cancel, variant: "secondary" }]}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
      <ProfileValueSheet
        config={sheet}
        onClose={() => setSheet(null)}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </ProfileSubScreen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: 20,
  },
  photo: {
    alignSelf: "center",
    width: 120,
    height: 120,
    marginBottom: 4,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  camera: {
    position: "absolute",
    right: 2,
    bottom: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
