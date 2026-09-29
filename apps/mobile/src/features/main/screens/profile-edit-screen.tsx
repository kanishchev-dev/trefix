import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  StyleSheet,
  Text,
  View,
  Pressable,
  ActivityIndicator,
  Image,
} from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as ImagePicker from "expo-image-picker";
import { Camera, UserRound } from "lucide-react-native";

import {
  updateUserSchema,
  type UpdateUserInput,
} from "@workspace/api-client";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { HeaderBackButton, HeaderTitle } from "../components/header";
import { SectionLayout } from "../components/section-layout";
import { updateMe, uploadAvatar } from "../../../lib/auth-api";
import { useProfile } from "../hooks/use-profile";
import { type MainCopy } from "../../../locales";
import { GlassInput } from "../../../shared/ui/glass-input";
import { useState } from "react";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onBack: () => void;
};

export function ProfileEditScreen({ theme, themeMode, copy, onBack }: Props) {
  const queryClient = useQueryClient();
  const { data: user } = useProfile();
  const [isUploading, setIsUploading] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(updateUserSchema),
    defaultValues: {
      firstName: user?.firstName ?? "",
      lastName: user?.lastName ?? "",
      avatarUrl: user?.avatarUrl ?? "",
    },
  });

  const avatarUrl = watch("avatarUrl");

  const mutation = useMutation({
    mutationFn: updateMe,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
      onBack();
    },
    onError: (error) => {
      Alert.alert("Error", error.message);
    },
  });

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "We need camera roll permissions to change your avatar.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      try {
        setIsUploading(true);
        const uploadedUrl = await uploadAvatar(result.assets[0].uri);
        setValue("avatarUrl", uploadedUrl, { shouldDirty: true });
      } catch (error) {
        Alert.alert("Upload Failed", error instanceof Error ? error.message : "Could not upload image");
      } finally {
        setIsUploading(false);
      }
    }
  };

  const onSubmit = (data: UpdateUserInput) => {
    mutation.mutate(data);
  };

  return (
    <SectionLayout
      leftAction={
        <HeaderBackButton
          theme={theme}
          themeMode={themeMode}
          onPress={onBack}
        />
      }
      headerCenter={<HeaderTitle theme={theme}>{copy.profile.hero.edit}</HeaderTitle>}
      scrollable
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.container}>
        <View style={styles.hero}>
          <Pressable
            onPress={pickImage}
            disabled={isUploading}
            style={({ pressed }) => [
              styles.avatarContainer,
              {
                backgroundColor: theme.color.surfaceElevated,
                borderColor: theme.color.border,
              },
              pressed && { opacity: 0.8 },
            ]}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
            ) : (
              <UserRound
                color={theme.color.foreground}
                size={48}
                strokeWidth={1.2}
              />
            )}

            <View style={[styles.cameraBadge, { backgroundColor: theme.color.primary }]}>
              {isUploading ? (
                <ActivityIndicator size="small" color={theme.color.primaryForeground} />
              ) : (
                <Camera color={theme.color.primaryForeground} size={14} strokeWidth={2.5} />
              )}
            </View>
          </Pressable>
          <Text
            style={[
              styles.heroText,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {copy.profile.hero.changePhoto}
          </Text>
        </View>

        <View style={styles.form}>
          <Controller
            control={control}
            name="firstName"
            render={({ field: { onChange, onBlur, value } }) => (
              <GlassInput
                theme={theme}
                placeholder={copy.profile.hero.firstName}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.firstName?.message}
                textAlign="center"
              />
            )}
          />

          <Controller
            control={control}
            name="lastName"
            render={({ field: { onChange, onBlur, value } }) => (
              <GlassInput
                theme={theme}
                placeholder={copy.profile.hero.lastName}
                value={value}
                onBlur={onBlur}
                onChangeText={onChange}
                error={errors.lastName?.message}
                textAlign="center"
              />
            )}
          />
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={handleSubmit(onSubmit)}
          disabled={mutation.isPending || !isDirty || isUploading}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: theme.color.primary,
              borderColor: theme.color.primary,
              opacity: mutation.isPending || !isDirty || isUploading ? 0.6 : 1,
            },
            pressed && styles.submitButtonPressed,
          ]}
        >
          {mutation.isPending ? (
            <ActivityIndicator color={theme.color.primaryForeground} />
          ) : (
            <Text
              style={[
                styles.submitText,
                {
                  color: theme.color.primaryForeground,
                  fontFamily: theme.typography.fontFamily.sans.medium,
                },
              ]}
            >
              {copy.profile.hero.save}
            </Text>
          )}
        </Pressable>
      </View>
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 40,
    paddingTop: 20,
  },
  hero: {
    alignItems: "center",
  },
  avatarContainer: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
    borderRadius: 55,
  },
  cameraBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.1)",
  },
  heroText: {
    fontSize: 14,
    marginTop: 12,
  },
  form: {
    gap: 16,
  },
  submitButton: {
    minHeight: 48,
    alignSelf: "stretch",
    width: "100%",
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  submitButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  submitText: {
    fontSize: 16,
    lineHeight: 22,
  },
});
