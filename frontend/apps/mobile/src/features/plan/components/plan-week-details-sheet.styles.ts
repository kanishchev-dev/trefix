import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  scrollView: {
    flexShrink: 1,
    width: "100%",
  },
  // Room for the floating sheet header on top and the action row below.
  scrollContent: {
    paddingTop: 72,
    paddingBottom: 84,
  },
  body: {
    gap: 16,
  },
  kicker: {
    fontSize: 13,
    lineHeight: 18,
  },
  intent: {
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
  },
  todayRow: {
    borderRadius: 16,
    marginHorizontal: -10,
    paddingHorizontal: 10,
  },
  pressed: {
    opacity: 0.6,
  },
  dayColumn: {
    width: 36,
    alignItems: "center",
  },
  dayName: {
    fontSize: 11,
    lineHeight: 14,
  },
  dayNumber: {
    fontSize: 15,
    lineHeight: 20,
    fontVariant: ["tabular-nums"],
  },
  rowText: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  rowTitle: {
    fontSize: 15,
    lineHeight: 20,
  },
  rowMeta: {
    fontSize: 12,
    lineHeight: 16,
  },
  rowFact: {
    fontSize: 13,
    lineHeight: 18,
    fontVariant: ["tabular-nums"],
  },
  addCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  changes: {
    gap: 10,
  },
  change: {
    flexDirection: "row",
    alignItems: "flex-start",
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
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
});
