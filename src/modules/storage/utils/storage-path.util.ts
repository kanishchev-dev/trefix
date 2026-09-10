import { randomUUID } from 'crypto';
import * as path from 'path';

import { STORAGE_DEFAULT_FOLDER } from '../storage.constants';

function normalizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function normalizeExtension(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase();
  return ext;
}

export function buildStorageKey(params: {
  originalName: string;
  scopeType?: string | null;
  scopeId?: string | null;
  folder?: string | null;
}): string {
  const scopeType = params.scopeType ? normalizeSegment(params.scopeType) : '';
  const scopeId = params.scopeId ? normalizeSegment(params.scopeId) : '';
  const folder = params.folder ? normalizeSegment(params.folder) : STORAGE_DEFAULT_FOLDER;
  const extension = normalizeExtension(params.originalName);
  const objectId = randomUUID();

  const segments = [scopeType, scopeId, folder].filter(Boolean);

  return [...segments, `${objectId}${extension}`].join('/');
}

export function createContentDisposition(fileName: string): string {
  const escaped = fileName.replace(/"/g, '\\"');
  const encoded = encodeURIComponent(fileName);

  return `attachment; filename="${escaped}"; filename*=UTF-8''${encoded}`;
}
