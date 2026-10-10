import { useCallback, useMemo, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { StackActions } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { fillTemplate, type AppLanguage, type MainCopy } from "../../locales";
import { trackEvent } from "../../lib/analytics";
import { ToastProvider, useToast } from "../../shared/ui/toast";
import { HealthIntegrationScreen } from "../health-sync/health-integration-screen";
import { useHealthSyncTriggers } from "../health-sync/hooks";
import { PlanCreationMethodSheet } from "../plan-creation/components/plan-creation-method-sheet";
import {
  PlanCreationScreen,
  type PlanCreationLaunch,
  type PlanCreationOutcome,
} from "../plan-creation/plan-creation-screen";
import { StartPlanSheet } from "../plans/components/start-plan-sheet";
import { useStartPlan } from "../plans/hooks/use-start-plan";
import { usePlansRealtime } from "../plans/hooks/use-plans-realtime";
import { PlansNavigationProvider, type PlansNavigation } from "../plans/plans-navigation";
import { PlanDetailsScreen } from "../plans/screens/plan-details-screen";
import { PlanDraftEditScreen } from "../plans/screens/plan-draft-edit-screen";
import { PlansScreen } from "../plans/screens/plans-screen";
import { useProfileRealtime } from "../profile/hooks/use-athlete-profile";
import { usePreferences } from "../profile/hooks/use-preferences";
import { BodyScreen } from "../profile/screens/body-screen";
import { CoachSettingsScreen } from "../profile/screens/coach-settings-screen";
import { ExperienceScreen } from "../profile/screens/experience-screen";
import { GearEditScreen } from "../profile/screens/gear-edit-screen";
import { GearScreen } from "../profile/screens/gear-screen";
import { HeartScreen } from "../profile/screens/heart-screen";
import { ProfileWizardScreen } from "../profile/screens/profile-wizard-screen";
import { ScheduleScreen } from "../profile/screens/schedule-screen";
import { UnitsScreen } from "../profile/screens/units-screen";
import { useProgressRealtime } from "../progress/hooks/use-progress-v2";
import { MetricScreen } from "../progress/screens/metric-screen";
import { RecordsScreen } from "../progress/screens/records-screen";
import { PushedScreen } from "./components/pushed-screen";
import { MainTabsScreen } from "./main-tabs-screen";
import {
  goBack,
  mainNavigationRef,
  MainShellProvider,
  openStackScreen,
  openTab,
  pushSubScreen,
  type MainShell,
  type MainStackParamList,
} from "./main-routes";
import { IntegrationsScreen } from "./screens/integrations-screen";
import { LanguageSettingsScreen } from "./screens/language-settings-screen";
import { NotificationsSettingsScreen } from "./screens/notifications-settings-screen";
import { ProfileEditScreen } from "./screens/profile-edit-screen";
import { StravaIntegrationScreen } from "./screens/strava-integration-screen";
import { ThemeSettingsScreen, type ThemePreference } from "./screens/theme-settings-screen";
import { TrefixScreen } from "./screens/trefix-screen";

const Stack = createNativeStackNavigator<MainStackParamList>();

type Props = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  userEmail: string;
  language: AppLanguage;
  userTheme: ThemePreference;
  onLogout: () => void;
  onAccountDeleted: () => void;
  onSelectLanguage: (language: AppLanguage) => void;
  onSelectTheme: (theme: ThemePreference) => void;
};

type StartTarget = { id: string; name: string; entry: string };

/** Signed-in app: the tabs and every screen pushed over them, plus the plan sheets shown above all of them. */
export function MainNavigator(props: Props) {
  return (
    <ToastProvider theme={props.theme}>
      <MainStackHost {...props} />
    </ToastProvider>
  );
}

function MainStackHost({
  theme,
  themeMode,
  copy,
  userEmail,
  language,
  userTheme,
  onLogout,
  onAccountDeleted,
  onSelectLanguage,
  onSelectTheme,
}: Props) {
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
  useHealthSyncTriggers();
  useProgressRealtime();
  const { preferences } = usePreferences();

  // With the coach off the chat is unavailable: lead to the setting that turns it back on.
  const openTrefix = useCallback(() => {
    if (preferences.coachEnabled) {
      openStackScreen("trefix");
    } else {
      pushSubScreen({ kind: "settings-coach" });
    }
  }, [preferences.coachEnabled]);

  const openPlanTab = useCallback(() => openTab("plan"), []);

  const openPlans = useCallback<PlansNavigation["openPlans"]>((options) => {
    trackEvent("plans_opened", { source: options?.source ?? "unknown" });
    const params = { segment: options?.segment, highlightPlanId: options?.highlightPlanId ?? null };
    const routes = mainNavigationRef.isReady() ? mainNavigationRef.getRootState()?.routes ?? [] : [];
    // Re-entering the library returns to it instead of stacking copies.
    if (routes.some((route) => route.name === "plans")) {
      mainNavigationRef.dispatch(StackActions.popTo("plans", params));
    } else {
      pushSubScreen({ kind: "plans", ...params });
    }
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

  const plansNavigation = useMemo<PlansNavigation>(
    () => ({
      openPlans,
      openPlanDetails: (planId) => pushSubScreen({ kind: "plan-details", planId }),
      openPlanTab,
      openCreationMethod: () => setPlanCreationSheetVisible(true),
      openCreation: (launch) => setCreationLaunch(launch),
      openDraftEdit: (planId) => setDraftEditPlanId(planId),
      startDraft: (plan, entry) => setStartTarget({ ...plan, entry }),
      openIntegrations: () => pushSubScreen({ kind: "integrations" }),
      back: goBack,
    }),
    [openPlanTab, openPlans],
  );

  const shell = useMemo<MainShell>(
    () => ({ push: pushSubScreen, back: goBack, openTrefix }),
    [openTrefix],
  );

  const frame = (children: ReactNode) => (
    <PushedScreen theme={theme} themeMode={themeMode}>
      {children}
    </PushedScreen>
  );

  return (
    <PlansNavigationProvider value={plansNavigation}>
      <MainShellProvider value={shell}>
        <View style={styles.root}>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="main">
              {() => (
                <MainTabsScreen
                  theme={theme}
                  themeMode={themeMode}
                  copy={copy}
                  userEmail={userEmail}
                  userLanguage={language}
                  userTheme={userTheme}
                  onLogout={onLogout}
                  onAccountDeleted={onAccountDeleted}
                />
              )}
            </Stack.Screen>

            {/* Account */}
            <Stack.Screen name="profileEdit">
              {() => <ProfileEditScreen theme={theme} themeMode={themeMode} copy={copy} onBack={goBack} />}
            </Stack.Screen>
            <Stack.Screen name="notificationsSettings">
              {() => <NotificationsSettingsScreen theme={theme} themeMode={themeMode} copy={copy} onBack={goBack} />}
            </Stack.Screen>
            <Stack.Screen name="languageSettings">
              {() => (
                <LanguageSettingsScreen
                  theme={theme}
                  themeMode={themeMode}
                  copy={copy}
                  selectedLanguage={language}
                  onSelectLanguage={onSelectLanguage}
                  onBack={goBack}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="themeSettings">
              {() => (
                <ThemeSettingsScreen
                  theme={theme}
                  themeMode={themeMode}
                  copy={copy}
                  selectedTheme={userTheme}
                  onSelectTheme={onSelectTheme}
                  onBack={goBack}
                />
              )}
            </Stack.Screen>
            <Stack.Screen name="trefix">
              {() => <TrefixScreen onBack={goBack} theme={theme} themeMode={themeMode} copy={copy.trefix} />}
            </Stack.Screen>

            {/* Integrations */}
            <Stack.Screen name="integrations">
              {() =>
                frame(
                  <IntegrationsScreen
                    theme={theme}
                    themeMode={themeMode}
                    copy={copy}
                    userLanguage={language}
                    onBack={goBack}
                    onOpenStrava={() => pushSubScreen({ kind: "strava-integration" })}
                    onOpenHealth={() => pushSubScreen({ kind: "health-integration" })}
                  />,
                )
              }
            </Stack.Screen>
            <Stack.Screen name="health-integration">
              {() => frame(<HealthIntegrationScreen theme={theme} themeMode={themeMode} copy={copy} onBack={goBack} />)}
            </Stack.Screen>
            <Stack.Screen name="strava-integration">
              {() =>
                frame(
                  <StravaIntegrationScreen
                    theme={theme}
                    themeMode={themeMode}
                    copy={copy}
                    userLanguage={language}
                    onBack={goBack}
                  />,
                )
              }
            </Stack.Screen>

            {/* Plans */}
            <Stack.Screen name="plans">
              {({ route }) =>
                frame(
                  <PlansScreen
                    theme={theme}
                    themeMode={themeMode}
                    copy={copy}
                    language={language}
                    initialSegment={route.params?.segment}
                    highlightPlanId={route.params?.highlightPlanId}
                  />,
                )
              }
            </Stack.Screen>
            <Stack.Screen name="plan-details">
              {({ route }) =>
                frame(
                  <PlanDetailsScreen
                    key={route.params?.planId}
                    planId={route.params?.planId ?? ""}
                    theme={theme}
                    themeMode={themeMode}
                    copy={copy}
                    language={language}
                  />,
                )
              }
            </Stack.Screen>

            {/* Progress */}
            <Stack.Screen name="progress-records">
              {() =>
                frame(
                  <RecordsScreen theme={theme} themeMode={themeMode} copy={copy} language={language} onBack={goBack} />,
                )
              }
            </Stack.Screen>
            <Stack.Screen name="progress-metric">
              {({ route }) =>
                frame(
                  <MetricScreen
                    key={route.params?.metric}
                    metric={route.params?.metric ?? "threshold_pace"}
                    theme={theme}
                    themeMode={themeMode}
                    copy={copy}
                    language={language}
                    onBack={goBack}
                    onOpenHeart={() => pushSubScreen({ kind: "profile-heart" })}
                  />,
                )
              }
            </Stack.Screen>

            {/* Profile */}
            <Stack.Screen name="profile-body">
              {() =>
                frame(<BodyScreen theme={theme} themeMode={themeMode} copy={copy} language={language} onBack={goBack} />)
              }
            </Stack.Screen>
            <Stack.Screen name="profile-heart">
              {() => frame(<HeartScreen theme={theme} themeMode={themeMode} copy={copy} onBack={goBack} />)}
            </Stack.Screen>
            <Stack.Screen name="profile-schedule">
              {() =>
                frame(
                  <ScheduleScreen theme={theme} themeMode={themeMode} copy={copy} language={language} onBack={goBack} />,
                )
              }
            </Stack.Screen>
            <Stack.Screen name="profile-experience">
              {() => frame(<ExperienceScreen theme={theme} themeMode={themeMode} copy={copy} onBack={goBack} />)}
            </Stack.Screen>
            <Stack.Screen name="profile-gear">
              {() =>
                frame(
                  <GearScreen
                    theme={theme}
                    themeMode={themeMode}
                    copy={copy}
                    language={language}
                    onBack={goBack}
                    onNavigate={pushSubScreen}
                  />,
                )
              }
            </Stack.Screen>
            <Stack.Screen name="profile-gear-edit">
              {({ route }) =>
                frame(
                  <GearEditScreen
                    key={route.params?.gearId ?? "new"}
                    gearId={route.params?.gearId}
                    theme={theme}
                    themeMode={themeMode}
                    copy={copy}
                    language={language}
                    onBack={goBack}
                  />,
                )
              }
            </Stack.Screen>
            <Stack.Screen name="settings-units">
              {() =>
                frame(<UnitsScreen theme={theme} themeMode={themeMode} copy={copy} language={language} onBack={goBack} />)
              }
            </Stack.Screen>
            <Stack.Screen name="settings-coach">
              {() => frame(<CoachSettingsScreen theme={theme} themeMode={themeMode} copy={copy} onBack={goBack} />)}
            </Stack.Screen>
            <Stack.Screen name="profile-wizard">
              {({ route }) =>
                frame(
                  <ProfileWizardScreen
                    initialStep={route.params?.step}
                    theme={theme}
                    themeMode={themeMode}
                    copy={copy}
                    language={language}
                    onClose={goBack}
                  />,
                )
              }
            </Stack.Screen>
          </Stack.Navigator>

          <PlanCreationMethodSheet
            visible={planCreationSheetVisible}
            onClose={() => {
              setPlanCreationSheetVisible(false);
              if (pendingCreation === "manual") {
                setCreationLaunch({ mode: "create" });
              } else if (pendingCreation === "trefix") {
                openTrefix();
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
            language={language}
          />

          {draftEditPlanId ? (
            <PlanDraftEditScreen
              planId={draftEditPlanId}
              onClose={() => setDraftEditPlanId(null)}
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              language={language}
            />
          ) : null}

          {creationLaunch ? (
            <PlanCreationScreen
              key={JSON.stringify(creationLaunch)}
              theme={theme}
              themeMode={themeMode}
              copy={copy}
              language={language}
              launch={creationLaunch}
              onClose={() => setCreationLaunch(null)}
              onCompleted={handleCreationCompleted}
              onOpenIntegrations={() => {
                setCreationLaunch(null);
                pushSubScreen({ kind: "integrations" });
              }}
              onOpenTrefix={() => {
                setCreationLaunch(null);
                openTrefix();
              }}
            />
          ) : null}
        </View>
      </MainShellProvider>
    </PlansNavigationProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
