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
    const totalPaid = payments
      .filter((p) => p.paidAt.getTime() >= bucket.bucketStart.getTime() && p.paidAt.getTime() <= endOfUTCDay(bucket.bucketEnd).getTime())
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
    const activeTenantIds = new Set(
      tenancies
        .filter(
          (t) =>
            t.startDate.getTime() <= endOfUTCDay(bucket.bucketEnd).getTime() &&
            (t.endDate === null || t.endDate.getTime() >= bucket.bucketStart.getTime())
        )
        .map((t) => t.tenantId)
    );
    return { label: bucket.label, activeTenantCount: activeTenantIds.size };
  });
}

export type BuildingOccupancy = { id: string; name: string; occupiedCapacity: number; totalCapacity: number };
export type OverdueSummary = { count: number; totalOwed: number };

export async function getOccupancyByBuilding(
  scoped: ReturnType<typeof createScopedClient>
): Promise<BuildingOccupancy[]> {
  const buildings = await scoped.building.findMany({
    orderBy: { name: "asc" },
    include: { floors: { include: { rooms: true } } },
  });
  if (buildings.length === 0) return [];

  const roomIds = buildings.flatMap((b) => b.floors.flatMap((f) => f.rooms.map((r) => r.id)));
  const occupancyCounts = roomIds.length
    ? await scoped.tenancy.groupBy({
        by: ["roomId"],
        where: { roomId: { in: roomIds }, status: "ACTIVE" },
        _count: { _all: true },
      })
    : [];
  const occupiedByRoomId = new Map(occupancyCounts.map((row) => [row.roomId, row._count._all]));

  return buildings.map((building) => {
    const rooms = building.floors.flatMap((f) => f.rooms);
    const totalCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
    const occupiedCapacity = rooms.reduce((sum, r) => sum + (occupiedByRoomId.get(r.id) ?? 0), 0);
    return { id: building.id, name: building.name, occupiedCapacity, totalCapacity };
  });
}

export async function getOverdueSummary(
  scoped: ReturnType<typeof createScopedClient>
): Promise<OverdueSummary> {
  const invoices = await scoped.invoice.findMany({
    where: { status: "OVERDUE" },
    include: { payments: true },
  });

  const totalOwed = invoices.reduce((sum, invoice) => {
    const totalPaid = invoice.payments.reduce((paidSum, p) => paidSum + Number(p.amountPaid), 0);
    return sum + (Number(invoice.amountDue) - totalPaid);
  }, 0);

  return { count: invoices.length, totalOwed };
}
