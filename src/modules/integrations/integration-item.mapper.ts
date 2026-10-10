import { DEVICE_PROVIDERS, INTEGRATION_STATUSES, STRAVA_PROFILE_SCOPE } from './constants/integrations.constants';
import { IntegrationItemResponseDto } from './dto/integration-response.dto';
import { Integration } from './entities/integration.entity';

export interface IntegrationItemExtras {
  importedActivitiesCount: number;
  pendingBatches: number;
  available: boolean;
}

function isDeviceProvider(provider: string): boolean {
  return (DEVICE_PROVIDERS as readonly string[]).includes(provider);
}

/** API view of one provider; `integration` is null when the user never connected it. */
export function toIntegrationItem(
  provider: string,
  integration: Integration | null,
  extras: IntegrationItemExtras,
): IntegrationItemResponseDto {
  const device = isDeviceProvider(provider);
  const scopes = Array.isArray(integration?.scopes) ? integration.scopes : [];
  const profileAccess = device
    ? ['weight', 'height', 'resting_heart_rate'].some((scope) => scopes.includes(scope))
    : scopes.includes(STRAVA_PROFILE_SCOPE);

  return {
    provider,
    status: integration?.status ?? INTEGRATION_STATUSES.DISCONNECTED,
    connectedAt: integration?.connectedAt ? integration.connectedAt.toISOString() : null,
    lastSyncedAt: integration?.lastSyncAt ? integration.lastSyncAt.toISOString() : null,
    externalUserId: integration?.externalUserId ?? null,
    importedActivitiesCount: extras.importedActivitiesCount,
    profileAccess: integration ? profileAccess : false,
    lastProfileSyncAt: integration?.lastProfileSyncAt ? integration.lastProfileSyncAt.toISOString() : null,
    available: extras.available,
    profileSync: device ? integration?.metadata?.profileSync !== false : null,
    pendingBatches: extras.pendingBatches,
    scopes,
  };
}
