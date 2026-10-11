import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  section: { gap: 10 },
  hint: { fontSize: 13, lineHeight: 18 },
  label: { fontSize: 15, lineHeight: 20 },
  gpsRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  gpsDot: { width: 8, height: 8, borderRadius: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1, gap: 2 },
  actions: { gap: 10, paddingTop: 8 },
  plan: { gap: 2, paddingTop: 4 },
  planRow: {
    flexDirection: "row",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  planLabel: { width: 116, fontSize: 15, lineHeight: 20 },
});
