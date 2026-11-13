import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  loadingOverlay: {
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingCard: {
    alignSelf: "stretch",
    gap: 16,
    borderRadius: 32,
    padding: 20,
  },
  loadingActions: {
    flexDirection: "row",
    gap: 12,
  },
  stepLayerRoot: {
    flex: 1,
  },
  stepScroll: {
    flex: 1,
  },
  scrollContent: {
    // Vertical rhythm between blocks of a step; keep in sync with goal-setup-step.
    gap: 52,
    paddingTop: 72,
    paddingBottom: 84,
  },
  stepInfoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  stepQuestion: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: "transparent",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  iconButton: {
    width: 52,
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  inlineErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  inlineErrorText: {
    fontSize: 12,
    lineHeight: 16,
    flex: 1,
  },
  pressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.9,
  },
});
