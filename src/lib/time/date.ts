export function toUtcDateOnly(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate()));
}

export function addUtcDays(input: Date, days: number): Date {
  const next = new Date(input);
  next.setUTCDate(next.getUTCDate() + days);
  return toUtcDateOnly(next);
}

export function dateRangeUtcInclusive(from: Date, to: Date): Date[] {
  const result: Date[] = [];
  let cursor = toUtcDateOnly(from);
  const end = toUtcDateOnly(to);
  while (cursor <= end) {
    result.push(cursor);
    cursor = addUtcDays(cursor, 1);
  }
  return result;
}

export function startOfYearUtc(input: Date): Date {
  return new Date(Date.UTC(input.getUTCFullYear(), 0, 1));
}

