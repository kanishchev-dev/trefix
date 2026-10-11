import { logger } from "./logger";

/**
 * Thin analytics adapter. Product events go through `trackEvent` so a real
 * provider can be plugged in at one place; until then events are only logged
 * in development builds.
 */
export type AnalyticsProps = Record<
  string,
  string | number | boolean | null | undefined
>;

type AnalyticsSink = (event: string, props: AnalyticsProps) => void;

let sink: AnalyticsSink | null = null;

export function setAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next;
}

export function trackEvent(event: string, props: AnalyticsProps = {}): void {
  if (sink) {
    sink(event, props);
    return;
  }
  if (__DEV__) {
    logger.debug(`[analytics] ${event}`, props);
  }
}
