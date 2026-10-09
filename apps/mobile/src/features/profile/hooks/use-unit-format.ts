import { useMemo } from "react";

import { type AppLanguage, type MainCopy } from "../../../locales";
import { createFormatter, type Formatter } from "../lib/profile-format";
import { usePreferences } from "./use-preferences";

/** Distance / weight / height formatting in the user's unit system, for any screen. */
export function useUnitFormat(copy: MainCopy, language?: AppLanguage): Formatter {
  const { preferences } = usePreferences();
  const resolvedLanguage: AppLanguage = language ?? (copy.profile.unitLabels.km === "км" ? "ru" : "en");
  return useMemo(() => createFormatter(copy, resolvedLanguage, preferences), [copy, resolvedLanguage, preferences]);
}
