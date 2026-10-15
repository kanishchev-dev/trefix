import { formatDateLong, type AppLanguage } from "../../../locales";
import { parseIsoDate } from "../../plans/lib/plan-dates";

/** "12–18 октября" / "October 12–18"; both months when the range crosses one. */
export function formatDateRange(
  startIso: string,
  endIso: string,
  language: AppLanguage,
): string {
  const start = parseIsoDate(startIso);
  const end = parseIsoDate(endIso);
  if (start.getMonth() !== end.getMonth()) {
    return `${formatDateLong(start, language)} – ${formatDateLong(end, language)}`;
  }
  return language === "ru"
    ? `${start.getDate()}–${formatDateLong(end, language)}`
    : `${formatDateLong(start, language)}–${end.getDate()}`;
}
