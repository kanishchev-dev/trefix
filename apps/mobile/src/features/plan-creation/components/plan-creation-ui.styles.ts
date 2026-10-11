import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  inputRowBlock: {
    gap: 16,
  },
  inputRowHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  inputRowLabel: {
    fontSize: 14,
    lineHeight: 18,
    textAlign: "center",
  },
  badgePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgePillText: {
    fontSize: 11,
    lineHeight: 14,
  },
  inputContainer: {
    position: "relative",
    justifyContent: "center",
  },
  textInput: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    lineHeight: 20,
  },
  unitSuffix: {
    position: "absolute",
    right: 16,
    fontSize: 13,
  },
  multilineInput: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 20,
    minHeight: 96,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  chipLabel: {
    fontSize: 14,
    lineHeight: 18,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  dayCell: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  dayLabel: {
    fontSize: 13,
    lineHeight: 17,
  },
  sectionBlock: {
    gap: 28,
  },
  sectionHeader: {
    gap: 4,
  },
  sectionTitle: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: "center",
  },
  sectionDescription: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
  },
  // Separator in the spirit of shadcn Marker (separator variant):
  // quiet centred label between hairlines; spacing does the grouping.
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  dividerTitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldHeader: {
    gap: 2,
  },
  fieldInfo: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  addLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    gap: 6,
    paddingVertical: 8,
  },
  addLinkText: {
    fontSize: 15,
    lineHeight: 20,
  },
  optionalEmptyRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  optionalEmptyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionalActionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  optionalRemove: {
    alignSelf: "center",
    paddingVertical: 2,
  },
  optionalRemoveText: {
    fontSize: 13,
    lineHeight: 18,
  },
  fieldError: {
    fontSize: 12,
    lineHeight: 16,
    marginLeft: 4,
  },
  pressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
});
