import { Modal, Pressable, StyleSheet, Text, View, Image } from "react-native";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";
import { type MainCopy } from "../../../locales";

type QrDialogProps = {
  visible: boolean;
  onClose: () => void;
  referralCode: string;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
};

export function QrDialog({
  visible,
  onClose,
  referralCode,
  theme,
  themeMode,
  copy,
}: QrDialogProps) {
  const insets = useSafeAreaInsets();
  // Generate QR code using public API for the referral link
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=workspace-auth://referral/${referralCode}&bgcolor=${themeMode === "dark" ? "09090b" : "ffffff"}&color=${themeMode === "dark" ? "ffffff" : "09090b"}`;

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.color.scrim }]}
          onPress={onClose}
        >
          <BlurView
            intensity={20}
            style={StyleSheet.absoluteFill}
            tint={themeMode}
          />
        </Pressable>

        <View style={styles.container}>
          <View
            style={[
              styles.card,
              {
                borderColor: theme.color.border,
                backgroundColor: theme.color.surfaceElevated,
                paddingBottom: Math.max(insets.bottom, 24),
              },
            ]}
          >
            <View style={styles.handleContainer}>
              <View
                style={[styles.handle, { backgroundColor: theme.color.border }]}
              />
            </View>

            <View style={styles.header}>
              <Text
                style={[
                  styles.title,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {copy.profile.qr.title}
              </Text>
              <Pressable
                hitSlop={12}
                onPress={onClose}
                style={styles.closeButton}
              >
                <X color={theme.color.mutedForeground} size={20} />
              </Pressable>
            </View>

            <View
              style={[
                styles.qrContainer,
                {
                  backgroundColor:
                    themeMode === "dark"
                      ? theme.color.background
                      : theme.color.surface,
                },
              ]}
            >
              <Image
                source={{ uri: qrUrl }}
                style={styles.qrImage}
                resizeMode="contain"
              />
            </View>

            <View style={styles.codeSection}>
              <Text
                style={[
                  styles.codeLabel,
                  {
                    color: theme.color.mutedForeground,
                    fontFamily: theme.typography.fontFamily.sans.medium,
                  },
                ]}
              >
                {copy.profile.qr.partnerCode}
              </Text>
              <Text
                style={[
                  styles.codeValue,
                  {
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.extrabold,
                  },
                ]}
              >
                {referralCode}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={onClose}
              style={({ pressed }) => [
                styles.doneButton,
                {
                  backgroundColor: theme.color.primary,
                },
                pressed && styles.doneButtonPressed,
              ]}
            >
              <Text
                style={[
                  styles.doneLabel,
                  {
                    color: theme.color.primaryForeground,
                    fontFamily: theme.typography.fontFamily.sans.semibold,
                  },
                ]}
              >
                {copy.profile.qr.close}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
  },
  container: {
    width: "100%",
    zIndex: 1,
  },
  card: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 24,
    paddingTop: 12,
    gap: 20,
    overflow: "hidden",
  },
  handleContainer: {
    alignItems: "center",
    marginBottom: 8,
  },
  handle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.5,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 20,
    lineHeight: 28,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  qrContainer: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 24,
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: {
    width: "100%",
    height: "100%",
  },
  codeSection: {
    alignItems: "center",
    gap: 4,
  },
  codeLabel: {
    fontSize: 12,
    lineHeight: 16,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  codeValue: {
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 2,
  },
  doneButton: {
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  doneButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  doneLabel: {
    fontSize: 16,
    lineHeight: 22,
  },
});
