import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cache } from 'cache-manager';

import { ANALYTICS_CACHE_PREFIX, ANALYTICS_CACHE_TTL_MS } from '../analytics.constants';
import { AnalyticsChangesService } from './analytics-changes.service';

/**
 * Dashboard blocks are expensive, so each is cached per filter set and data
 * version: a change of the data bumps the version, so blocks are recomputed
 * after a change and served from cache otherwise. A failing cache never fails
 * the request.
 */
@Injectable()
export class AnalyticsCacheService {
  private readonly logger = new Logger(AnalyticsCacheService.name);

  constructor(
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    private readonly changes: AnalyticsChangesService,
  ) {}

  async wrap<T extends object>(
    block: string,
    params: Record<string, unknown>,
    options: { refresh?: boolean; ttlMs?: number },
    compute: () => Promise<T>,
  ): Promise<T & { generatedAt: string }> {
    const version = await this.changes.version();
    const key = `${ANALYTICS_CACHE_PREFIX}${block}:v${version}:${JSON.stringify(params)}`;
    if (!options.refresh) {
      const cached = await this.cache.get<T & { generatedAt: string }>(key).catch(() => undefined);
      if (cached) return cached;
    }
    const value = { ...(await compute()), generatedAt: new Date().toISOString() };
    await this.cache.set(key, value, options.ttlMs ?? ANALYTICS_CACHE_TTL_MS).catch((error: Error) => {
      this.logger.warn(`Cannot cache analytics block ${block}: ${error.message}`);
    });
    return value;
  }
}
