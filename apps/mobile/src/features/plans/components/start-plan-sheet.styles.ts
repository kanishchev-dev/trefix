import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  options: {
    gap: 10,
  },
  optionBlock: {
    gap: 8,
  },
  reason: {
    gap: 4,
    paddingHorizontal: 16,
  },
  wheelBlock: {
    gap: 12,
  },
  radioRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
  },
  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  radioText: {
    flex: 1,
    gap: 2,
  },
  radioLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  badge: {
    fontSize: 11,
    lineHeight: 14,
    textTransform: "uppercase",
  },
  muted: {
    fontSize: 13,
    lineHeight: 18,
  },
  link: {
    fontSize: 13,
    lineHeight: 18,
  },
});
