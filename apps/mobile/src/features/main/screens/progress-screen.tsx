import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import type {
  ProgressCapability,
  ProgressDisplayState,
  ProgressMilestone,
} from "../../progress/types/progress-types";
import { useProgress } from "../../progress/hooks/use-progress";
import { PeriodSelector } from "../../progress/components/period-selector";
import { FormOverviewCard } from "../../progress/components/form-overview-card";
import { GoalProgressCard } from "../../progress/components/goal-progress-card";
import { CapabilitiesSection } from "../../progress/components/capabilities-section";
import { CapabilityDetailSheet } from "../../progress/components/capability-detail-sheet";
import { PerformanceSection } from "../../progress/components/performance-section";
import { MilestonesSection } from "../../progress/components/milestones-section";
import { MilestonesListSheet } from "../../progress/components/milestones-list-sheet";
import { MilestoneDetailSheet } from "../../progress/components/milestone-detail-sheet";
import { TrainingImpactCard } from "../../progress/components/training-impact-card";
import { ProgressEmptyState } from "../../progress/components/progress-empty-state";
import { ProgressInsufficientDataCard } from "../../progress/components/progress-insufficient-data-card";
import { ProgressErrorState } from "../../progress/components/progress-error-state";
import { ProgressSkeleton } from "../../progress/components/progress-skeleton";

import {
  HeaderLogo,
  HeaderPlusButton,
  HeaderTemplateButton,
} from "../components/header";
import { useHeaderOptions } from "../context/header-context";
import { SectionLayout } from "../components/section-layout";
import type { ThemeMode, ThemeTokens } from "@workspace/tokens";
import type { MainCopy } from "../../../locales";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  onOpenTrefix?: () => void;
};

const STATE_CYCLE: ProgressDisplayState[] = [
  "active",
  "insufficient_data",
  "empty",
  "loading",
  "error",
];

export function ProgressScreen({
  theme,
  themeMode,
  copy,
  onOpenTrefix,
}: Props) {
  const {
    period,
    setPeriod,
    displayState,
    switchDisplayState,
    data,
    getAskTrefixPromptForCapability,
    getAskTrefixPromptForMilestone,
  } = useProgress();

  const [selectedCapability, setSelectedCapability] =
    useState<ProgressCapability | null>(null);
  const [selectedMilestone, setSelectedMilestone] =
    useState<ProgressMilestone | null>(null);
  const [isMilestonesListOpen, setIsMilestonesListOpen] = useState(false);

  const logoSource =
    themeMode === "dark"
      ? require("../../../../assets/trefix-logo-light.png")
      : require("../../../../assets/trefix-logo-dark.png");

  // Cycle state for testing non-active states
  const handleCycleState = () => {
    const currentIndex = STATE_CYCLE.indexOf(displayState);
    const nextIndex = (currentIndex + 1) % STATE_CYCLE.length;
    switchDisplayState(STATE_CYCLE[nextIndex]);
  };

  const handleAskTrefixForCapability = (capability: ProgressCapability) => {
    const prompt = getAskTrefixPromptForCapability(capability);
    console.log("[ProgressScreen] Ask Trefix prompt:", prompt);
    if (onOpenTrefix) {
      onOpenTrefix();
    }
  };

  const handleAskTrefixForMilestone = (milestone: ProgressMilestone) => {
    const prompt = getAskTrefixPromptForMilestone(milestone);
    console.log("[ProgressScreen] Ask Trefix prompt:", prompt);
    if (onOpenTrefix) {
      onOpenTrefix();
    }
  };

  useHeaderOptions(
    {
      leftAction: (
        <HeaderTemplateButton
          onPress={handleCycleState}
          theme={theme}
          themeMode={themeMode}
        />
      ),
      centerContent: <HeaderLogo source={logoSource} />,
      rightAction: (
        <HeaderPlusButton
          onPress={() => switchDisplayState("active")}
          theme={theme}
          themeMode={themeMode}
        />
      ),
      variant: "default",
      bottomContent: null,
    },
    [theme, themeMode, logoSource],
  );

  return (
    <SectionLayout
      hasHeader={false}
      scrollable
      theme={theme}
      themeMode={themeMode}
    >
      {/* Testing Badge for Non-Active States */}
      {displayState !== "active" ? (
        <View style={styles.stateBadgeRow}>
          <View
            style={[
              styles.stateBadge,
              {
                backgroundColor: theme.color.surfaceElevated,
                borderColor: theme.color.border,
              },
            ]}
          >
            <Text
              style={[
                styles.stateBadgeText,
                {
                  color: theme.color.mutedForeground,
                  fontFamily: theme.typography.fontFamily.sans.semibold,
                },
              ]}
            >
              State: {displayState}
            </Text>
          </View>
        </View>
      ) : null}

      {/* Period Selector (Always available) */}
      <PeriodSelector
        copy={copy}
        onSelectPeriod={setPeriod}
        selectedPeriod={period}
        theme={theme}
        themeMode={themeMode}
      />

      {/* Render Main Content per Data State */}
      {displayState === "loading" ? (
        <ProgressSkeleton theme={theme} themeMode={themeMode} />
      ) : displayState === "error" ? (
        <ProgressErrorState
          copy={copy}
          onRetry={() => switchDisplayState("active")}
          theme={theme}
          themeMode={themeMode}
        />
      ) : displayState === "empty" ? (
        <ProgressEmptyState copy={copy} theme={theme} themeMode={themeMode} />
      ) : displayState === "insufficient_data" ? (
        <ProgressInsufficientDataCard
          copy={copy}
          theme={theme}
          themeMode={themeMode}
        />
      ) : data ? (
        <>
          {/* 1. Current Form Overview */}
          <FormOverviewCard
            copy={copy}
            form={data.form}
            theme={theme}
            themeMode={themeMode}
          />

          {/* 2. Goal Progress */}
          {data.goal ? (
            <GoalProgressCard
              copy={copy}
              goal={data.goal}
              theme={theme}
              themeMode={themeMode}
            />
          ) : null}

          {/* 3. Runner Capabilities */}
          {data.capabilities && data.capabilities.length > 0 ? (
            <CapabilitiesSection
              capabilities={data.capabilities}
              copy={copy}
              onSelectCapability={setSelectedCapability}
              theme={theme}
              themeMode={themeMode}
            />
          ) : null}

          {/* 4. Performance Trends & Interactive Chart */}
          {data.performance && data.performance.length > 0 ? (
            <PerformanceSection
              copy={copy}
              metrics={data.performance}
              theme={theme}
              themeMode={themeMode}
            />
          ) : null}

          {/* 5. Milestones */}
          {data.milestones && data.milestones.length > 0 ? (
            <MilestonesSection
              copy={copy}
              milestones={data.milestones}
              onSelectMilestone={setSelectedMilestone}
              onViewAll={() => setIsMilestonesListOpen(true)}
              theme={theme}
              themeMode={themeMode}
            />
          ) : null}

          {/* 6. Training Impact */}
          {data.trainingImpact ? (
            <TrainingImpactCard
              copy={copy}
              impact={data.trainingImpact}
              theme={theme}
              themeMode={themeMode}
            />
          ) : null}
        </>
      ) : null}

      {/* Capability Detail Sheet */}
      <CapabilityDetailSheet
        capability={selectedCapability}
        copy={copy}
        onAskTrefix={handleAskTrefixForCapability}
        onClose={() => setSelectedCapability(null)}
        theme={theme}
        themeMode={themeMode}
        visible={selectedCapability !== null}
      />

      {/* Full Milestones List Sheet */}
      <MilestonesListSheet
        copy={copy}
        milestones={data?.milestones || []}
        onClose={() => setIsMilestonesListOpen(false)}
        onSelectMilestone={setSelectedMilestone}
        theme={theme}
        themeMode={themeMode}
        visible={isMilestonesListOpen}
      />

      {/* Milestone Detail Sheet */}
      <MilestoneDetailSheet
        copy={copy}
        milestone={selectedMilestone}
        onAskTrefix={handleAskTrefixForMilestone}
        onClose={() => setSelectedMilestone(null)}
        theme={theme}
        themeMode={themeMode}
        visible={selectedMilestone !== null}
      />
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  stateBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginBottom: 12,
  },
  stateBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  stateBadgeText: {
    fontSize: 11,
    lineHeight: 15,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
});
