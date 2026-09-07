import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@mytenants/db";
import { runDailyBilling } from "../billing";

async function makeActiveTenancy(billingDay: number, startDate = "2026-01-01") {
  const org = await prisma.organization.create({ data: { name: `Org Billing ${Math.random()}` } });
  const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
  const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
  const room = await prisma.room.create({
    data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
  });
  const tenant = await prisma.tenant.create({
    data: { organizationId: org.id, firstName: "A", lastName: "Tenant", status: "ACTIVE" },
  });
  const tenancy = await prisma.tenancy.create({
    data: {
      organizationId: org.id,
      tenantId: tenant.id,
      roomId: room.id,
      startDate: new Date(startDate),
      monthlyRate: "3000.00",
      depositAmount: "3000.00",
      billingDay,
      status: "ACTIVE",
    },
  });
  return { org, tenancy };
}

describe("runDailyBilling", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("generates an invoice for a tenancy whose billingDay matches today", async () => {
    const { tenancy } = await makeActiveTenancy(15);

    const result = await runDailyBilling(prisma, new Date("2026-01-15"));

    expect(result.generated).toBeGreaterThanOrEqual(1);
    const invoice = await prisma.invoice.findFirst({ where: { tenancyId: tenancy.id } });
    expect(invoice).not.toBeNull();
    expect(invoice?.amountDue.toString()).toBe("3000");
    expect(invoice?.status).toBe("PENDING");
    expect(invoice?.periodStart.toISOString().slice(0, 10)).toBe("2026-01-15");
    expect(invoice?.dueDate.toISOString().slice(0, 10)).toBe("2026-01-15");
  });

  it("does not generate an invoice for a tenancy whose billingDay does not match today", async () => {
    const { tenancy } = await makeActiveTenancy(20);

    await runDailyBilling(prisma, new Date("2026-01-15"));

    const invoice = await prisma.invoice.findFirst({ where: { tenancyId: tenancy.id } });
    expect(invoice).toBeNull();
  });

  it("clamps billingDay to month-end in a shorter month", async () => {
    const { tenancy } = await makeActiveTenancy(31);

    await runDailyBilling(prisma, new Date("2026-02-28"));

    const invoice = await prisma.invoice.findFirst({ where: { tenancyId: tenancy.id } });
    expect(invoice).not.toBeNull();
    expect(invoice?.periodEnd.toISOString().slice(0, 10)).toBe("2026-03-30");
  });

  it("is idempotent: running twice for the same day generates the invoice only once", async () => {
    const { tenancy } = await makeActiveTenancy(15);

    await runDailyBilling(prisma, new Date("2026-01-15"));
    const result2 = await runDailyBilling(prisma, new Date("2026-01-15"));

    const invoices = await prisma.invoice.findMany({ where: { tenancyId: tenancy.id } });
    expect(invoices).toHaveLength(1);
    expect(result2.generated).toBe(0);
  });

  it("does not generate an invoice for a tenancy that has ENDED", async () => {
    const { tenancy } = await makeActiveTenancy(15);
    await prisma.tenancy.update({ where: { id: tenancy.id }, data: { status: "ENDED", endDate: new Date("2026-01-10") } });

    await runDailyBilling(prisma, new Date("2026-01-15"));

    const invoice = await prisma.invoice.findFirst({ where: { tenancyId: tenancy.id } });
    expect(invoice).toBeNull();
  });

  it("flips a PENDING invoice past its due date to OVERDUE", async () => {
    const { org, tenancy } = await makeActiveTenancy(1);
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenancyId: tenancy.id,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        amountDue: "3000.00",
        dueDate: new Date("2026-01-01"),
        status: "PENDING",
      },
    });

    const result = await runDailyBilling(prisma, new Date("2026-01-15"));

    expect(result.recalculated).toBeGreaterThanOrEqual(1);
    const updated = await prisma.invoice.findFirst({ where: { id: invoice.id } });
    expect(updated?.status).toBe("OVERDUE");
  });

  it("does not touch an invoice that is already PAID", async () => {
    const { org, tenancy } = await makeActiveTenancy(1);
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenancyId: tenancy.id,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        amountDue: "3000.00",
        dueDate: new Date("2026-01-01"),
        status: "PAID",
      },
    });

    await runDailyBilling(prisma, new Date("2026-01-15"));

    const updated = await prisma.invoice.findFirst({ where: { id: invoice.id } });
    expect(updated?.status).toBe("PAID");
  });
});
