import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, View, StyleSheet } from "react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { Header } from "./components/header";
import { TabBar } from "./components/tab-bar";
import { HeaderContext, type HeaderOptions } from "./context/header-context";
import { type MainTabKey } from "./main-types";
import { PlanScreen } from "./screens/plan-screen";
import { ProgressScreen } from "./screens/progress-screen";
import { TodayScreen } from "./screens/today-screen";
import { IntegrationsScreen } from "./screens/integrations-screen";
import { StravaIntegrationScreen } from "./screens/strava-integration-screen";
import { fillTemplate, type AppLanguage, type MainCopy } from "../../locales";
import { trackEvent } from "../../lib/analytics";
import { ToastProvider, useToast } from "../../shared/ui/toast";
import { type ThemePreference } from "./screens/theme-settings-screen";
import { PlanCreationMethodSheet } from "../plan-creation/components/plan-creation-method-sheet";
import {
  PlanCreationScreen,
  type PlanCreationLaunch,
  type PlanCreationOutcome,
} from "../plan-creation/plan-creation-screen";
import { StartPlanSheet } from "../plans/components/start-plan-sheet";
import { useStartPlan } from "../plans/hooks/use-start-plan";
import { usePlansRealtime } from "../plans/hooks/use-plans-realtime";
import { type PlansSegment } from "../plans/lib/plan-card-format";
import { PlansNavigationProvider, type PlansNavigation } from "../plans/plans-navigation";
import { PlanDetailsScreen } from "../plans/screens/plan-details-screen";
import { PlanDraftEditScreen } from "../plans/screens/plan-draft-edit-screen";
import { PlansScreen } from "../plans/screens/plans-screen";
import { useProfileRealtime } from "../profile/hooks/use-athlete-profile";
import { usePreferences } from "../profile/hooks/use-preferences";
import { type ProfileRoute } from "../profile/profile-routes";
import { BodyScreen } from "../profile/screens/body-screen";
import { CoachSettingsScreen } from "../profile/screens/coach-settings-screen";
import { ExperienceScreen } from "../profile/screens/experience-screen";
import { GearEditScreen } from "../profile/screens/gear-edit-screen";
import { GearScreen } from "../profile/screens/gear-screen";
import { HeartScreen } from "../profile/screens/heart-screen";
import { ProfileScreen } from "../profile/screens/profile-screen";
import { ProfileWizardScreen } from "../profile/screens/profile-wizard-screen";
import { ScheduleScreen } from "../profile/screens/schedule-screen";
import { UnitsScreen } from "../profile/screens/units-screen";

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  userEmail: string;
  userLanguage: AppLanguage;
  userTheme: ThemePreference;
  onOpenTrefix: () => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
  onEditProfile: () => void;
  onOpenNotifications: () => void;
  onOpenLanguage: () => void;
  onOpenTheme: () => void;
};

/** Screens pushed over the tabs: settings integrations and the plans library. */
type SubScreen =
  | { kind: "integrations" }
  | { kind: "strava-integration" }
  | { kind: "plans"; segment?: PlansSegment; highlightPlanId?: string | null }
  | { kind: "plan-details"; planId: string }
  | ProfileRoute;

type StartTarget = { id: string; name: string; entry: string };

export function MainTabsScreen(props: Props) {
  return (
    <ToastProvider theme={props.theme}>
      <MainTabsContent {...props} />
    </ToastProvider>
  );
}

function MainTabsContent({
  theme,
  themeMode,
  copy,
  userEmail,
  userLanguage,
  userTheme,
  onOpenTrefix: openTrefixChat,
  onLogout,
  onAccountDeleted,
  onEditProfile,
  onOpenNotifications,
  onOpenLanguage,
  onOpenTheme,
}: Props) {
  const [activeTab, setActiveTab] = useState<MainTabKey>("today");
  const [subScreens, setSubScreens] = useState<SubScreen[]>([]);
  const [headerOptions, setHeaderOptions] = useState<HeaderOptions>({});
  const [planCreationSheetVisible, setPlanCreationSheetVisible] = useState(false);
  const [creationLaunch, setCreationLaunch] = useState<PlanCreationLaunch | null>(null);
  const [draftEditPlanId, setDraftEditPlanId] = useState<string | null>(null);
  const [startTarget, setStartTarget] = useState<StartTarget | null>(null);
  // What the user picked in the method sheet; consumed when its close
  // animation finishes, so the creation screen opens only after the method
  // sheet has fully slid away.
  const [pendingCreation, setPendingCreation] = useState<"manual" | "trefix" | null>(null);
  const { showToast } = useToast();
  const startPlanMutation = useStartPlan();

  usePlansRealtime();
  useProfileRealtime();
  const { preferences } = usePreferences();
  // With the coach off the chat is unavailable: lead to the setting that turns it back on.
  const onOpenTrefix = useCallback(() => {
    if (preferences.coachEnabled) {
      openTrefixChat();
    } else {
      setSubScreens((current) => [...current, { kind: "settings-coach" }]);
    }
  }, [openTrefixChat, preferences.coachEnabled]);

  const subScreen = subScreens[subScreens.length - 1] ?? null;

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const translateAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    translateAnim.setValue(8);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateAnim, {
        toValue: 0,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab, subScreen, fadeAnim, translateAnim]);

  const handleTabChange = (tab: MainTabKey) => {
    setSubScreens([]);
    setActiveTab(tab);
  };

  const push = useCallback((screen: SubScreen) => setSubScreens((current) => [...current, screen]), []);
  const pop = useCallback(() => setSubScreens((current) => current.slice(0, -1)), []);

  const openPlanTab = useCallback(() => {
    setSubScreens([]);
    setActiveTab("plan");
  }, []);

  const openPlans = useCallback<PlansNavigation["openPlans"]>((options) => {
    trackEvent("plans_opened", { source: options?.source ?? "unknown" });
    setSubScreens((current) => {
      // Re-entering the library replaces it instead of stacking copies.
      const base = current.filter((screen) => screen.kind !== "plans" && screen.kind !== "plan-details");
      return [
        ...base,
        { kind: "plans", segment: options?.segment, highlightPlanId: options?.highlightPlanId ?? null },
      ];
    });
  }, []);

  const handleCreationCompleted = useCallback(
    (outcome: PlanCreationOutcome) => {
      if (outcome.kind === "started") {
        openPlanTab();
        showToast(fillTemplate(copy.plans.start.started, { name: outcome.name }));
      } else if (outcome.kind === "draft") {
        openPlans({ segment: "draft", highlightPlanId: outcome.planId, source: "creation" });
        showToast(copy.plans.start.draftSaved);
      } else {
        showToast(copy.plans.rebuild.updated);
      }
    },
    [copy.plans.rebuild.updated, copy.plans.start.draftSaved, copy.plans.start.started, openPlanTab, openPlans, showToast],
  );

  const navigation = useMemo<PlansNavigation>(
    () => ({
      openPlans,
      openPlanDetails: (planId) => push({ kind: "plan-details", planId }),
      openPlanTab,
      openCreationMethod: () => setPlanCreationSheetVisible(true),
      openCreation: (launch) => setCreationLaunch(launch),
      openDraftEdit: (planId) => setDraftEditPlanId(planId),
      startDraft: (plan, entry) => setStartTarget({ ...plan, entry }),
      openIntegrations: () => push({ kind: "integrations" }),
      back: pop,
    }),
    [openPlanTab, openPlans, pop, push],
  );

  return (
    <PlansNavigationProvider value={navigation}>
      <HeaderContext.Provider value={{ options: headerOptions, setOptions: setHeaderOptions }}>
        <View style={[styles.root, { backgroundColor: theme.color.background }]}>
          <Header
            theme={theme}
            themeMode={themeMode}
            leftAction={headerOptions.leftAction}
            centerContent={headerOptions.centerContent}
            rightAction={headerOptions.rightAction}
            variant={headerOptions.variant}
            bottomContent={headerOptions.bottomContent}
          />

          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [{ translateY: translateAnim }],
              },
            ]}
          >
            {subScreen?.kind === "integrations" ? (
              <IntegrationsScreen
                theme={theme}
                themeMode={themeMode}
                copy={copy}
                userLanguage={userLanguage}
                onBack={pop}
                onOpenStrava={() => push({ kind: "strava-integration" })}
              />
            ) : subScreen?.kind === "strava-integration" ? (
              <StravaIntegrationScreen
                theme={theme}
                themeMode={themeMode}
                copy={copy}
                userLanguage={userLanguage}
                onBack={pop}
              />
            ) : subScreen?.kind === "plans" ? (
              <PlansScreen
                theme={theme}
                themeMode={themeMode}
                copy={copy}
                language={userLanguage}
                initialSegment={subScreen.segment}
                highlightPlanId={subScreen.highlightPlanId}
              />
            ) : subScreen?.kind === "plan-details" ? (
              <PlanDetailsScreen
                key={subScreen.planId}
                planId={subScreen.planId}
                theme={theme}
                themeMode={themeMode}
                copy={copy}
                language={userLanguage}
              />
            ) : subScreen?.kind === "profile-body" ? (
              <BodyScreen theme={theme} themeMode={themeMode} copy={copy} language={userLanguage} onBack={pop} />
            ) : subScreen?.kind === "profile-heart" ? (
              <HeartScreen theme={theme} themeMode={themeMode} copy={copy} onBack={pop} />
            ) : subScreen?.kind === "profile-schedule" ? (
              <ScheduleScreen theme={theme} themeMode={themeMode} copy={copy} language={userLanguage} onBack={pop} />
            ) : subScreen?.kind === "profile-experience" ? (
              <ExperienceScreen theme={theme} themeMode={themeMode} copy={copy} onBack={pop} />
            ) : subScreen?.kind === "profile-gear" ? (
              <GearScreen
                theme={theme}
                themeMode={themeMode}
                copy={copy}
                language={userLanguage}
                onBack={pop}
                onNavigate={push}
              />
            ) : subScreen?.kind === "profile-gear-edit" ? (
              <GearEditScreen
                key={subScreen.gearId ?? "new"}
                gearId={subScreen.gearId}
                theme={theme}
                themeMode={themeMode}
                copy={copy}
                language={userLanguage}
                onBack={pop}
              />
            ) : subScreen?.kind === "settings-units" ? (
              <UnitsScreen theme={theme} themeMode={themeMode} copy={copy} language={userLanguage} onBack={pop} />
            ) : subScreen?.kind === "profile-wizard" ? (
              <ProfileWizardScreen
                initialStep={subScreen.step}
                theme={theme}
                themeMode={themeMode}
                copy={copy}
                language={userLanguage}
                onClose={pop}
              />
            ) : subScreen?.kind === "settings-coach" ? (
              <CoachSettingsScreen theme={theme} themeMode={themeMode} copy={copy} onBack={pop} />
            ) : activeTab === "today" ? (
              <TodayScreen theme={theme} themeMode={themeMode} copy={copy} />
            ) : activeTab === "plan" ? (
              <PlanScreen copy={copy} language={userLanguage} theme={theme} themeMode={themeMode} />
            ) : activeTab === "progress" ? (
              <ProgressScreen
                copy={copy}
                onOpenTrefix={onOpenTrefix}
                theme={theme}
                themeMode={themeMode}
              />
            ) : activeTab === "profile" ? (
              <ProfileScreen
                theme={theme}
                themeMode={themeMode}
                copy={copy}
                userLanguage={userLanguage}
                userTheme={userTheme}
                onLogout={onLogout}
                onEdit={onEditProfile}
                onOpenNotifications={onOpenNotifications}
                onOpenLanguage={onOpenLanguage}
                onOpenTheme={onOpenTheme}
                onOpenIntegrations={() => push({ kind: "integrations" })}
                onOpenStrava={() => push({ kind: "strava-integration" })}
                onNavigate={push}
                onAccountDeleted={onAccountDeleted}
              />
            ) : null}
          </Animated.View>

          <TabBar
            theme={theme}
            themeMode={themeMode}
            userEmail={userEmail}
            activeTab={activeTab}
            onChangeTab={handleTabChange}
            onOpenTrefix={onOpenTrefix}
            showTrefix={preferences.coachEnabled}
          />

          <PlanCreationMethodSheet
            visible={planCreationSheetVisible}
            onClose={() => {
              setPlanCreationSheetVisible(false);
              if (pendingCreation === "manual") {
                setCreationLaunch({ mode: "create" });
              } else if (pendingCreation === "trefix") {
                onOpenTrefix();
              }
              setPendingCreation(null);
            }}
            onOpenTrefix={() => {
              setPendingCreation("trefix");
              setPlanCreationSheetVisible(false);
            }}
            onCreateManually={() => {
              setPendingCreation("manual");
              setPlanCreationSheetVisible(false);
            }}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
          />

          <StartPlanSheet
            visible={startTarget !== null}
            mode="draft"
            planId={startTarget?.id}
            planName={startTarget?.name ?? ""}
            entry={startTarget?.entry ?? "unknown"}
            onStart={async (block) => {
              if (!startTarget) return;
              await startPlanMutation.mutateAsync({ planId: startTarget.id, ...block });
            }}
            onUpdateMetrics={() => {
              if (startTarget) {
                setCreationLaunch({ mode: "draft-params", planId: startTarget.id, initialStep: "metrics" });
              }
            }}
            onClose={(result) => {
              const target = startTarget;
              setStartTarget(null);
              if (result === "started" && target) {
                openPlanTab();
                showToast(fillTemplate(copy.plans.start.started, { name: target.name }));
              }
            }}
            theme={theme}
            themeMode={themeMode}
            copy={copy}
            language={userLanguage}
          />

          {draftEditPlanId ? (
            <PlanDraftEditScreen
              planId={draftEditPlanId}
              onClose={() => setDraftEditPlanId(null)}
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              language={userLanguage}
            />
          ) : null}

          {creationLaunch ? (
            <PlanCreationScreen
              key={JSON.stringify(creationLaunch)}
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              language={userLanguage}
              launch={creationLaunch}
              onClose={() => setCreationLaunch(null)}
              onCompleted={handleCreationCompleted}
              onOpenIntegrations={() => {
                setCreationLaunch(null);
                push({ kind: "integrations" });
              }}
              onOpenTrefix={() => {
                setCreationLaunch(null);
                onOpenTrefix();
              }}
            />
          ) : null}
        </View>
      </HeaderContext.Provider>
    </PlansNavigationProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingBottom: 0,
  },
});
