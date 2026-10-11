import type { DeviceProvider } from "@workspace/api-client";

import { type ThemeMode } from "@workspace/tokens";

import { IntegrationLogo } from "../../../shared/ui/integration-logo";

/** Apple Health / Health Connect official icon; see `IntegrationLogo` for the usage rules. */
export function HealthLogo({
  provider,
  themeMode,
  size = 32,
}: {
  provider: DeviceProvider;
  themeMode: ThemeMode;
  size?: number;
}) {
  return (
    <IntegrationLogo provider={provider} themeMode={themeMode} size={size} />
  );
}
