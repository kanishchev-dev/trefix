import { StyleSheet } from "react-native";
import { STACK_CARD_HEIGHT } from "./bottom-sheet-stack";

export const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdropContainer: {
    ...StyleSheet.absoluteFill,
  },
  container: {
    width: "100%",
    paddingHorizontal: 8,
    maxHeight: "85%",
    zIndex: 1,
  },
  stackLayerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 8,
    zIndex: 1,
  },
  stackLayerCardWrapper: {
    marginBottom: 8,
  },
  card: {
    // Let tall content shrink to the container's maxHeight (85%) instead of
    // overflowing it — otherwise the bottom gap disappears behind the screen edge.
    flexShrink: 1,
    borderRadius: 44,
    borderWidth: StyleSheet.hairlineWidth,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    gap: 0,
    overflow: "hidden",
  },
  stackCard: {
    height: STACK_CARD_HEIGHT,
    overflow: "hidden",
  },
  paddedContent: {
    paddingHorizontal: 20,
  },
  topDragArea: {
    width: "100%",
    gap: 8,
    backgroundColor: "transparent",
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  handleContainer: {
    alignItems: "center",
    paddingVertical: 4,
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
    justifyContent: "center",
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  tabsContainer: {
    flexDirection: "row",
    borderRadius: 9999,
    borderWidth: 0,
    padding: 4,
    position: "relative",
    overflow: "hidden",
  },
  activeTabIndicator: {
    position: "absolute",
    top: 4,
    bottom: 4,
    borderRadius: 9999,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: "center",
    zIndex: 1,
  },
  tabText: {
    fontSize: 14,
    lineHeight: 18,
  },
  tabsCompact: {
    width: 148,
    flexGrow: 0,
    flexShrink: 0,
  },
  tabCompact: {
    paddingVertical: 7,
  },
  tabTextCompact: {
    fontSize: 13,
  },
  button: {
    flex: 1,
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonWithIcon: {
    flexDirection: "row",
    gap: 8,
  },
  buttonLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  buttonPressed: {
    transform: [{ scale: 0.985 }],
  },
  sectionLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  sheetContent: {
    flexGrow: 1,
    flexShrink: 1,
    gap: 16,
    position: "relative",
  },
  sheetContentPadding: {
    paddingHorizontal: 20,
  },
  sheetContentBleed: {
    marginHorizontal: -20,
  },
  topFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 52,
    zIndex: 5,
  },
  bottomFade: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 52,
    zIndex: 5,
  },
});
