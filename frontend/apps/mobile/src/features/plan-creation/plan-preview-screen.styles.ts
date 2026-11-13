import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  root: {
    // Full-screen page mounted as a flex sibling of the tab content in
    // MainTabsScreen; it must overlay the whole screen instead of sharing
    // the remaining space with it.
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  headerTitle: {
    flexShrink: 1,
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  headerTitleFill: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    // room for the floating footer buttons
    paddingBottom: 120,
    gap: 16,
  },
  pageHint: {
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
    paddingHorizontal: 8,
    marginBottom: 8,
  },
  summaryCard: {
    alignItems: "center",
    borderRadius: 32,
    padding: 20,
  },
  summaryTitle: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  summaryStats: {
    flexDirection: "row",
    alignSelf: "stretch",
    justifyContent: "space-around",
  },
  stat: {
    alignItems: "center",
    gap: 2,
  },
  statValue: {
    fontSize: 17,
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  summaryMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  weekCard: {
    gap: 8,
    borderRadius: 32,
    padding: 20,
  },
  weekHeader: {
    gap: 2,
  },
  weekLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  weekTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  weekMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  workoutList: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  workoutRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  workoutDay: {
    width: 28,
    fontSize: 13,
    lineHeight: 18,
  },
  workoutTextGroup: {
    flex: 1,
    gap: 2,
  },
  workoutType: {
    fontSize: 14,
    lineHeight: 19,
  },
  workoutMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 10,
  },
  footerButtons: {
    flexDirection: "row",
    gap: 12,
  },
  inlineErrorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  inlineErrorText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
  },
  inlineErrorRetry: {
    fontSize: 12,
    lineHeight: 16,
  },
  // Same offsets as the creation-step sheets (header overlay on top, actions at the bottom).
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  addButton: {
    flex: 0,
    alignSelf: "stretch",
    marginTop: 4,
  },
  rowPressed: {
    opacity: 0.6,
  },
  strike: {
    textDecorationLine: "line-through",
  },
  removedRow: {
    fontSize: 12,
    lineHeight: 16,
    paddingVertical: 8,
    textDecorationLine: "line-through",
  },
});
