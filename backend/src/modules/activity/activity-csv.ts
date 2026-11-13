import type { ActivityItemDto } from './dto/activity-response.dto';

const COLUMNS = [
  'occurredAt',
  'actorType',
  'actorName',
  'action',
  'domain',
  'subjectName',
  'entityType',
  'entityId',
  'source',
  'changes',
  'metadata',
] as const;

/** RFC 4180 quoting; values starting with a formula character are prefixed so spreadsheets do not evaluate them. */
function cell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function activityCsvHeader(): string {
  return `${COLUMNS.join(',')}\r\n`;
}

export function activityCsvRows(items: readonly ActivityItemDto[]): string {
  return items
    .map((item) =>
      [
        item.occurredAt,
        item.actor.type,
        item.actor.name,
        item.action,
        item.domain,
        item.subject?.name ?? null,
        item.entity?.type ?? null,
        item.entity?.id ?? null,
        item.source,
        item.changes,
        Object.keys(item.metadata).length > 0 ? item.metadata : null,
      ]
        .map(cell)
        .join(','),
    )
    .map((line) => `${line}\r\n`)
    .join('');
}
