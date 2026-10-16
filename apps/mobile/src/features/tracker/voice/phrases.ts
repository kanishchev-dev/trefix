import type { ExecutionStep } from "@trefix/api-client";

import type { Cue, VoiceReport } from "./cues";

export type VoiceLanguage = "ru" | "en";
export type VoiceUnits = "metric" | "imperial";

const METRES_PER_MILE = 1609.344;

type Forms = [one: string, few: string, many: string];

/** Russian plural form; fractions take the "few" form ("2,5 километра"). */
function ruPlural(value: number, forms: Forms): string {
  if (!Number.isInteger(value)) return forms[1];
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

const enPlural = (value: number, one: string, many: string): string =>
  value === 1 ? one : many;

type Words = {
  hours: (n: number) => string;
  minutes: (n: number) => string;
  seconds: (n: number) => string;
  metres: (n: number) => string;
  km: (n: number) => string;
  miles: (n: number) => string;
};

const WORDS: Record<VoiceLanguage, Words> = {
  ru: {
    hours: (n) => `${n} ${ruPlural(n, ["час", "часа", "часов"])}`,
    minutes: (n) => `${n} ${ruPlural(n, ["минута", "минуты", "минут"])}`,
    seconds: (n) => `${n} ${ruPlural(n, ["секунда", "секунды", "секунд"])}`,
    metres: (n) => `${n} ${ruPlural(n, ["метр", "метра", "метров"])}`,
    km: (n) =>
      `${fmt(n, ",")} ${ruPlural(n, ["километр", "километра", "километров"])}`,
    miles: (n) => `${fmt(n, ",")} ${ruPlural(n, ["миля", "мили", "миль"])}`,
  },
  en: {
    hours: (n) => `${n} ${enPlural(n, "hour", "hours")}`,
    minutes: (n) => `${n} ${enPlural(n, "minute", "minutes")}`,
    seconds: (n) => `${n} ${enPlural(n, "second", "seconds")}`,
    metres: (n) => `${n} ${enPlural(n, "metre", "metres")}`,
    km: (n) => `${fmt(n, ".")} ${enPlural(n, "kilometre", "kilometres")}`,
    miles: (n) => `${fmt(n, ".")} ${enPlural(n, "mile", "miles")}`,
  },
};

/** One decimal at most, the integer part only when whole. */
function fmt(value: number, decimal: string): string {
  return Number.isInteger(value)
    ? String(value)
    : value.toFixed(1).replace(".", decimal);
}

const STEP_NAMES: Record<
  VoiceLanguage,
  Record<ExecutionStep["kind"], string>
> = {
  ru: {
    warmup: "Разминка",
    work: "Рабочий отрезок",
    recovery: "Восстановление",
    steady: "Основная часть",
    cooldown: "Заминка",
  },
  en: {
    warmup: "Warm-up",
    work: "Work interval",
    recovery: "Recovery",
    steady: "Main set",
    cooldown: "Cool-down",
  },
};

const TEXT = {
  ru: {
    started: "Тренировка началась.",
    time: "Время",
    avgPace: "Средний темп",
    segmentPace: "Темп отрезка",
    perKm: "на километр",
    perMile: "на милю",
    repetition: (index: number, total: number) => `повтор ${index} из ${total}`,
    pace: "Целевой темп",
    remaining: "Осталось",
    next: "Дальше",
    fast: "Быстрее плана. Сбавьте до",
    slow: "Медленнее плана. Прибавьте до",
    paused: "Пауза.",
    resumed: "Продолжаем.",
    autoPaused: "Автопауза.",
    planDone: "План тренировки выполнен. Можно завершать.",
    gpsLost: "Сигнал GPS потерян, считаем по шагам.",
    gpsBack: "GPS снова работает.",
    finished: "Тренировка завершена.",
    in: "за",
  },
  en: {
    started: "Workout started.",
    time: "Time",
    avgPace: "Average pace",
    segmentPace: "Split pace",
    perKm: "per kilometre",
    perMile: "per mile",
    repetition: (index: number, total: number) => `repeat ${index} of ${total}`,
    pace: "Target pace",
    remaining: "Remaining",
    next: "Next",
    fast: "Faster than planned. Ease off to",
    slow: "Slower than planned. Pick it up to",
    paused: "Paused.",
    resumed: "Resuming.",
    autoPaused: "Auto-paused.",
    planDone: "Planned workout complete. You can finish now.",
    gpsLost: "GPS signal lost, counting steps.",
    gpsBack: "GPS is back.",
    finished: "Workout finished.",
    in: "in",
  },
} as const;

export function speakDuration(
  totalSec: number,
  language: VoiceLanguage,
): string {
  const w = WORDS[language];
  const sec = Math.max(0, Math.round(totalSec));
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(w.hours(hours));
  if (minutes > 0) parts.push(w.minutes(minutes));
  // Seconds are noise in a report over an hour.
  if (seconds > 0 && hours === 0) parts.push(w.seconds(seconds));
  return parts.length > 0 ? parts.join(" ") : w.seconds(0);
}

/** "5 минут 12 секунд на километр"; per mile for imperial units. */
export function speakPace(
  secPerKm: number,
  language: VoiceLanguage,
  units: VoiceUnits,
): string {
  const t = TEXT[language];
  const perUnit =
    units === "imperial" ? secPerKm * (METRES_PER_MILE / 1000) : secPerKm;
  return `${speakDuration(perUnit, language)} ${units === "imperial" ? t.perMile : t.perKm}`;
}

/** Distance in the user's units, to a tenth: "3 километра", "2,4 мили". */
export function speakDistance(
  metres: number,
  language: VoiceLanguage,
  units: VoiceUnits,
): string {
  const w = WORDS[language];
  if (units === "imperial")
    return w.miles(Math.floor((metres / METRES_PER_MILE) * 10) / 10);
  return w.km(Math.floor(metres / 100) / 10);
}

/** Size of a plan step: "10 минут", "400 метров", "2 километра". */
function speakStepSize(
  step: ExecutionStep,
  language: VoiceLanguage,
): string | null {
  const w = WORDS[language];
  if (step.durationSec !== null)
    return speakDuration(step.durationSec, language);
  if (step.distanceM !== null) {
    return step.distanceM >= 1000 && step.distanceM % 100 === 0
      ? w.km(step.distanceM / 1000)
      : w.metres(Math.round(step.distanceM));
  }
  return null;
}

function speakStep(
  step: ExecutionStep,
  language: VoiceLanguage,
  units: VoiceUnits,
): string {
  const t = TEXT[language];
  // Recoveries between repeats carry a counter too; only the work is counted aloud.
  const head =
    step.repetition && step.kind === "work"
      ? `${STEP_NAMES[language][step.kind]}, ${t.repetition(step.repetition.index, step.repetition.total)}.`
      : `${STEP_NAMES[language][step.kind]}.`;
  const size = speakStepSize(step, language);
  const target = step.targetPace
    ? `${t.pace} ${speakPace((step.targetPace.minSecPerKm + step.targetPace.maxSecPerKm) / 2, language, units)}.`
    : null;
  return [head, size ? `${capitalize(size)}.` : null, target]
    .filter(Boolean)
    .join(" ");
}

const capitalize = (text: string): string =>
  text.charAt(0).toUpperCase() + text.slice(1);

/** The sentence for a cue, ready for the speech engine. */
/** Text of a cue; an empty string when the report has nothing left to say. */
export function renderCue(
  cue: Cue,
  language: VoiceLanguage,
  units: VoiceUnits,
  report?: VoiceReport,
): string {
  const t = TEXT[language];
  switch (cue.type) {
    case "started":
      return t.started;
    case "interval": {
      const parts: string[] = [];
      if (!report || report.distance)
        parts.push(
          `${capitalize(speakDistance(cue.distanceM, language, units))}.`,
        );
      if (!report || report.time)
        parts.push(
          `${t.time} ${speakDuration(cue.movingMs / 1000, language)}.`,
        );
      if (cue.segmentPaceSecPerKm !== null && (!report || report.splitPace))
        parts.push(
          `${t.segmentPace} ${speakPace(cue.segmentPaceSecPerKm, language, units)}.`,
        );
      if (cue.avgPaceSecPerKm !== null && (!report || report.avgPace))
        parts.push(
          `${t.avgPace} ${speakPace(cue.avgPaceSecPerKm, language, units)}.`,
        );
      return parts.join(" ");
    }
    case "step":
      return speakStep(cue.step, language, units);
    case "stepEnding": {
      const left =
        cue.remainingSec !== null
          ? speakDuration(cue.remainingSec, language)
          : WORDS[language].metres(cue.remainingM ?? 0);
      const next = cue.next
        ? ` ${t.next}: ${STEP_NAMES[language][cue.next.kind].toLowerCase()}.`
        : "";
      return `${t.remaining} ${left}.${next}`;
    }
    case "pace":
      return `${cue.status === "fast" ? t.fast : t.slow} ${speakPace(cue.targetSecPerKm, language, units)}.`;
    case "paused":
      return t.paused;
    case "resumed":
      return t.resumed;
    case "autoPaused":
      return t.autoPaused;
    case "planDone":
      return t.planDone;
    case "gpsLost":
      return t.gpsLost;
    case "gpsBack":
      return t.gpsBack;
    case "finished": {
      const parts = [
        t.finished,
        `${capitalize(speakDistance(cue.distanceM, language, units))} ${t.in} ${speakDuration(cue.movingMs / 1000, language)}.`,
      ];
      if (cue.avgPaceSecPerKm !== null)
        parts.push(
          `${t.avgPace} ${speakPace(cue.avgPaceSecPerKm, language, units)}.`,
        );
      return parts.join(" ");
    }
  }
}
