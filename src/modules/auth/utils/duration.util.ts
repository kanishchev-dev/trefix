import { InvariantViolationException } from '@/common/exceptions/invariant-violation.exception';

export function parseDurationToMilliseconds(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }

  const trimmedValue = value.trim();
  if (/^\d+$/.test(trimmedValue)) {
    return Number(trimmedValue);
  }

  const match = trimmedValue.match(/^(\d+)(ms|s|m|h|d|w)$/i);
  if (!match) {
    throw new InvariantViolationException(`Unsupported duration format: ${value}`);
  }

  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multipliers: Record<string, number> = {
    ms: 1,
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };

  return amount * multipliers[unit];
}

export function parseDurationToSeconds(value: string | number): number {
  return Math.max(1, Math.ceil(parseDurationToMilliseconds(value) / 1000));
}
