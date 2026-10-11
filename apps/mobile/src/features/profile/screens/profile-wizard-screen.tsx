import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import {
  HeartPulse,
  PenLine,
  ShieldCheck,
  CircleHelp,
} from "lucide-react-native";

import { type ThemeMode, type ThemeTokens } from "@workspace/tokens";

import { trackEvent } from "../../../lib/analytics";
import {
  fillTemplate,
  type AppLanguage,
  type MainCopy,
} from "../../../locales";
import { SheetButton } from "../../../shared/ui/bottom-sheet";
import { ActionCard } from "../../../shared/ui/list-card";
import { useToast } from "../../../shared/ui/toast";
import {
  HeaderBackButton,
  HeaderTextButton,
} from "../../main/components/header";
import { SectionLayout } from "../../main/components/section-layout";
import { useHeaderOptions } from "../../main/context/header-context";
import { BodyFieldsCard } from "../components/body-fields-card";
import {
  ProfileValueSheet,
  type ValueSheetConfig,
} from "../components/profile-value-sheet";
import {
  useAthleteProfile,
  useUpdateAthleteProfile,
} from "../hooks/use-athlete-profile";
import { profileErrorMessage } from "../lib/profile-format";

type Step = 1 | 2 | 3;

type Props = {
  initialStep?: Step;
  theme: ThemeTokens;
  themeMode: ThemeMode;
  copy: MainCopy;
  language: AppLanguage;
  onClose: () => void;
};

/** E2 — three short steps: body, threshold heart rate, limitations. Every answer is saved right away. */
export function ProfileWizardScreen({
  initialStep = 1,
  theme,
  themeMode,
  copy,
  language,
  onClose,
}: Props) {
  const { data: athlete } = useAthleteProfile();
  const update = useUpdateAthleteProfile();
  const { showToast } = useToast();
  const [step, setStep] = useState<Step>(initialStep);
  const [sheet, setSheet] = useState<ValueSheetConfig | null>(null);
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState("");
  const w = copy.profile.wizard;
  const stepCopy = w.steps[step - 1];

  useEffect(() => {
    if (athlete?.limitations) setText(athlete.limitations);
  }, [athlete?.limitations]);

  const next = () => {
    trackEvent("profile_wizard_step", { step, action: "next" });
    if (step === 3) onClose();
    else setStep((step + 1) as Step);
  };
  const back = () => (step === 1 ? onClose() : setStep((step - 1) as Step));

  useHeaderOptions(
    {
      leftAction: (
        <HeaderBackButton theme={theme} themeMode={themeMode} onPress={back} />
      ),
      centerContent: null,
      rightAction: (
        <HeaderTextButton
          theme={theme}
          themeMode={themeMode}
          label={w.later}
          accessibilityLabel={w.later}
          onPress={() => {
            trackEvent("profile_wizard_step", { step, action: "later" });
            onClose();
          }}
        />
      ),
      variant: "default",
      bottomContent: null,
    },
    [theme, themeMode, step, w.later],
  );

  const saveLimitations = async (value: string) => {
    try {
      await update.mutateAsync({ limitations: value });
      next();
    } catch (error) {
      showToast(profileErrorMessage(error, copy));
    }
  };

  const icon = (Icon: typeof HeartPulse) => (
    <Icon color={theme.color.foreground} size={20} />
  );

  return (
    <SectionLayout
      hasHeader={false}
      scrollable
      theme={theme}
      themeMode={themeMode}
    >
      <View style={styles.stack}>
        <View style={styles.dots}>
          {[1, 2, 3].map((index) => (
            <View
              key={index}
              style={[
                styles.dot,
                {
                  backgroundColor:
                    index <= step
                      ? theme.color.foreground
                      : theme.color.iconSurface,
                },
              ]}
            />
          ))}
        </View>
        <View style={styles.titles}>
          <Text
            style={[
              styles.stepLabel,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {fillTemplate(w.step, { n: step })}
          </Text>
          <Text
            style={[
              styles.title,
              {
                color: theme.color.foreground,
                fontFamily: theme.typography.fontFamily.sans.medium,
              },
            ]}
          >
            {stepCopy.title}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.subtitle,
              {
                color: theme.color.mutedForeground,
                fontFamily: theme.typography.fontFamily.sans.regular,
              },
            ]}
          >
            {stepCopy.subtitle}
          </Text>
        </View>

        {step === 1 && athlete ? (
          <BodyFieldsCard
            athlete={athlete}
            copy={copy}
            language={language}
            theme={theme}
            themeMode={themeMode}
          />
        ) : null}

        {step === 2 && athlete ? (
          <View style={styles.options}>
            <ActionCard
              theme={theme}
              icon={icon(HeartPulse)}
              title={
                athlete.thresholdHeartRate
                  ? `${w.know} · ${athlete.thresholdHeartRate}`
                  : w.know
              }
              description={w.knowDescription}
              onPress={() =>
                setSheet({
                  kind: "number",
                  title: copy.profile.heart.threshold,
                  value: athlete.thresholdHeartRate ?? null,
                  fallback: 165,
                  min: 100,
                  max: 220,
                  unit: copy.profile.unitLabels.bpm,
                  majorEvery: 10,
                  labelEvery: 10,
                  onSave: async (value) => {
                    await update.mutateAsync({
                      thresholdHeartRate: value,
                      hrZonesMethod: "threshold",
                    });
                    setTimeout(next, 320);
                  },
                })
              }
            />
            <ActionCard
              theme={theme}
              icon={icon(CircleHelp)}
              title={w.dontKnow}
              description={w.dontKnowDescription}
              onPress={next}
            />
          </View>
        ) : null}

        {step === 3 ? (
          <View style={styles.options}>
            <ActionCard
              theme={theme}
              icon={icon(ShieldCheck)}
              title={w.noLimits}
              description={w.noLimitsDescription}
              onPress={() => void saveLimitations("")}
            />
            <ActionCard
              theme={theme}
              icon={icon(PenLine)}
              title={w.hasLimits}
              description={w.hasLimitsDescription}
              onPress={() => setWriting(true)}
            />
            {writing ? (
              <TextInput
                multiline
                autoFocus
                maxLength={500}
                value={text}
                onChangeText={setText}
                placeholder={copy.profile.experience.limitationsPlaceholder}
                placeholderTextColor={theme.color.mutedForeground}
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.color.card,
                    color: theme.color.foreground,
                    fontFamily: theme.typography.fontFamily.sans.regular,
                  },
                ]}
              />
            ) : null}
          </View>
        ) : null}

        <SheetButton
          label={step === 3 ? w.done : w.next}
          pending={update.isPending}
          disabled={step === 3 && writing && text.trim().length === 0}
          onPress={() =>
            step === 3 && writing ? void saveLimitations(text.trim()) : next()
          }
          theme={theme}
          themeMode={themeMode}
        />
      </View>
      <ProfileValueSheet
        config={sheet}
        onClose={() => setSheet(null)}
        copy={copy}
        theme={theme}
        themeMode={themeMode}
      />
    </SectionLayout>
  );
}

const styles = StyleSheet.create({
  stack: {
    gap: 20,
    paddingTop: 4,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
  },
  dot: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  titles: {
    gap: 4,
  },
  stepLabel: {
    fontSize: 12,
    lineHeight: 16,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 19,
  },
  options: {
    gap: 8,
  },
  input: {
    minHeight: 110,
    borderRadius: 24,
    padding: 16,
    fontSize: 15,
    lineHeight: 20,
    textAlignVertical: "top",
  },
});
