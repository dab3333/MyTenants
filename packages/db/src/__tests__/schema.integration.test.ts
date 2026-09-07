import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "../index";

describe("schema relations", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("creates a full org -> building -> floor -> room -> tenant -> tenancy -> invoice -> payment chain", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme Dorms" } });
    const user = await prisma.user.create({
      data: {
        organizationId: org.id,
        email: `owner-${org.id}@example.com`,
        passwordHash: "hash",
        name: "Owner",
      },
    });
    const building = await prisma.building.create({
      data: { organizationId: org.id, name: "Main Hall" },
    });
    const floor = await prisma.floor.create({
      data: { organizationId: org.id, buildingId: building.id, label: "1F" },
    });
    const room = await prisma.room.create({
      data: {
        organizationId: org.id,
        floorId: floor.id,
        name: "101",
        capacity: 2,
        monthlyRate: "3000.00",
      },
    });
    const tenant = await prisma.tenant.create({
      data: {
        organizationId: org.id,
        firstName: "Jane",
        lastName: "Doe",
        status: "ACTIVE",
      },
    });
    const tenancy = await prisma.tenancy.create({
      data: {
        organizationId: org.id,
        tenantId: tenant.id,
        roomId: room.id,
        startDate: new Date("2026-01-01"),
        monthlyRate: "3000.00",
        depositAmount: "3000.00",
      },
    });
    const invoice = await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenancyId: tenancy.id,
        periodStart: new Date("2026-01-01"),
        periodEnd: new Date("2026-01-31"),
        amountDue: "3000.00",
        dueDate: new Date("2026-01-05"),
      },
    });
    const payment = await prisma.payment.create({
      data: {
        organizationId: org.id,
        invoiceId: invoice.id,
        amountPaid: "3000.00",
        method: "CASH",
        recordedByUserId: user.id,
      },
    });

    expect(payment.invoiceId).toBe(invoice.id);

    const fetchedInvoice = await prisma.invoice.findFirst({
      where: { id: invoice.id },
      include: { payments: true },
    });
    expect(fetchedInvoice?.payments).toHaveLength(1);
  });

  it("stores and returns a Tenancy's billingDay", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme Billing Day" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
    });
    const tenant = await prisma.tenant.create({
      data: { organizationId: org.id, firstName: "Jane", lastName: "Doe", status: "ACTIVE" },
    });
    const tenancy = await prisma.tenancy.create({
      data: {
        organizationId: org.id,
        tenantId: tenant.id,
        roomId: room.id,
        startDate: new Date("2026-01-15"),
        monthlyRate: "3000.00",
        depositAmount: "3000.00",
        billingDay: 15,
      },
    });

    expect(tenancy.billingDay).toBe(15);
  });

  it("enforces at most one Invoice per Tenancy per periodStart", async () => {
    const org = await prisma.organization.create({ data: { name: "Acme Invoice Uniqueness" } });
    const building = await prisma.building.create({ data: { organizationId: org.id, name: "Hall" } });
    const floor = await prisma.floor.create({ data: { organizationId: org.id, buildingId: building.id, label: "1F" } });
    const room = await prisma.room.create({
      data: { organizationId: org.id, floorId: floor.id, name: "101", capacity: 1, monthlyRate: "3000.00" },
    });
    const tenant = await prisma.tenant.create({
      data: { organizationId: org.id, firstName: "Jane", lastName: "Doe", status: "ACTIVE" },
    });
    const tenancy = await prisma.tenancy.create({
      data: {
        organizationId: org.id,
        tenantId: tenant.id,
        roomId: room.id,
        startDate: new Date("2026-01-01"),
        monthlyRate: "3000.00",
        depositAmount: "3000.00",
      },
    });
    const periodStart = new Date("2026-01-01");

    await prisma.invoice.create({
      data: {
        organizationId: org.id,
        tenancyId: tenancy.id,
        periodStart,
        periodEnd: new Date("2026-01-31"),
        amountDue: "3000.00",
        dueDate: periodStart,
      },
    });

    await expect(
      prisma.invoice.create({
        data: {
          organizationId: org.id,
          tenancyId: tenancy.id,
          periodStart,
          periodEnd: new Date("2026-01-31"),
          amountDue: "3000.00",
          dueDate: periodStart,
        },
      })
    ).rejects.toThrow();
  });
});
