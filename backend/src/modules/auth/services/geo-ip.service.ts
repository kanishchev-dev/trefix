import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type CityResponse, open, type Reader } from 'maxmind';

export interface GeoLocation {
  city: string | null;
  /** ISO 3166-1 alpha-2. */
  country: string | null;
}

const EMPTY: GeoLocation = { city: null, country: null };

/**
 * City and country of an IP from a local MaxMind database. Optional: without
 * `GEOIP_CITY_DB_PATH` every lookup is empty and sessions simply show no city.
 */
@Injectable()
export class GeoIpService implements OnModuleInit {
  private readonly logger = new Logger(GeoIpService.name);
  private reader: Reader<CityResponse> | null = null;

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    const path = this.configService.get<string | null>('app.geoipCityDbPath');
    if (!path) {
      return;
    }
    try {
      this.reader = await open<CityResponse>(path);
    } catch (error) {
      this.logger.warn(`GeoIP database is not available at ${path}: ${(error as Error).message}`);
    }
  }

  /** Names are in English: the database has no full Russian coverage and clients show them as is. */
  lookup(ipAddress: string | null | undefined): GeoLocation {
    if (!this.reader || !ipAddress) {
      return EMPTY;
    }
    try {
      const result = this.reader.get(ipAddress.replace(/^::ffff:/, ''));
      return {
        city: result?.city?.names?.en ?? null,
        country: result?.country?.iso_code ?? null,
      };
    } catch {
      return EMPTY;
    }
  }
}
