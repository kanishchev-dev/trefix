import { StyleSheet } from "react-native";

export const HEADER_CONTENT_HEIGHT = 56;

export const BACKGROUND_TOP_OFFSET = 0; // Start blur exactly from the notch boundary

export const BACKGROUND_TOTAL_HEIGHT = 82;

export const ACTION_SIZE = 44;

export const ACTION_SLOT_WIDTH = 96;

export const styles = StyleSheet.create({
  root: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    zIndex: 20,
  },
  content: {
    justifyContent: "center",
  },
  leftSlot: {
    position: "absolute",
    left: 16,
    top: 0,
    bottom: 0,
    width: ACTION_SLOT_WIDTH,
    alignItems: "flex-start",
    justifyContent: "center",
  },
  rightSlot: {
    position: "absolute",
    right: 16,
    top: 0,
    bottom: 0,
    width: ACTION_SLOT_WIDTH,
    alignItems: "flex-end",
    justifyContent: "center",
  },
  centerSlot: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: 72,
  },
  bottomContent: {
    paddingTop: 12,
    paddingBottom: 8,
  },
  logo: {
    width: 168,
    height: 40,
  },
  titlePill: {
    minHeight: 78,
    minWidth: 286,
    borderRadius: 28,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
  },
  titlePillTitle: {
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.6,
  },
  titlePillSubtitle: {
    marginTop: 2,
    fontSize: 15,
    lineHeight: 18,
  },
  actionButtonContainer: {
    width: ACTION_SIZE,
    height: ACTION_SIZE,
  },
  actionButtonGlass: {
    width: "100%",
    height: "100%",
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  actionButtonPressed: {
    transform: [{ scale: 0.94 }],
  },
  textButtonContainer: {
    minHeight: ACTION_SIZE,
  },
  textButtonGlass: {
    minHeight: ACTION_SIZE,
    minWidth: 84,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  textButtonPressed: {
    transform: [{ scale: 0.96 }],
  },
  textButtonLabel: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0,
  },
});
