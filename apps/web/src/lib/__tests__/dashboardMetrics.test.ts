import { describe, it, expect, afterAll } from "vitest";
import { prisma, createScopedClient } from "@mytenants/db";
import { buildMonthBuckets } from "../dateRange";
import { getIncomeTrend, getTenantCountTrend } from "../dashboardMetrics";

async function makeUser(organizationId: string) {
  return prisma.user.create({
    data: { organizationId, email: `u-${Math.random()}@example.com`, passwordHash: "x", name: "U" },
  });
}

async function makeTenancy(organizationId: string, options: { startDate: string; endDate?: string }) {
  const building = await prisma.building.create({ data: { organizationId, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({
    data: { organizationId, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
  });
  const tenant = await prisma.tenant.create({
    data: { organizationId, firstName: "A", lastName: "Tenant", status: "ACTIVE" },
  });
  const tenancy = await prisma.tenancy.create({
    data: {
      organizationId,
      tenantId: tenant.id,
      roomId: room.id,
      startDate: new Date(options.startDate),
      endDate: options.endDate ? new Date(options.endDate) : null,
      monthlyRate: "3000.00",
      depositAmount: "3000.00",
      status: options.endDate ? "ENDED" : "ACTIVE",
    },
  });
  return { tenant, tenancy, room };
}

describe("getIncomeTrend", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sums payments per month within the range, excluding payments outside it", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Income ${Math.random()}` } });
    const { tenancy } = await makeTenancy(org.id, { startDate: "2026-01-01" });
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenancyId: tenancy.id,
        periodStart: new Date("2026-04-01"),
        periodEnd: new Date("2026-04-30"),
        amountDue: "3000.00",
        dueDate: new Date("2026-04-01"),
        status: "PAID",
      },
    });
    const user = await makeUser(org.id);
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: invoice.id, amountPaid: "1000.00", method: "CASH", paidAt: new Date("2026-04-10"), recordedByUserId: user.id },
    });
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: invoice.id, amountPaid: "2000.00", method: "CASH", paidAt: new Date("2026-05-05"), recordedByUserId: user.id },
    });
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: invoice.id, amountPaid: "500.00", method: "CASH", paidAt: new Date("2026-01-01"), recordedByUserId: user.id },
    });

    const scoped = createScopedClient(org.id);
    const range = { from: new Date("2026-04-01"), to: new Date("2026-05-31") };
    const buckets = buildMonthBuckets(range);

    const trend = await getIncomeTrend(scoped, range, buckets);

    expect(trend).toEqual([
      { label: "2026-04", totalPaid: 1000 },
      { label: "2026-05", totalPaid: 2000 },
    ]);
  });

  it("returns zero for a month with no payments", async () => {
    const org = await prisma.organization.create({ data: { name: `Org No Income ${Math.random()}` } });
    const scoped = createScopedClient(org.id);
    const range = { from: new Date("2026-04-01"), to: new Date("2026-04-30") };
    const buckets = buildMonthBuckets(range);

    const trend = await getIncomeTrend(scoped, range, buckets);

    expect(trend).toEqual([{ label: "2026-04", totalPaid: 0 }]);
  });

  it("includes a payment recorded at non-midnight time on the last day of a bucket", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Last Day ${Math.random()}` } });
    const { tenancy } = await makeTenancy(org.id, { startDate: "2026-01-01" });
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenancyId: tenancy.id,
        periodStart: new Date("2026-04-01"),
        periodEnd: new Date("2026-04-30"),
        amountDue: "3000.00",
        dueDate: new Date("2026-04-01"),
        status: "PAID",
      },
    });
    const user = await makeUser(org.id);
    // Payment at 3:30 PM on April 30 (last day of the month)
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: invoice.id, amountPaid: "1500.00", method: "CASH", paidAt: new Date("2026-04-30T15:30:00.000Z"), recordedByUserId: user.id },
    });

    const scoped = createScopedClient(org.id);
    const range = { from: new Date("2026-04-01"), to: new Date("2026-04-30") };
    const buckets = buildMonthBuckets(range);

    const trend = await getIncomeTrend(scoped, range, buckets);

    expect(trend).toEqual([{ label: "2026-04", totalPaid: 1500 }]);
  });

  it("includes payments on today (final partial bucket) at non-midnight times", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Today ${Math.random()}` } });
    const { tenancy } = await makeTenancy(org.id, { startDate: "2026-01-01" });
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenancyId: tenancy.id,
        periodStart: new Date("2026-05-01"),
        periodEnd: new Date("2026-05-31"),
        amountDue: "3000.00",
        dueDate: new Date("2026-05-01"),
        status: "PAID",
      },
    });
    const user = await makeUser(org.id);
    // Payments at various times on today (2026-05-09)
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: invoice.id, amountPaid: "800.00", method: "CASH", paidAt: new Date("2026-05-09T10:15:00.000Z"), recordedByUserId: user.id },
    });
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: invoice.id, amountPaid: "700.00", method: "CASH", paidAt: new Date("2026-05-09T18:45:30.000Z"), recordedByUserId: user.id },
    });

    const scoped = createScopedClient(org.id);
    // Range ending on today (2026-05-09)
    const range = { from: new Date("2026-05-01"), to: new Date("2026-05-09") };
    const buckets = buildMonthBuckets(range);

    const trend = await getIncomeTrend(scoped, range, buckets);

    expect(trend).toEqual([{ label: "2026-05", totalPaid: 1500 }]);
  });
});

describe("getTenantCountTrend", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("counts a tenant active for the whole range in every bucket", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Count Whole ${Math.random()}` } });
    await makeTenancy(org.id, { startDate: "2026-01-01" });
    const scoped = createScopedClient(org.id);
    const buckets = buildMonthBuckets({ from: new Date("2026-04-01"), to: new Date("2026-06-30") });

    const trend = await getTenantCountTrend(scoped, buckets);

    expect(trend).toEqual([
      { label: "2026-04", activeTenantCount: 1 },
      { label: "2026-05", activeTenantCount: 1 },
      { label: "2026-06", activeTenantCount: 1 },
    ]);
  });

  it("excludes a tenant from buckets after their tenancy ended", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Count Ended ${Math.random()}` } });
    await makeTenancy(org.id, { startDate: "2026-01-01", endDate: "2026-05-15" });
    const scoped = createScopedClient(org.id);
    const buckets = buildMonthBuckets({ from: new Date("2026-04-01"), to: new Date("2026-06-30") });

    const trend = await getTenantCountTrend(scoped, buckets);

    expect(trend).toEqual([
      { label: "2026-04", activeTenantCount: 1 },
      { label: "2026-05", activeTenantCount: 1 },
      { label: "2026-06", activeTenantCount: 0 },
    ]);
  });

  it("excludes a tenant from buckets before their tenancy started", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Count Started Late ${Math.random()}` } });
    await makeTenancy(org.id, { startDate: "2026-05-20" });
    const scoped = createScopedClient(org.id);
    const buckets = buildMonthBuckets({ from: new Date("2026-04-01"), to: new Date("2026-06-30") });

    const trend = await getTenantCountTrend(scoped, buckets);

    expect(trend).toEqual([
      { label: "2026-04", activeTenantCount: 0 },
      { label: "2026-05", activeTenantCount: 1 },
      { label: "2026-06", activeTenantCount: 1 },
    ]);
  });

  it("counts a tenant once even with two overlapping tenancies in the same bucket", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Count Dedup ${Math.random()}` } });
    const { tenant, room } = await makeTenancy(org.id, { startDate: "2026-01-01" });
    // Same tenant, a second (e.g. transferred) tenancy overlapping the same period.
    await prisma.tenancy.create({
      data: {
        organizationId: org.id,
        tenantId: tenant.id,
        roomId: room.id,
        startDate: new Date("2026-02-01"),
        monthlyRate: "3000.00",
        depositAmount: "3000.00",
        status: "ACTIVE",
      },
    });
    const scoped = createScopedClient(org.id);
    const buckets = buildMonthBuckets({ from: new Date("2026-04-01"), to: new Date("2026-04-30") });

    const trend = await getTenantCountTrend(scoped, buckets);

    expect(trend).toEqual([{ label: "2026-04", activeTenantCount: 1 }]);
  });
});
