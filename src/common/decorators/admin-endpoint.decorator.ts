import { SetMetadata } from '@nestjs/common';

export const ADMIN_ENDPOINT_KEY = 'activity:adminEndpoint';

/**
 * Marks an admin-panel controller or handler: actions performed through it are
 * attributed to the administrator in the activity history of the affected user.
 */
export const AdminEndpoint = (): ReturnType<typeof SetMetadata> => SetMetadata(ADMIN_ENDPOINT_KEY, true);
