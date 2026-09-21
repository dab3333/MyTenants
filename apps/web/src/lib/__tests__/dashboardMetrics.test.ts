import { describe, it, expect, afterAll } from "vitest";
import { prisma, createScopedClient } from "@mytenants/db";
import { buildMonthBuckets } from "../dateRange";
import {
  getIncomeTrend,
  getTenantCountTrend,
  getOccupancyByBuilding,
  getOverdueSummary,
  getTenantStatusCounts,
} from "../dashboardMetrics";

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

describe("getOccupancyByBuilding", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("computes occupied and total capacity per building, across multiple rooms of varying capacity", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Occupancy ${Math.random()}` } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Main Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const fullRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 2, monthlyRate: "3000.00" },
    });
    const vacantRoom = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "102", capacity: 1, monthlyRate: "3000.00" },
    });
    const tenant1 = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "ACTIVE" } });
    const tenant2 = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "B", lastName: "Two", status: "ACTIVE" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant1.id, roomId: fullRoom.id, startDate: new Date("2026-01-01"), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant2.id, roomId: fullRoom.id, startDate: new Date("2026-01-01"), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ACTIVE" },
    });

    const scoped = createScopedClient(org.id);
    const result = await getOccupancyByBuilding(scoped);

    expect(result).toEqual([{ id: building.id, name: "Main Hall", occupiedCapacity: 2, totalCapacity: 3 }]);
  });

  it("ignores ENDED tenancies when computing occupied capacity", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Occupancy Ended ${Math.random()}` } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Ended Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
    });
    const tenant = await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "MOVED_OUT" } });
    await prisma.tenancy.create({
      data: { organizationId: org.id, tenantId: tenant.id, roomId: room.id, startDate: new Date("2026-01-01"), endDate: new Date("2026-02-01"), monthlyRate: "3000.00", depositAmount: "3000.00", status: "ENDED" },
    });

    const scoped = createScopedClient(org.id);
    const result = await getOccupancyByBuilding(scoped);

    expect(result).toEqual([{ id: building.id, name: "Ended Hall", occupiedCapacity: 0, totalCapacity: 1 }]);
  });

  it("returns an empty array for an organization with no buildings", async () => {
    const org = await prisma.organization.create({ data: { name: `Org No Buildings ${Math.random()}` } });
    const scoped = createScopedClient(org.id);

    const result = await getOccupancyByBuilding(scoped);

    expect(result).toEqual([]);
  });
});

describe("getTenantStatusCounts", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("counts active and prospect tenants separately, excluding moved-out tenants", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Status Counts ${Math.random()}` } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "A", lastName: "One", status: "ACTIVE" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "B", lastName: "Two", status: "ACTIVE" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "C", lastName: "Three", status: "PROSPECT" } });
    await prisma.tenant.create({ data: { organizationId: org.id, firstName: "D", lastName: "Four", status: "MOVED_OUT" } });

    const scoped = createScopedClient(org.id);
    const result = await getTenantStatusCounts(scoped);

    expect(result).toEqual({ active: 2, prospects: 1 });
  });

  it("returns zero counts when there are no tenants", async () => {
    const org = await prisma.organization.create({ data: { name: `Org No Tenants ${Math.random()}` } });
    const scoped = createScopedClient(org.id);

    const result = await getTenantStatusCounts(scoped);

    expect(result).toEqual({ active: 0, prospects: 0 });
  });
});

describe("getOverdueSummary", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("sums the remaining balance of OVERDUE invoices only, netting out partial payments", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Overdue ${Math.random()}` } });
    const { tenancy } = await makeTenancy(org.id, { startDate: "2026-01-01" });
    const overdueInvoice = await prisma.invoice.create({
      data: { organizationId: org.id, tenancyId: tenancy.id, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), amountDue: "3000.00", dueDate: new Date("2026-01-01"), status: "OVERDUE" },
    });
    const user = await makeUser(org.id);
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: overdueInvoice.id, amountPaid: "1000.00", method: "CASH", recordedByUserId: user.id },
    });
    await prisma.invoice.create({
      data: { organizationId: org.id, tenancyId: tenancy.id, periodStart: new Date("2026-02-01"), periodEnd: new Date("2026-02-28"), amountDue: "3000.00", dueDate: new Date("2026-02-01"), status: "PAID" },
    });

    const scoped = createScopedClient(org.id);
    const result = await getOverdueSummary(scoped);

    expect(result).toEqual({ count: 1, totalOwed: 2000 });
  });

  it("returns a zero summary when there are no overdue invoices", async () => {
    const org = await prisma.organization.create({ data: { name: `Org No Overdue ${Math.random()}` } });
    const scoped = createScopedClient(org.id);

    const result = await getOverdueSummary(scoped);

    expect(result).toEqual({ count: 0, totalOwed: 0 });
  });

  it("sums multiple payments correctly when netting out balance for a single overdue invoice", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Multi Payment ${Math.random()}` } });
    const { tenancy } = await makeTenancy(org.id, { startDate: "2026-01-01" });
    const overdueInvoice = await prisma.invoice.create({
      data: { organizationId: org.id, tenancyId: tenancy.id, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), amountDue: "3000.00", dueDate: new Date("2026-01-01"), status: "OVERDUE" },
    });
    const user = await makeUser(org.id);
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: overdueInvoice.id, amountPaid: "1000.00", method: "CASH", recordedByUserId: user.id },
    });
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: overdueInvoice.id, amountPaid: "500.00", method: "CASH", recordedByUserId: user.id },
    });

    const scoped = createScopedClient(org.id);
    const result = await getOverdueSummary(scoped);

    expect(result).toEqual({ count: 1, totalOwed: 1500 });
  });

  it("aggregates count and totalOwed correctly across multiple overdue invoices in the same organization", async () => {
    const org = await prisma.organization.create({ data: { name: `Org Multi Invoice ${Math.random()}` } });
    const { tenancy: tenancy1 } = await makeTenancy(org.id, { startDate: "2026-01-01" });
    const { tenancy: tenancy2 } = await makeTenancy(org.id, { startDate: "2026-02-01" });
    const user = await makeUser(org.id);

    const overdueInvoice1 = await prisma.invoice.create({
      data: { organizationId: org.id, tenancyId: tenancy1.id, periodStart: new Date("2026-01-01"), periodEnd: new Date("2026-01-31"), amountDue: "3000.00", dueDate: new Date("2026-01-01"), status: "OVERDUE" },
    });
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: overdueInvoice1.id, amountPaid: "500.00", method: "CASH", recordedByUserId: user.id },
    });

    const overdueInvoice2 = await prisma.invoice.create({
      data: { organizationId: org.id, tenancyId: tenancy2.id, periodStart: new Date("2026-02-01"), periodEnd: new Date("2026-02-28"), amountDue: "2000.00", dueDate: new Date("2026-02-01"), status: "OVERDUE" },
    });
    await prisma.payment.create({
      data: { organizationId: org.id, invoiceId: overdueInvoice2.id, amountPaid: "300.00", method: "CASH", recordedByUserId: user.id },
    });

    const scoped = createScopedClient(org.id);
    const result = await getOverdueSummary(scoped);

    expect(result).toEqual({ count: 2, totalOwed: 4200 });
  });
});
