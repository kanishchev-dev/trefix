import { HttpStatus } from '@nestjs/common';

import { DomainException } from '@/common/exceptions/domain.exception';

/**
 * A call to an external provider API failed.
 *
 * `providerStatus` is kept for logs and retry decisions; it is not the HTTP
 * status of our response, which is always 502 — the failure is upstream.
 */
export class IntegrationProviderRequestFailedException extends DomainException {
  constructor(
    public readonly provider: string,
    public readonly operation: string,
    public readonly providerStatus: number,
  ) {
    super(
      'INTEGRATION_PROVIDER_REQUEST_FAILED',
      `${provider} ${operation} failed with status ${providerStatus}`,
      HttpStatus.BAD_GATEWAY,
      { provider, providerStatus },
    );
  }
}
