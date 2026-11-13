import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac } from 'crypto';
import { IncomingMessage, request as httpRequest } from 'http';
import { request as httpsRequest } from 'https';
import { Readable } from 'stream';
import { URL } from 'url';

import { StorageFileOperationException } from '../exceptions/storage-file-operation.exception';
import {
  StorageAdapter,
  StorageDownloadResult,
  StorageObjectMetadata,
  StorageUploadInput,
} from '../interfaces/storage-adapter.interface';

interface SignedRequestOptions {
  method: 'PUT' | 'GET' | 'HEAD' | 'DELETE';
  key: string;
  headers?: Record<string, string>;
  body?: Readable;
}

@Injectable()
export class S3StorageAdapter implements StorageAdapter {
  private readonly logger = new Logger(S3StorageAdapter.name);
  private readonly endpoint: URL;
  private readonly region: string;
  private readonly bucket: string;
  private readonly accessKey: string;
  private readonly secretKey: string;
  private readonly forcePathStyle: boolean;

  constructor(private readonly configService: ConfigService) {
    const endpointValue = this.configService.get<string>('storage.endpoint');
    const region = this.configService.get<string>('storage.region');
    const bucket = this.configService.get<string>('storage.bucket');
    const accessKey = this.configService.get<string>('storage.accessKey');
    const secretKey = this.configService.get<string>('storage.secretKey');

    if (!endpointValue || !region || !bucket || !accessKey || !secretKey) {
      throw new StorageFileOperationException('Storage provider is not configured correctly');
    }

    this.endpoint = new URL(endpointValue);
    this.region = region;
    this.bucket = bucket;
    this.accessKey = accessKey;
    this.secretKey = secretKey;
    this.forcePathStyle = this.configService.get<boolean>('storage.forcePathStyle') ?? true;
  }

  async upload(input: StorageUploadInput): Promise<StorageObjectMetadata> {
    const result = await this.sendRequest({
      method: 'PUT',
      key: input.key,
      headers: {
        'content-type': input.contentType,
        ...(typeof input.contentLength === 'number' ? { 'content-length': String(input.contentLength) } : {}),
      },
      body: input.body,
    });

    return result;
  }

  async download(key: string): Promise<StorageDownloadResult> {
    const response = await this.sendRequestRaw({
      method: 'GET',
      key,
    });

    return {
      stream: response.body,
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length'] ? Number(response.headers['content-length']) : undefined,
      etag: response.headers.etag,
      lastModified: response.headers['last-modified'] ? new Date(response.headers['last-modified']) : undefined,
    };
  }

  async delete(key: string): Promise<void> {
    await this.sendRequestRaw({
      method: 'DELETE',
      key,
    });
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.head(key);
      return true;
    } catch {
      return false;
    }
  }

  async head(key: string): Promise<StorageObjectMetadata> {
    const response = await this.sendRequestRaw({
      method: 'HEAD',
      key,
    });

    return {
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length'] ? Number(response.headers['content-length']) : undefined,
      etag: response.headers.etag,
      lastModified: response.headers['last-modified'] ? new Date(response.headers['last-modified']) : undefined,
    };
  }

  private async sendRequest(options: SignedRequestOptions): Promise<StorageObjectMetadata> {
    const response = await this.sendRequestRaw(options);

    return {
      contentType: response.headers['content-type'],
      contentLength: response.headers['content-length'] ? Number(response.headers['content-length']) : undefined,
      etag: response.headers.etag,
      lastModified: response.headers['last-modified'] ? new Date(response.headers['last-modified']) : undefined,
    };
  }

  private async sendRequestRaw(options: SignedRequestOptions): Promise<{
    headers: Record<string, string>;
    body: Readable;
  }> {
    const requestOptions = this.buildRequestOptions(options);
    const requestFn = this.endpoint.protocol === 'http:' ? httpRequest : httpsRequest;

    return new Promise((resolve, reject) => {
      const req = requestFn(requestOptions, (res: IncomingMessage) => {
        const statusCode = res.statusCode ?? 500;

        if (statusCode >= 200 && statusCode < 300) {
          resolve({
            headers: this.normalizeHeaders(res.headers),
            body: res,
          });
          return;
        }

        const error = new Error(`S3 request failed with status ${statusCode}`);
        this.logger.warn(error.message);
        res.resume();
        reject(error);
      });

      req.on('error', reject);

      if (options.body) {
        options.body.on('error', reject);
        options.body.pipe(req);
        return;
      }

      req.end();
    });
  }

  private buildRequestOptions(options: SignedRequestOptions): {
    method: SignedRequestOptions['method'];
    hostname: string;
    port: number;
    path: string;
    headers: Record<string, string>;
  } {
    const now = new Date();
    const amzDate = this.formatAmzDate(now);
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = options.method === 'PUT' ? 'UNSIGNED-PAYLOAD' : createHash('sha256').update('').digest('hex');
    const canonicalUri = this.buildCanonicalUri(options.key);
    const host = this.getHostHeader();

    const headers: Record<string, string> = {
      host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...(options.headers ?? {}),
    };

    const signedHeaderNames = Object.keys(headers)
      .map((headerName) => headerName.toLowerCase())
      .sort();

    const canonicalHeaders = signedHeaderNames
      .map((headerName) => `${headerName}:${this.normalizeHeaderValue(headers[headerName] ?? '')}`)
      .join('\n');

    const canonicalRequest = [
      options.method,
      canonicalUri,
      '',
      `${canonicalHeaders}\n`,
      signedHeaderNames.join(';'),
      payloadHash,
    ].join('\n');

    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const signingKey = this.getSigningKey(dateStamp);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    return {
      method: options.method,
      hostname: this.getRequestHostname(),
      port: this.endpoint.port ? Number(this.endpoint.port) : this.endpoint.protocol === 'http:' ? 80 : 443,
      path: this.buildRequestPath(options.key),
      headers: {
        ...headers,
        authorization: `AWS4-HMAC-SHA256 Credential=${this.accessKey}/${credentialScope}, SignedHeaders=${signedHeaderNames.join(';')}, Signature=${signature}`,
      },
    };
  }

  private getHostHeader(): string {
    const hostname = this.forcePathStyle ? this.getHostname() : `${this.bucket}.${this.getHostname()}`;
    return this.endpoint.port ? `${hostname}:${this.endpoint.port}` : hostname;
  }

  private getRequestHostname(): string {
    return this.forcePathStyle ? this.getHostname() : `${this.bucket}.${this.getHostname()}`;
  }

  private getHostname(): string {
    return this.endpoint.hostname;
  }

  private buildRequestPath(key: string): string {
    const encodedKey = key
      .split('/')
      .map((segment) => encodeURIComponent(segment))
      .join('/');

    return this.forcePathStyle ? `/${this.bucket}/${encodedKey}` : `/${encodedKey}`;
  }

  private buildCanonicalUri(key: string): string {
    return this.buildRequestPath(key);
  }

  private getSigningKey(dateStamp: string): Buffer {
    const kDate = createHmac('sha256', `AWS4${this.secretKey}`).update(dateStamp).digest();
    const kRegion = createHmac('sha256', kDate).update(this.region).digest();
    const kService = createHmac('sha256', kRegion).update('s3').digest();

    return createHmac('sha256', kService).update('aws4_request').digest();
  }

  private formatAmzDate(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');

    return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
  }

  private normalizeHeaders(headers: IncomingMessage['headers']): Record<string, string> {
    return Object.entries(headers).reduce<Record<string, string>>((accumulator, [key, value]) => {
      if (typeof value === 'string') {
        accumulator[key.toLowerCase()] = value;
      } else if (Array.isArray(value)) {
        accumulator[key.toLowerCase()] = value.join(', ');
      }
      return accumulator;
    }, {});
  }

  private normalizeHeaderValue(value: string): string {
    return value.replace(/\s+/g, ' ').trim();
  }
}
