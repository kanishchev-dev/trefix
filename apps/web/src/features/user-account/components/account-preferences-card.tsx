"use client";

import type { ReactElement } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@trefix/ui/components/card";
import { Switch } from "@trefix/ui/components/switch";

import type {
  UserPreferences,
  UserPreferencesUpdate,
} from "@trefix/api-client";

import { useAuth } from "@/components/auth-provider";
import { formatDate, useI18n } from "@/shared/i18n";
import { DetailSkeleton, ErrorState } from "@/widgets/data-state";
import { OptionSelect } from "@/widgets/option-select";

import {
  useAccountActions,
  useUserPreferences,
} from "../hooks/use-user-account";

type SelectKey =
  | "distanceUnit"
  | "weekStart"
  | "timeFormat"
  | "languageMode"
  | "coachAdaptationMode"
  | "coachTone";

const SELECTS: { key: SelectKey; values: readonly string[] }[] = [
  { key: "distanceUnit", values: ["km", "mi"] },
  { key: "weekStart", values: ["mon", "sun"] },
  { key: "timeFormat", values: ["24h", "12h"] },
  { key: "languageMode", values: ["system", "ru", "en"] },
  { key: "coachAdaptationMode", values: ["auto", "confirm", "suggest"] },
  { key: "coachTone", values: ["soft", "neutral", "strict"] },
];

type SwitchKey =
  | "coachEnabled"
  | "stravaProfileSync"
  | "stravaActivitiesSync"
  | "stravaGearSync";

const SWITCHES: readonly SwitchKey[] = [
  "coachEnabled",
  "stravaProfileSync",
  "stravaActivitiesSync",
  "stravaGearSync",
];

/** The user's app settings; each change is saved on its own. */
export function AccountPreferencesCard({
  userId,
}: {
  userId: string;
}): ReactElement {
  const { t, locale } = useI18n();
  const { hasPermission } = useAuth();
  const query = useUserPreferences(userId);
  const { updatePreferences } = useAccountActions(userId);
  const canUpdate = hasPermission("users.update");

  const save = (input: UserPreferencesUpdate) =>
    updatePreferences.mutate(input);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("userCard.account.preferences.title")}</CardTitle>
        <CardDescription>
          {query.data
            ? t("userCard.account.preferences.updatedAt", {
                date: formatDate(query.data.updatedAt, locale),
              })
            : t("userCard.account.preferences.description")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {query.isLoading ? (
          <DetailSkeleton />
        ) : query.isError || !query.data ? (
          <ErrorState onRetry={() => query.refetch()} />
        ) : (
          <PreferencesForm
            preferences={query.data}
            disabled={!canUpdate || updatePreferences.isPending}
            onChange={save}
          />
        )}
      </CardContent>
    </Card>
  );
}

function PreferencesForm({
  preferences,
  disabled,
  onChange,
}: {
  preferences: UserPreferences;
  disabled: boolean;
  onChange: (input: UserPreferencesUpdate) => void;
}): ReactElement {
  const { t } = useI18n();

  return (
    <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
      {SELECTS.map(({ key, values }) => (
        <div key={key} className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">
            {t(`userCard.account.preferences.fields.${key}`)}
          </span>
          <OptionSelect
            value={preferences[key]}
            disabled={disabled}
            options={values.map((value) => ({
              value,
              label: t(`userCard.account.preferences.values.${key}.${value}`),
            }))}
            onValueChange={(value) =>
              onChange({ [key]: value } as UserPreferencesUpdate)
            }
          />
        </div>
      ))}
      {SWITCHES.map((key) => (
        <label
          key={key}
          className="flex items-center justify-between gap-4 py-1 text-sm"
        >
          <span>{t(`userCard.account.preferences.fields.${key}`)}</span>
          <Switch
            checked={preferences[key]}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ [key]: checked })}
          />
        </label>
      ))}
      <div className="flex flex-col gap-1 text-sm md:col-span-2">
        <span className="text-muted-foreground">
          {t("userCard.account.preferences.fields.timezone")}
        </span>
        <span className="font-medium">{preferences.timezone ?? "—"}</span>
      </div>
    </div>
  );
}
