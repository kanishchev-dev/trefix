import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  scrollView: {
    flexShrink: 1,
    width: "100%",
  },
  scrollContent: {
    gap: 20,
    paddingVertical: 4,
  },
  section: {
    gap: 6,
  },
  focusText: {
    fontSize: 18,
    lineHeight: 24,
  },
  bodyText: {
    fontSize: 14,
    lineHeight: 20,
  },
  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
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
  sessionsList: {
    gap: 8,
    marginTop: 4,
  },
  sessionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  workoutText: {
    flex: 1,
    gap: 2,
  },
  sessionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  sessionText: {
    fontSize: 14,
    lineHeight: 20,
  },
  adaptationsList: {
    gap: 8,
    marginTop: 4,
  },
  adaptationCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  adaptationTextWrapper: {
    flex: 1,
    gap: 2,
  },
  adaptationTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  adaptationDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  doneButton: {
    height: 52,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  doneButtonPressed: {
    transform: [{ scale: 0.985 }],
  },
  doneLabel: {
    fontSize: 16,
    lineHeight: 22,
  },
});
