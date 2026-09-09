export type DateRange = { from: Date; to: Date };
export type MonthBucket = { label: string; bucketStart: Date; bucketEnd: Date };

export const DATE_RANGE_PRESETS = ["6m", "12m", "ytd", "custom"] as const;

function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function monthsBeforeMonthStart(date: Date, monthsBack: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsBack, 1));
}

function parseUTCDate(value: string | undefined): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

export function resolveDateRange(
  preset: string | undefined,
  from: string | undefined,
  to: string | undefined,
  today: Date
): DateRange {
  const end = startOfUTCDay(today);
  const defaultRange: DateRange = { from: monthsBeforeMonthStart(end, 5), to: end };

  if (preset === "custom") {
    const parsedFrom = parseUTCDate(from);
    const parsedTo = parseUTCDate(to);
    if (parsedFrom && parsedTo && parsedFrom.getTime() <= parsedTo.getTime()) {
      return { from: parsedFrom, to: parsedTo };
    }
    return defaultRange;
  }

  if (preset === "12m") {
    return { from: monthsBeforeMonthStart(end, 11), to: end };
  }

  if (preset === "ytd") {
    return { from: new Date(Date.UTC(end.getUTCFullYear(), 0, 1)), to: end };
  }

  return defaultRange;
}

export function buildMonthBuckets(range: DateRange): MonthBucket[] {
  const buckets: MonthBucket[] = [];
  let year = range.from.getUTCFullYear();
  let month = range.from.getUTCMonth();
  const toYear = range.to.getUTCFullYear();
  const toMonth = range.to.getUTCMonth();

  let isFirstBucket = true;
  while (year < toYear || (year === toYear && month <= toMonth)) {
    const isLastBucket = year === toYear && month === toMonth;
    const monthStart = Date.UTC(year, month, 1);
    const bucketStart = isFirstBucket ? new Date(Math.max(monthStart, range.from.getTime())) : new Date(monthStart);
    const monthEnd = new Date(Date.UTC(year, month + 1, 0));
    const bucketEnd = isLastBucket && range.to.getTime() < monthEnd.getTime() ? range.to : monthEnd;
    const label = `${year}-${String(month + 1).padStart(2, "0")}`;
    buckets.push({ label, bucketStart, bucketEnd });
    isFirstBucket = false;

    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  return buckets;
}
