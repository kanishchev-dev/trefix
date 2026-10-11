import { StyleSheet } from "react-native";

export const BAR_PADDING = 6;

export const SHELL_HEIGHT = 64;

export const INDICATOR_HEIGHT = 46;

export const HORIZONTAL_MARGIN = 16;

/** How far above the bar the bottom blur fades out. */
export const FADE_EXTRA = 40;

export const ICON_SIZE = 22;

export const styles = StyleSheet.create({
  outer: {
    position: "absolute",
    left: HORIZONTAL_MARGIN,
    right: HORIZONTAL_MARGIN,
    bottom: 0,
  },
  shell: {
    minHeight: SHELL_HEIGHT,
    borderRadius: SHELL_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: BAR_PADDING,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
  },
  indicatorSlot: {
    position: "absolute",
    top: (SHELL_HEIGHT - INDICATOR_HEIGHT) / 2 - 1,
    height: INDICATOR_HEIGHT,
  },
  indicator: {
    flex: 1,
    borderRadius: INDICATOR_HEIGHT / 2,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  indicatorHighlight: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: INDICATOR_HEIGHT / 2,
  },
  tabButton: {
    flex: 1,
    height: SHELL_HEIGHT - BAR_PADDING * 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  badgeDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  iconFrame: {
    width: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  house: {
    width: 16,
    height: 14,
    borderWidth: 1.5,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
  },
  houseRoof: {
    position: "absolute",
    top: -2,
    width: 10,
    height: 8,
    transform: [{ rotate: "45deg" }],
    borderRadius: 2,
  },
  planFrame: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 5,
    paddingHorizontal: 2.5,
    paddingVertical: 3,
    justifyContent: "space-between",
  },
  planLine: {
    width: 8.5,
    height: 1.35,
    borderRadius: 999,
  },
  progressWrap: {
    width: 16,
    height: 16,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
  },
  progressBar: {
    width: 2.8,
    borderRadius: 999,
  },
  profileBadge: {
    width: 20,
    height: 20,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  // Same visual size as the 22px line icons next to it.
  trefixDisc: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  tabIcon: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  // Same size as the coach disc, so the two round items match.
  profileAvatarBadge: {
    width: 30,
    height: 30,
    borderRadius: 15,
    overflow: "hidden",
  },
  profileAvatar: {
    width: "100%",
    height: "100%",
  },
  profileFallback: {
    fontSize: 10,
    lineHeight: 11,
  },
});
