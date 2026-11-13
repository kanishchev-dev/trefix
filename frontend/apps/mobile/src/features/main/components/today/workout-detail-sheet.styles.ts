import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  title: {
    fontSize: 15,
    lineHeight: 20,
    flexShrink: 1,
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: -8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
  scrollView: {
    flexShrink: 1,
    width: "100%",
  },
  scrollContent: {
    gap: 16,
    paddingTop: 56,
    paddingBottom: 84,
  },
  errorBanner: {
    padding: 12,
    borderRadius: 12,
  },
  errorText: {
    fontSize: 13,
  },
  section: {
    gap: 8,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
  },
  statBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  statValue: {
    fontSize: 18,
    lineHeight: 22,
  },
  statLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  descriptionText: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  infoText: {
    fontSize: 14,
  },
  analysisCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  analysisTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  analysisBody: {
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  completingForm: {
    gap: 12,
    marginTop: 8,
  },
  metricsRow: {
    flexDirection: "row",
    gap: 12,
  },
  planActionsRow: {
    flexDirection: "row",
    gap: 8,
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
});
