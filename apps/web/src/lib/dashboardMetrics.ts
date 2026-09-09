import type { createScopedClient } from "@mytenants/db";
import type { DateRange, MonthBucket } from "./dateRange";

export type IncomeTrendPoint = { label: string; totalPaid: number };
export type TenantCountPoint = { label: string; activeTenantCount: number };

function endOfUTCDay(date: Date): Date {
  return new Date(date.getTime() + 24 * 60 * 60 * 1000 - 1);
}

export async function getIncomeTrend(
  scoped: ReturnType<typeof createScopedClient>,
  range: DateRange,
  buckets: MonthBucket[]
): Promise<IncomeTrendPoint[]> {
  const payments = await scoped.payment.findMany({
    where: { paidAt: { gte: range.from, lte: endOfUTCDay(range.to) } },
    select: { amountPaid: true, paidAt: true },
  });

  return buckets.map((bucket) => {
    const bucketStart = new Date(Date.UTC(bucket.bucketEnd.getUTCFullYear(), bucket.bucketEnd.getUTCMonth(), 1));
    const totalPaid = payments
      .filter((p) => p.paidAt.getTime() >= bucketStart.getTime() && p.paidAt.getTime() <= endOfUTCDay(bucket.bucketEnd).getTime())
      .reduce((sum, p) => sum + Number(p.amountPaid), 0);
    return { label: bucket.label, totalPaid };
  });
}

export async function getTenantCountTrend(
  scoped: ReturnType<typeof createScopedClient>,
  buckets: MonthBucket[]
): Promise<TenantCountPoint[]> {
  const tenancies = await scoped.tenancy.findMany({
    select: { tenantId: true, startDate: true, endDate: true },
  });

  return buckets.map((bucket) => {
    const bucketStart = new Date(Date.UTC(bucket.bucketEnd.getUTCFullYear(), bucket.bucketEnd.getUTCMonth(), 1));
    const activeTenantIds = new Set(
      tenancies
        .filter(
          (t) =>
            t.startDate.getTime() <= endOfUTCDay(bucket.bucketEnd).getTime() &&
            (t.endDate === null || t.endDate.getTime() >= bucketStart.getTime())
        )
        .map((t) => t.tenantId)
    );
    return { label: bucket.label, activeTenantCount: activeTenantIds.size };
  });
}
